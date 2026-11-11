import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthSession } from "@/lib/auth/session";
const mocks = vi.hoisted(() => ({
  session: null as AuthSession | null,
  rpc: vi.fn(),
  client: vi.fn(),
  signal: vi.fn(),
  result: { data: null as unknown, error: null as unknown },
  guard: vi.fn(),
  redirect: vi.fn((path: string): never => {
    throw new Error("REDIRECT:" + path);
  }),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/session", () => ({
  getAuthSession: () => Promise.resolve(mocks.session),
  AuthAvailabilityError: class AuthAvailabilityError extends Error {},
  requirePlatformAdmin: (path: string) => mocks.guard(path),
}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: () => mocks.client(),
}));
vi.mock("next/navigation", () => ({
  redirect: (path: string) => mocks.redirect(path),
}));
import { GET } from "@/app/api/v2/operations/metrics/route";
import { getOperationsSnapshot } from "@/server/operations/queries";
import { loadOperationsPage } from "@/server/operations/page-data";
function fixture() {
  return {
    version: "operations-v1",
    asOf: "2026-11-11T08:00:00Z",
    periodStart: "2026-10-12T08:00:00Z",
    scope: "signing-v1",
    activeBasis: "document-events",
    metrics: {
      registeredUsers: 4,
      activeDocumentUsers30d: 2,
      uploadedDocuments: 2,
      completedDocuments: 1,
      pendingRequests: 1,
      attentionResults: 0,
      sourceVersions: 2,
      awaitingResults: 0,
      processingResults: 0,
      legacyDocuments: 0,
    },
    attention: { items: [], total: 0, limit: 20, hasMore: false },
  };
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.session = {
    user: { id: "10000000-0000-4000-8000-000000000001", emailConfirmed: true },
    roles: ["platform_admin"],
  };
  mocks.result = { data: fixture(), error: null };
  mocks.signal.mockImplementation(() => Promise.resolve(mocks.result));
  mocks.rpc.mockImplementation(() => ({ abortSignal: mocks.signal }));
  mocks.client.mockResolvedValue({ rpc: mocks.rpc });
  mocks.guard.mockResolvedValue(mocks.session);
});
const request = (search = "") =>
  new Request("http://127.0.0.1:3000/api/v2/operations/metrics" + search, {
    headers: { "x-role": "platform_admin", "x-owner-id": "forged" },
  });
async function failure(status: number, code: string, search = "") {
  const response = await GET(request(search));
  expect(response.status).toBe(status);
  expect(response.headers.get("cache-control")).toContain("no-store");
  expect(response.headers.get("vary")).toContain("Cookie");
  const body = await response.json();
  expect(body.error.code).toBe(code);
  expect(body.data).toBeUndefined();
  return body;
}
describe("operations API/DAL authorization and safe provider contract (mock provider)", () => {
  it("denies unauthenticated requests before constructing a database client", async () => {
    mocks.session = null;
    await failure(401, "UNAUTHENTICATED");
    expect(mocks.client).not.toHaveBeenCalled();
  });
  it.each(
    (
      [
        ["user"],
        ["reviewer"],
        ["user", "reviewer"],
        [],
      ] as AuthSession["roles"][]
    ).map((roles) => ({ roles })),
  )("denies non-admin roles %j despite forged headers", async ({ roles }) => {
    mocks.session!.roles = roles;
    await failure(403, "OPERATIONS_NOT_ALLOWED");
    expect(mocks.client).not.toHaveBeenCalled();
  });
  it("denies unverified admins before a data query", async () => {
    mocks.session!.user.emailConfirmed = false;
    await failure(403, "OPERATIONS_NOT_ALLOWED");
    expect(mocks.client).not.toHaveBeenCalled();
  });
  it("returns a private snapshot via the authenticated zero-argument RPC only", async () => {
    const response = await GET(request());
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data).toEqual(fixture());
    expect(body.meta.requestId).toBeTypeOf("string");
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith(
      "get_operations_snapshot",
      {},
    );
    expect(mocks.signal.mock.calls[0]?.[0]).toBeInstanceOf(AbortSignal);
    expect(response.headers.get("cache-control")).toContain("private");
  });
  it.each([
    "?actor_id=fake",
    "?owner_id=fake",
    "?role=platform_admin",
    "?period=all",
  ])("rejects unsupported filters %s without querying", async (search) => {
    await failure(422, "VALIDATION_ERROR", search);
    expect(mocks.client).not.toHaveBeenCalled();
  });
  it("honors DB denial if the role has been revoked after the server role lookup", async () => {
    mocks.result = {
      data: null,
      error: { code: "42501", message: "PRIVATE SQL must not be sent" },
    };
    const body = await failure(403, "OPERATIONS_NOT_ALLOWED");
    expect(JSON.stringify(body)).not.toContain("PRIVATE SQL");
  });
  it.each(["PGRST202", "57014", "XX000"])(
    "maps provider %s to unavailable without inventing zero statistics",
    async (code) => {
      mocks.result = {
        data: null,
        error: { code, message: "secret-key and raw SQL" },
      };
      const body = await failure(503, "OPERATIONS_UNAVAILABLE");
      expect(JSON.stringify(body)).not.toMatch(/secret-key|raw SQL/);
    },
  );
  it.each(
    [
      null,
      {},
      [],
      { ...fixture(), email: "private@example.invalid" },
      { ...fixture(), metrics: { ...fixture().metrics, registeredUsers: -1 } },
      {
        ...fixture(),
        activeBasis: "unavailable",
        metrics: { ...fixture().metrics, activeDocumentUsers30d: null },
      },
    ].map((data) => ({ data })),
  )(
    "fails closed for missing, invalid or confidential provider output",
    async ({ data }) => {
      mocks.result = { data, error: null };
      const body = await failure(503, "OPERATIONS_UNAVAILABLE");
      expect(JSON.stringify(body)).not.toContain("private@example.invalid");
    },
  );
  it("sanitizes network/client exceptions and does not reuse an earlier result", async () => {
    await getOperationsSnapshot();
    mocks.client.mockRejectedValueOnce(new Error("Bearer secret"));
    const body = await failure(503, "OPERATIONS_UNAVAILABLE");
    expect(JSON.stringify(body)).not.toContain("Bearer");
    expect(mocks.client).toHaveBeenCalledTimes(2);
  });
});
describe("monitoring SSR distinguishes an unavailable source from permission denial", () => {
  it("returns null for source failure so the UI can display unavailable", async () => {
    mocks.result = { data: null, error: { code: "PGRST202" } };
    expect(await loadOperationsPage("/admin/overview")).toBeNull();
    expect(mocks.guard).toHaveBeenCalledWith("/admin/overview");
  });
  it("redirects on DB role revocation instead of showing a success/error snapshot", async () => {
    mocks.result = { data: null, error: { code: "42501" } };
    await expect(loadOperationsPage("/admin/operations")).rejects.toThrow(
      "REDIRECT:/access-denied",
    );
  });
  it("stops before a DB query when the page guard denies the actor", async () => {
    mocks.guard.mockRejectedValueOnce(new Error("Page denied"));
    await expect(loadOperationsPage("/admin/overview")).rejects.toThrow(
      "Page denied",
    );
    expect(mocks.client).not.toHaveBeenCalled();
  });
});
