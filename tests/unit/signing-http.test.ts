import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  origin: vi.fn(),
  code: vi.fn(),
  lookup: vi.fn(),
  documents: vi.fn(),
  document: vi.fn(),
  upload: vi.fn(),
  file: vi.fn(),
  requests: vi.fn(),
  request: vi.fn(),
  send: vi.fn(),
  cancel: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/config", () => ({ getAppOrigin: mocks.origin }));
vi.mock("@/lib/auth/session", async (original) => ({
  ...(await original<typeof import("@/lib/auth/session")>()),
  getAuthSession: mocks.session,
}));
vi.mock("@/server/signing/queries", () => ({
  getSigningUserCode: mocks.code,
  lookupSigningRecipient: mocks.lookup,
  getSigningDocuments: mocks.documents,
  getSigningDocument: mocks.document,
  getSigningRequests: mocks.requests,
  getSigningRequest: mocks.request,
  sendSigningRequest: mocks.send,
  cancelSigningRequest: mocks.cancel,
}));
vi.mock("@/server/signing/upload", () => ({
  uploadSigningDraft: mocks.upload,
}));
vi.mock("@/server/signing/file", () => ({ serveSigningFile: mocks.file }));

import { GET as code } from "@/app/api/v2/me/user-code/route";
import * as lookupRoutes from "@/app/api/v2/recipients/lookup/route";
import {
  GET as documents,
  POST as upload,
} from "@/app/api/v2/signing-documents/route";
import { GET as document } from "@/app/api/v2/signing-documents/[documentId]/route";
import { GET as file } from "@/app/api/v2/signing-documents/[documentId]/file/route";
import {
  GET as requests,
  POST as send,
} from "@/app/api/v2/signing-requests/route";
import { GET as requestDetail } from "@/app/api/v2/signing-requests/[requestId]/route";
import { POST as cancel } from "@/app/api/v2/signing-requests/[requestId]/cancel/route";
import { ApiError } from "@/server/errors";
import { SIGNING_SHARING_POLICY_VERSION } from "@/lib/signing/policy";

// Real route handlers, API error/envelope handling, strict schemas and bounded
// JSON reader are exercised. Session and domain services are mocked; these
// tests do not establish authorization in the DAL or live database.
const origin = "http://127.0.0.1:3000";
const ownerId = "71000000-0000-4000-8000-000000000001";
const recipientId = "71000000-0000-4000-8000-000000000002";
const documentId = "72000000-0000-4000-8000-000000000001";
const sourceVersionId = "73000000-0000-4000-8000-000000000001";
const requestId = "74000000-0000-4000-8000-000000000001";
const key = "75000000-0000-4000-8000-000000000001";
const accountCode = "DVP-0123456789ABCDEF0123";
const sendBody = () => ({
  sourceVersionId,
  recipientCode: accountCode,
  recipientId,
  sharingPolicyVersion: SIGNING_SHARING_POLICY_VERSION,
  sharingConsent: true,
});
const documentContext = () => ({ params: Promise.resolve({ documentId }) });
const requestContext = () => ({ params: Promise.resolve({ requestId }) });

function mutation(
  path: string,
  body: unknown,
  requestOrigin: string | null = origin,
  idempotencyKey: string | null = key,
) {
  return new Request(`${origin}/api/v2/${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(requestOrigin !== null ? { origin: requestOrigin } : {}),
      ...(idempotencyKey !== null ? { "idempotency-key": idempotencyKey } : {}),
    },
    body: JSON.stringify(body),
  });
}

function assertPrivate(response: Response, status: number) {
  expect(response.status).toBe(status);
  expect(response.headers.get("cache-control")).toContain("no-store");
  expect(response.headers.get("vary")?.toLowerCase()).toContain("cookie");
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.origin.mockReturnValue(origin);
  mocks.session.mockResolvedValue({
    user: { id: ownerId, emailConfirmed: true },
    roles: ["user"],
  });
  mocks.code.mockResolvedValue({
    code: accountCode,
    createdAt: "2026-11-05T00:00:00Z",
  });
  mocks.lookup.mockResolvedValue({
    id: recipientId,
    code: accountCode,
    displayName: "Synthetic recipient",
  });
  mocks.documents.mockResolvedValue({
    items: [],
    hasMore: false,
    cursor: null,
  });
  mocks.document.mockResolvedValue(null);
  mocks.requests.mockResolvedValue({ items: [], hasMore: false, cursor: null });
  mocks.request.mockResolvedValue(null);
  mocks.send.mockResolvedValue({
    requestId,
    documentId,
    sourceVersionId,
    status: "pending",
    sentAt: "2026-11-05T00:00:00.000Z",
    expiresAt: "2026-11-12T00:00:00.000Z",
    cancelledAt: null,
  });
  mocks.cancel.mockResolvedValue({ requestId, status: "cancelled" });
  mocks.upload.mockResolvedValue({
    documentId,
    versionId: sourceVersionId,
    versionNo: 1,
    status: "draft",
    createdAt: "2026-11-05T00:00:00.000Z",
  });
});

describe("R2 HTTP contracts with mocked domain services", () => {
  it("keeps exact recipient lookup out of GET routes and URL queries", async () => {
    expect(lookupRoutes).not.toHaveProperty("GET");
    const response = await lookupRoutes.POST(
      mutation("recipients/lookup", { code: " dvp-01234-56789-abcde-f0123 " }),
    );
    assertPrivate(response, 200);
    expect(mocks.lookup).toHaveBeenCalledExactlyOnceWith(accountCode);
    const body = await response.json();
    expect(body.data).toEqual({
      id: recipientId,
      code: accountCode,
      displayName: "Synthetic recipient",
    });
    expect(body.meta.requestId).toMatch(/^[a-f0-9-]{36}$/);
    expect(body.data).not.toHaveProperty("email");
    expect(body.data).not.toHaveProperty("phone");
  });

  it.each([
    ["lookup", lookupRoutes.POST],
    ["send", send],
    ["cancel", (input: Request) => cancel(input, requestContext())],
  ] as const)(
    "requires authentication before reading a malformed %s body or checking Origin",
    async (_name, handler) => {
      mocks.session.mockResolvedValue(null);
      const input = new Request(`${origin}/api/v2/signing-requests`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "private malformed input",
      });
      const response = await handler(input);
      assertPrivate(response, 401);
      expect((await response.json()).error.code).toBe("UNAUTHENTICATED");
      expect(input.bodyUsed).toBe(false);
      expect(mocks.origin).not.toHaveBeenCalled();
      expect(mocks.lookup).not.toHaveBeenCalled();
      expect(mocks.send).not.toHaveBeenCalled();
      expect(mocks.cancel).not.toHaveBeenCalled();
    },
  );

  it.each([
    null,
    "null",
    "https://attacker.example",
    `${origin}.attacker.example`,
  ])(
    "rejects absent or hostile mutation Origin %s before consuming JSON",
    async (requestOrigin) => {
      for (const handler of [
        lookupRoutes.POST,
        send,
        (input: Request) => cancel(input, requestContext()),
      ]) {
        const input = mutation("signing-requests", sendBody(), requestOrigin);
        const response = await handler(input);
        assertPrivate(response, 403);
        expect((await response.json()).error.code).toBe("INVALID_ORIGIN");
        expect(input.bodyUsed).toBe(false);
      }
      expect(mocks.lookup).not.toHaveBeenCalled();
      expect(mocks.send).not.toHaveBeenCalled();
      expect(mocks.cancel).not.toHaveBeenCalled();
    },
  );

  it.each([
    "actor_id",
    "ownerId",
    "role",
    "status",
    "storage_path",
    "source_sha256",
  ])(
    "rejects injected send authority %s before the domain service",
    async (field) => {
      const response = await send(
        mutation("signing-requests", { ...sendBody(), [field]: "forged" }),
      );
      assertPrivate(response, 422);
      expect((await response.json()).error.code).toBe("VALIDATION_ERROR");
      expect(mocks.send).not.toHaveBeenCalled();
    },
  );

  it.each([
    { code: accountCode, email: "synthetic@example.invalid" },
    { code: accountCode, actor_id: ownerId },
    { code: "DVP-0123*" },
    { code: "synthetic@example.invalid" },
  ])(
    "rejects directory-style or extra recipient lookup input",
    async (body) => {
      const response = await lookupRoutes.POST(
        mutation("recipients/lookup", body),
      );
      assertPrivate(response, 422);
      expect(mocks.lookup).not.toHaveBeenCalled();
    },
  );

  it.each([null, "not-a-uuid", "../../secret"])(
    "requires a UUID idempotency key (%s) before consuming the invitation body",
    async (idempotencyKey) => {
      const input = mutation(
        "signing-requests",
        sendBody(),
        origin,
        idempotencyKey,
      );
      const response = await send(input);
      assertPrivate(response, 400);
      expect((await response.json()).error.code).toBe(
        "INVALID_IDEMPOTENCY_KEY",
      );
      expect(input.bodyUsed).toBe(false);
      expect(mocks.send).not.toHaveBeenCalled();
    },
  );

  it.each([
    { sharingConsent: false },
    { sharingConsent: "true" },
    { sharingPolicyVersion: "development-2026-11-04" },
    { sourceVersionId: "object/path.pdf" },
    { recipientId: "synthetic@example.invalid" },
  ])(
    "requires explicit new sharing consent and typed resources",
    async (extra) => {
      const response = await send(
        mutation("signing-requests", { ...sendBody(), ...extra }),
      );
      assertPrivate(response, 422);
      expect(mocks.send).not.toHaveBeenCalled();
    },
  );

  it("bounds actual HTTP JSON bytes before recipient lookup", async () => {
    const response = await lookupRoutes.POST(
      mutation("recipients/lookup", { code: "é".repeat(2300) }),
    );
    assertPrivate(response, 413);
    expect((await response.json()).error.code).toBe("REQUEST_TOO_LARGE");
    expect(mocks.lookup).not.toHaveBeenCalled();
  });

  it("redacts malformed JSON rather than echoing the body", async () => {
    const input = new Request(`${origin}/api/v2/signing-requests`, {
      method: "POST",
      headers: {
        origin,
        "content-type": "application/json",
        "idempotency-key": key,
      },
      body: "private malformed recipient code",
    });
    const response = await send(input);
    assertPrivate(response, 400);
    expect(await response.text()).not.toContain(
      "private malformed recipient code",
    );
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it("creates a pending invitation with201, forwarding only approved input and idempotency key", async () => {
    const response = await send(mutation("signing-requests", sendBody()));
    assertPrivate(response, 201);
    expect(mocks.send).toHaveBeenCalledExactlyOnceWith(sendBody(), key);
    const body = await response.json();
    expect(body.data.status).toBe("pending");
    expect(body.data).not.toHaveProperty("qr");
    expect(body.data).not.toHaveProperty("verificationCode");
  });

  it("cancels by awaited route ID without accepting authority from a body", async () => {
    const input = mutation(`signing-requests/${requestId}/cancel`, {
      requestId: "forged",
      actor_id: recipientId,
      status: "completed",
    });
    const response = await cancel(input, requestContext());
    assertPrivate(response, 200);
    expect(mocks.cancel).toHaveBeenCalledExactlyOnceWith(requestId);
    expect((await response.json()).data.status).toBe("cancelled");
    expect(input.bodyUsed).toBe(false);
  });

  it("authenticates request lists before scope validation", async () => {
    mocks.session.mockResolvedValue(null);
    const response = await requests(
      new Request(
        `${origin}/api/v2/signing-requests?scope=all&owner_id=${recipientId}`,
      ),
    );
    assertPrivate(response, 401);
    expect(mocks.requests).not.toHaveBeenCalled();
  });

  it.each(["scope=all", "owner_id=forged", "status=completed", "q=someone"])(
    "rejects unsupported invitation list query %s",
    async (query) => {
      const response = await requests(
        new Request(`${origin}/api/v2/signing-requests?${query}`),
      );
      assertPrivate(response, 422);
      expect(mocks.requests).not.toHaveBeenCalled();
    },
  );

  it("defaults to received invitations and forwards bounded-list inputs to the guarded DAL", async () => {
    assertPrivate(
      await requests(new Request(`${origin}/api/v2/signing-requests`)),
      200,
    );
    expect(mocks.requests).toHaveBeenLastCalledWith({ scope: "received" });
    assertPrivate(
      await requests(
        new Request(
          `${origin}/api/v2/signing-requests?scope=sent&cursor=opaque&limit=5`,
        ),
      ),
      200,
    );
    expect(mocks.requests).toHaveBeenLastCalledWith({
      scope: "sent",
      cursor: "opaque",
      limit: "5",
    });
  });

  it("keeps own-code and draft lists private without fabricating counts", async () => {
    const codeResponse = await code();
    assertPrivate(codeResponse, 200);
    expect((await codeResponse.json()).data.code).toBe(accountCode);
    const response = await documents(
      new Request(`${origin}/api/v2/signing-documents?cursor=opaque&limit=5`),
    );
    assertPrivate(response, 200);
    expect(mocks.documents).toHaveBeenCalledExactlyOnceWith({
      cursor: "opaque",
      limit: "5",
    });
    expect((await response.json()).data).toEqual({
      items: [],
      hasMore: false,
      cursor: null,
    });
  });

  it("forwards upload intact to its guarded domain service and returns only a draft", async () => {
    const input = new Request(`${origin}/api/v2/signing-documents`, {
      method: "POST",
    });
    const response = await upload(input);
    assertPrivate(response, 201);
    expect(mocks.upload).toHaveBeenCalledExactlyOnceWith(input);
    expect((await response.json()).data.status).toBe("draft");
  });

  it("returns generic404 for out-of-scope document and request without echoing identifiers", async () => {
    const documentResponse = await document(
      new Request(`${origin}/api/v2/signing-documents/${documentId}`),
      documentContext(),
    );
    const requestResponse = await requestDetail(
      new Request(`${origin}/api/v2/signing-requests/${requestId}`),
      requestContext(),
    );
    for (const response of [documentResponse, requestResponse]) {
      assertPrivate(response, 404);
      const body = await response.json();
      expect(body.error.code).toBe("NOT_FOUND");
      expect(JSON.stringify(body)).not.toMatch(
        new RegExp(`${documentId}|${requestId}`),
      );
    }
  });

  it("preserves private PDF bytes rather than returning a Storage bearer URL", async () => {
    const pdf = new Response("%PDF-1.7\nsynthetic", {
      headers: {
        "content-type": "application/pdf",
        "cache-control": "private, no-store",
        vary: "Cookie",
      },
    });
    mocks.file.mockResolvedValue(pdf);
    const input = new Request(
      `${origin}/api/v2/signing-documents/${documentId}/file?versionId=${sourceVersionId}`,
    );
    const response = await file(input, documentContext());
    expect(response).toBe(pdf);
    expect(mocks.file).toHaveBeenCalledExactlyOnceWith(input, documentId);
  });

  it("preserves a safe domain error but redacts unexpected provider details", async () => {
    mocks.lookup.mockRejectedValueOnce(
      new ApiError(429, "RATE_LIMITED", "Tunggu beberapa saat."),
    );
    let response = await lookupRoutes.POST(
      mutation("recipients/lookup", { code: accountCode }),
    );
    assertPrivate(response, 429);
    expect((await response.json()).error.code).toBe("RATE_LIMITED");
    mocks.lookup.mockRejectedValueOnce(
      new Error("secret SQL storage_path provider detail"),
    );
    response = await lookupRoutes.POST(
      mutation("recipients/lookup", { code: accountCode }),
    );
    assertPrivate(response, 500);
    expect(await response.text()).not.toMatch(
      /secret SQL|storage_path|provider detail|stack/,
    );
  });
});
