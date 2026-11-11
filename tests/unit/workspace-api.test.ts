import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  origin: vi.fn(),
  list: vi.fn(),
  detail: vi.fn(),
  dashboard: vi.fn(),
  categories: vi.fn(),
  updateProfile: vi.fn(),
  upload: vi.fn(),
  file: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/config", () => ({ getAppOrigin: mocks.origin }));
vi.mock("@/lib/auth/session", async (original) => ({
  ...(await original<typeof import("@/lib/auth/session")>()),
  getAuthSession: mocks.session,
}));
vi.mock("@/server/workspace/queries", async (original) => ({
  ...(await original<typeof import("@/server/workspace/queries")>()),
  getWorkspaceDocuments: mocks.list,
  getWorkspaceDocument: mocks.detail,
  getWorkspaceDashboard: mocks.dashboard,
  getWorkspaceCategories: mocks.categories,
  updateWorkspaceProfile: mocks.updateProfile,
}));
vi.mock("@/server/documents/upload", () => ({
  uploadSubmission: mocks.upload,
}));
vi.mock("@/server/documents/file", () => ({ serveDocumentFile: mocks.file }));

import { GET as documents, POST as submit } from "@/app/api/v1/documents/route";
import { GET as detail } from "@/app/api/v1/documents/[documentId]/route";
import { GET as file } from "@/app/api/v1/documents/[documentId]/file/route";
import { POST as resubmit } from "@/app/api/v1/documents/[documentId]/resubmissions/route";
import { PATCH as profile } from "@/app/api/v1/profile/route";
import { GET as dashboard } from "@/app/api/v1/dashboard/route";
import { GET as categories } from "@/app/api/v1/categories/route";

const owner = "10000000-0000-4000-8000-000000000001";
const documentId = "20000000-0000-4000-8000-000000000001";
const origin = "https://dvp.example";
const context = () => ({ params: Promise.resolve({ documentId }) });

function json(body: unknown, requestOrigin: string | null = origin) {
  return new Request(`${origin}/api/v1/profile`, {
    method: "PATCH",
    headers: {
      "content-type": "application/json",
      ...(requestOrigin ? { origin: requestOrigin } : {}),
    },
    body: JSON.stringify(body),
  });
}

function privateResponse(response: Response, status: number) {
  expect(response.status).toBe(status);
  expect(response.headers.get("cache-control")).toContain("no-store");
  expect(response.headers.get("vary")?.toLowerCase()).toContain("cookie");
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.origin.mockReturnValue(origin);
  mocks.session.mockResolvedValue({
    user: { id: owner, emailConfirmed: true },
    roles: ["user"],
  });
  mocks.list.mockResolvedValue({ items: [], limit: 20, nextCursor: null });
  mocks.detail.mockResolvedValue(null);
  mocks.dashboard.mockResolvedValue({
    counts: { total: 0 },
    recentDocuments: [],
  });
  mocks.categories.mockResolvedValue([]);
  mocks.updateProfile.mockResolvedValue({
    fullName: "Synthetic owner",
    phone: null,
  });
  mocks.upload.mockResolvedValue({
    documentId,
    submissionId: "30000000-0000-4000-8000-000000000001",
    versionNo: 1,
    status: "pending_review",
    submittedAt: "2026-11-04T12:00:00.000Z",
  });
});

describe("workspace HTTP contracts (mocked services, not live backend)", () => {
  it("returns a private cursor-list envelope and forwards filters to the owner-aware query", async () => {
    const response = await documents(
      new Request(
        `${origin}/api/v1/documents?q=synthetic&status=pending_review&limit=5`,
      ),
    );
    privateResponse(response, 200);
    expect(mocks.list).toHaveBeenCalledWith({
      q: "synthetic",
      status: "pending_review",
      limit: "5",
    });
    const result = await response.json();
    expect(result.data).toEqual({ items: [], limit: 20, nextCursor: null });
    expect(result.meta.requestId).toMatch(/^[a-f0-9-]{36}$/);
  });

  it.each([
    ["dashboard", dashboard],
    ["categories", categories],
  ] as const)(
    "wraps %s reads with private cache headers",
    async (_name, handler) => {
      const response = await handler();
      privateResponse(response, 200);
      expect((await response.json()).meta.requestId).toMatch(/^[a-f0-9-]{36}$/);
    },
  );

  it("returns a generic404 for an out-of-scope document without echoing the ID", async () => {
    const response = await detail(
      new Request(`${origin}/api/v1/documents/${documentId}`),
      context(),
    );
    privateResponse(response, 404);
    const result = await response.json();
    expect(result.error.code).toBe("NOT_FOUND");
    expect(result).not.toHaveProperty("data");
    expect(JSON.stringify(result)).not.toContain(documentId);
  });

  it("redacts unexpected service errors rather than returning provider or SQL details", async () => {
    mocks.list.mockRejectedValue(
      new Error("secret storage path and SQL internal detail"),
    );
    const response = await documents(new Request(`${origin}/api/v1/documents`));
    privateResponse(response, 500);
    const result = await response.json();
    expect(result.error.code).toBe("INTERNAL_ERROR");
    expect(JSON.stringify(result)).not.toMatch(
      /secret storage path|SQL internal detail|stack/,
    );
  });

  it("uses201 pending-review creation with no verification credential", async () => {
    const request = new Request(`${origin}/api/v1/documents`, {
      method: "POST",
    });
    const response = await submit(request);
    privateResponse(response, 201);
    const result = await response.json();
    expect(result.data.status).toBe("pending_review");
    expect(result.data).not.toHaveProperty("verificationCode");
    expect(result.data).not.toHaveProperty("qr");
    expect(mocks.upload).toHaveBeenCalledWith(request);
  });

  it("awaits resubmission params before handing the logical document to the guarded service", async () => {
    const request = new Request(
      `${origin}/api/v1/documents/${documentId}/resubmissions`,
      { method: "POST" },
    );
    privateResponse(await resubmit(request, context()), 201);
    expect(mocks.upload).toHaveBeenCalledWith(request, documentId);
  });

  it("preserves a private file Response without converting it to a JSON storage URL", async () => {
    const streamed = new Response("%PDF-1.7\nsynthetic", {
      headers: {
        "content-type": "application/pdf",
        "cache-control": "private, no-store",
        vary: "Cookie",
      },
    });
    mocks.file.mockResolvedValue(streamed);
    const request = new Request(
      `${origin}/api/v1/documents/${documentId}/file`,
    );
    const response = await file(request, context());
    expect(response).toBe(streamed);
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(mocks.file).toHaveBeenCalledWith(request, documentId);
  });

  it("requires authentication before parsing a profile mutation", async () => {
    mocks.session.mockResolvedValue(null);
    const response = await profile(json({ fullName: "Synthetic" }));
    privateResponse(response, 401);
    expect(mocks.updateProfile).not.toHaveBeenCalled();
  });

  it.each([
    null,
    "null",
    "https://attacker.example",
    `${origin}.attacker.example`,
  ])(
    "rejects missing or cross-origin profile mutation",
    async (requestOrigin) => {
      const response = await profile(
        json({ fullName: "Synthetic" }, requestOrigin),
      );
      privateResponse(response, 403);
      expect((await response.json()).error.code).toBe("INVALID_ORIGIN");
      expect(mocks.updateProfile).not.toHaveBeenCalled();
    },
  );

  it.each(["role", "roles", "email", "owner_id", "status"])(
    "rejects forbidden profile field%s before calling the update service",
    async (field) => {
      const response = await profile(
        json({ fullName: "Synthetic", [field]: "forged" }),
      );
      privateResponse(response, 422);
      expect(mocks.updateProfile).not.toHaveBeenCalled();
    },
  );

  it("bounds actual JSON bytes even without Content-Length", async () => {
    const response = await profile(json({ fullName: "é".repeat(2300) }));
    privateResponse(response, 413);
    expect((await response.json()).error.code).toBe("REQUEST_TOO_LARGE");
    expect(mocks.updateProfile).not.toHaveBeenCalled();
  });

  it("rejects malformed JSON without exposing parsing details", async () => {
    const response = await profile(
      new Request(`${origin}/api/v1/profile`, {
        method: "PATCH",
        headers: { origin, "content-type": "application/json" },
        body: "private malformed body",
      }),
    );
    privateResponse(response, 400);
    expect(await response.text()).not.toContain("private malformed body");
    expect(mocks.updateProfile).not.toHaveBeenCalled();
  });

  it("normalizes allowed profile fields before calling the update service", async () => {
    privateResponse(
      await profile(json({ fullName: "  Synthetic owner  ", phone: " " })),
      200,
    );
    expect(mocks.updateProfile).toHaveBeenCalledWith({
      fullName: "Synthetic owner",
      phone: null,
    });
  });

  it("preserves an omitted phone instead of clearing it during a partial profile update", async () => {
    privateResponse(await profile(json({ fullName: "Synthetic owner" })), 200);
    expect(mocks.updateProfile.mock.calls[0]?.[0]?.phone).toBeUndefined();
  });
});
