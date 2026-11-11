import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

type Reply = { data: unknown; error: unknown };
const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  configuration: vi.fn(),
  legacyConfiguration: vi.fn(),
  authConfiguration: vi.fn(),
  createPrivilegedClient: vi.fn(),
  rpc: vi.fn(),
  derive: vi.fn(),
  replies: {} as Record<string, Reply[]>,
}));
vi.mock("server-only", () => ({}));
vi.mock("@/server/api", () => ({ apiSession: mocks.session }));
vi.mock("@/server/signing/config", () => ({
  getSigningConfiguration: mocks.configuration,
}));
vi.mock("@/server/documents/config", () => ({
  getSubmissionConfiguration: mocks.legacyConfiguration,
}));
vi.mock("@/lib/auth/config", () => ({
  getAuthConfiguration: mocks.authConfiguration,
}));
vi.mock("@/lib/supabase/privileged", () => ({
  createPrivilegedSupabaseClient: mocks.createPrivilegedClient,
}));
vi.mock("@/server/documents/upload", () => ({ derivedUploadId: mocks.derive }));

import { ApiError } from "@/server/errors";
import { mapSigningDatabaseError } from "@/server/signing/errors";
import {
  cancelSigningRequest,
  lookupSigningRecipient,
  sendSigningRequest,
} from "@/server/signing/mutations";
import {
  SIGNING_SHARING_POLICY_VERSION,
  SIGNING_UPLOAD_POLICY_VERSION,
} from "@/lib/signing/policy";

const owner = "10000000-0000-4000-8000-000000000001";
const recipient = "10000000-0000-4000-8000-000000000002";
const documentId = "20000000-0000-4000-8000-000000000001";
const versionId = "30000000-0000-4000-8000-000000000001";
const requestId = "40000000-0000-8000-8000-000000000001";
const key = "50000000-0000-4000-8000-000000000001";
const code = "DVP-1234567890ABCDEF1234";
const flowSecret = "unit-test-only-flow-secret-with-32-characters";
function reply(data: unknown): Reply {
  return { data, error: null };
}
function input() {
  return {
    sourceVersionId: versionId,
    recipientCode: code,
    recipientId: recipient,
    sharingPolicyVersion: SIGNING_SHARING_POLICY_VERSION,
    sharingConsent: true as const,
  };
}
function receipt(extra: Record<string, unknown> = {}) {
  return {
    requestId,
    documentId,
    sourceVersionId: versionId,
    status: "pending",
    sentAt: "2026-11-05T00:00:00.000Z",
    expiresAt: "2026-11-12T00:00:00.000Z",
    cancelledAt: null,
    ...extra,
  };
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.replies = {};
  mocks.session.mockResolvedValue({
    user: { id: owner, emailConfirmed: true },
    roles: ["user"],
  });
  mocks.configuration.mockReturnValue({
    environment: "development",
    sharingPolicyVersion: SIGNING_SHARING_POLICY_VERSION,
  });
  mocks.legacyConfiguration.mockReturnValue({
    maxBytes: 10 * 1024 * 1024,
    environment: "development",
    policyVersion: "legacy-review-policy",
  });
  mocks.authConfiguration.mockReturnValue({ flowSecret });
  mocks.derive.mockReturnValue(requestId);
  mocks.createPrivilegedClient.mockReturnValue({ rpc: mocks.rpc });
  mocks.rpc.mockImplementation(async (name: string) => {
    const configured = mocks.replies[name]?.shift();
    if (configured) return configured;
    if (name === "consume_signing_operation_limit") return reply(true);
    if (name === "lookup_signing_recipient")
      return reply({ id: recipient, code, displayName: "Synthetic recipient" });
    if (name === "cancel_signing_request")
      return reply(
        receipt({
          status: "cancelled",
          cancelledAt: "2026-11-05T01:00:00.000Z",
        }),
      );
    return reply(receipt());
  });
});

describe("signing mutation contracts (mocked SDK; no cloud writes)", () => {
  it.each([
    ["lookup", () => lookupSigningRecipient(code)],
    ["send", () => sendSigningRequest(input(), key)],
    ["cancel", () => cancelSigningRequest(requestId)],
  ] as const)(
    "authenticates %s before configuration and privileged work",
    async (_name, run) => {
      mocks.session.mockRejectedValue(
        new ApiError(401, "UNAUTHENTICATED", "Masuk dahulu."),
      );
      await expect(run()).rejects.toMatchObject({
        status: 401,
        code: "UNAUTHENTICATED",
      });
      expect(mocks.configuration).not.toHaveBeenCalled();
      expect(mocks.createPrivilegedClient).not.toHaveBeenCalled();
    },
  );

  it.each([
    [
      "unverified",
      { user: { id: owner, emailConfirmed: false }, roles: ["user"] },
    ],
    [
      "admin role alone",
      { user: { id: owner, emailConfirmed: true }, roles: ["platform_admin"] },
    ],
    [
      "reviewer role alone",
      { user: { id: owner, emailConfirmed: true }, roles: ["reviewer"] },
    ],
  ] as const)(
    "denies all signing operations for %s before privileged work",
    async (_name, session) => {
      mocks.session.mockResolvedValue(session);
      for (const run of [
        () => lookupSigningRecipient(code),
        () => sendSigningRequest(input(), key),
        () => cancelSigningRequest(requestId),
      ])
        await expect(run()).rejects.toMatchObject({ status: 403 });
      expect(mocks.createPrivilegedClient).not.toHaveBeenCalled();
    },
  );

  it("checks the development environment before privileged work", async () => {
    mocks.configuration.mockImplementation(() => {
      throw new ApiError(
        503,
        "UPLOAD_UNAVAILABLE",
        "Lingkungan belum tersedia.",
      );
    });
    await expect(lookupSigningRecipient(code)).rejects.toMatchObject({
      status: 503,
    });
    expect(mocks.createPrivilegedClient).not.toHaveBeenCalled();
  });

  it("uses normalized exact recipient code and returns no contact data", async () => {
    mocks.replies.lookup_signing_recipient = [
      reply({
        id: recipient,
        code,
        displayName: "Synthetic recipient",
        email: "hidden-contact",
        phone: "hidden-phone",
      }),
    ];
    expect(await lookupSigningRecipient("dvp-12345-67890-abcde-f1234")).toEqual(
      { id: recipient, code, displayName: "Synthetic recipient" },
    );
    expect(mocks.rpc).toHaveBeenNthCalledWith(2, "lookup_signing_recipient", {
      p_actor_id: owner,
      p_code: code,
    });
    expect(mocks.rpc.mock.calls.every(([name]) => name !== "execute_sql")).toBe(
      true,
    );
  });

  it.each(["", "DVP-1234", "DVP-1234567890ABCDEF1234%", "a".repeat(65)])(
    "rejects malformed lookup %s before privileged work",
    async (value) => {
      await expect(lookupSigningRecipient(value)).rejects.toMatchObject({
        status: 422,
      });
      expect(mocks.createPrivilegedClient).not.toHaveBeenCalled();
    },
  );

  it("uses the same unavailable error for self and an ineligible recipient", async () => {
    mocks.replies.lookup_signing_recipient = [
      reply({ id: owner, code, displayName: "Synthetic self" }),
      {
        data: null,
        error: { code: "P0001", message: "SIGNING_RECIPIENT_UNAVAILABLE" },
      },
    ];
    const errors = [];
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        await lookupSigningRecipient(code);
      } catch (error) {
        errors.push(error);
      }
    }
    expect(errors).toHaveLength(2);
    for (const error of errors)
      expect(error).toMatchObject({
        status: 404,
        code: "RECIPIENT_UNAVAILABLE",
        message: "Penerima tidak tersedia. Periksa kode akun yang diberikan.",
      });
  });

  it.each([
    ["lookup", () => lookupSigningRecipient(code)],
    ["send", () => sendSigningRequest(input(), key)],
    ["cancel", () => cancelSigningRequest(requestId)],
  ] as const)(
    "persistently limits %s with actor and application HMAC digests",
    async (action, run) => {
      await run();
      const hmac = (value: string) =>
        createHmac("sha256", flowSecret).update(value).digest("hex");
      expect(mocks.rpc).toHaveBeenNthCalledWith(
        1,
        "consume_signing_operation_limit",
        {
          p_action: action,
          p_key_digest: hmac(`signing\0${action}\0${owner}`),
          p_global_digest: hmac(`signing\0${action}\0application`),
        },
      );
      const limiter = JSON.stringify(mocks.rpc.mock.calls[0]);
      expect(limiter).not.toContain(owner);
      expect(limiter).not.toContain(flowSecret);
      expect(limiter).not.toContain(code);
    },
  );

  it("stops at the persistent rate limit before looking up or mutating data", async () => {
    mocks.replies.consume_signing_operation_limit = [
      reply(false),
      reply(false),
      reply(false),
    ];
    for (const run of [
      () => lookupSigningRecipient(code),
      () => sendSigningRequest(input(), key),
      () => cancelSigningRequest(requestId),
    ])
      await expect(run()).rejects.toMatchObject({
        status: 429,
        code: "RATE_LIMITED",
      });
    expect(mocks.rpc).toHaveBeenCalledTimes(3);
    expect(
      mocks.rpc.mock.calls.every(
        ([name]) => name === "consume_signing_operation_limit",
      ),
    ).toBe(true);
  });

  it("fails closed when the limiter fails or does not return a boolean", async () => {
    mocks.replies.consume_signing_operation_limit = [
      { data: null, error: { message: "private limiter detail" } },
      reply("true"),
    ];
    for (let attempt = 0; attempt < 2; attempt++)
      await expect(lookupSigningRecipient(code)).rejects.toMatchObject({
        status: 503,
        message: expect.not.stringContaining("private"),
      });
    expect(mocks.rpc).toHaveBeenCalledTimes(2);
  });

  it("derives the request ID and trusts only the verified session actor", async () => {
    expect(await sendSigningRequest(input(), key)).toEqual(receipt());
    expect(mocks.derive).toHaveBeenCalledWith(
      owner,
      key,
      `signing-request:${versionId}`,
    );
    expect(mocks.rpc).toHaveBeenNthCalledWith(2, "send_signing_request", {
      p_actor_id: owner,
      p_request_id: requestId,
      p_source_version_id: versionId,
      p_recipient_code: code,
      p_recipient_id: recipient,
      p_sharing_policy_version: SIGNING_SHARING_POLICY_VERSION,
      p_sharing_consent: true,
    });
  });

  it("allows administrators who also participate as normal users without adding privileges", async () => {
    mocks.session.mockResolvedValue({
      user: { id: owner, emailConfirmed: true },
      roles: ["user", "platform_admin"],
    });
    await sendSigningRequest(input(), key);
    expect(mocks.rpc).toHaveBeenNthCalledWith(
      2,
      "send_signing_request",
      expect.objectContaining({ p_actor_id: owner }),
    );
    expect(mocks.createPrivilegedClient).toHaveBeenCalledTimes(1);
  });

  it.each([
    { actorId: recipient },
    { ownerId: recipient },
    { recipientEmail: "forged@example.invalid" },
    { sharingPolicyVersion: "development-2026-11-04" },
    { sharingConsent: false },
    { sourceVersionId: "invalid" },
  ])(
    "rejects injected authority, invalid input and legacy consent before RPC",
    async (extra) => {
      const candidate = Object.assign(input(), extra);
      await expect(sendSigningRequest(candidate, key)).rejects.toMatchObject({
        status: 422,
      });
      expect(mocks.createPrivilegedClient).not.toHaveBeenCalled();
    },
  );

  it("requires a valid explicit idempotency key before RPC", async () => {
    await expect(sendSigningRequest(input(), "")).rejects.toMatchObject({
      status: 400,
      code: "INVALID_IDEMPOTENCY_KEY",
    });
    expect(mocks.createPrivilegedClient).not.toHaveBeenCalled();
  });

  it("retries send with the same derived ID and lets the locked RPC enforce idempotency", async () => {
    const first = await sendSigningRequest(input(), key);
    const second = await sendSigningRequest(input(), key);
    expect(second).toEqual(first);
    const sendCalls = mocks.rpc.mock.calls.filter(
      ([name]) => name === "send_signing_request",
    );
    expect(sendCalls).toHaveLength(2);
    expect(sendCalls[0]).toEqual(sendCalls[1]);
  });

  it("cancels by verified actor and ID, including idempotent cancellation retries", async () => {
    const first = await cancelSigningRequest(requestId);
    expect(await cancelSigningRequest(requestId)).toEqual(first);
    const cancelCalls = mocks.rpc.mock.calls.filter(
      ([name]) => name === "cancel_signing_request",
    );
    expect(cancelCalls).toEqual([
      [
        "cancel_signing_request",
        { p_actor_id: owner, p_request_id: requestId },
      ],
      [
        "cancel_signing_request",
        { p_actor_id: owner, p_request_id: requestId },
      ],
    ]);
  });

  it("returns generic not-found for a malformed cancellation ID", async () => {
    await expect(cancelSigningRequest("invalid")).rejects.toMatchObject({
      status: 404,
      code: "NOT_FOUND",
    });
    expect(mocks.createPrivilegedClient).not.toHaveBeenCalled();
  });

  it("rejects inconsistent RPC receipts instead of showing false success", async () => {
    mocks.replies.send_signing_request = [reply(receipt({ requestId: key }))];
    mocks.replies.cancel_signing_request = [reply(receipt())];
    await expect(sendSigningRequest(input(), key)).rejects.toMatchObject({
      status: 503,
    });
    await expect(cancelSigningRequest(requestId)).rejects.toMatchObject({
      status: 503,
    });
  });

  it("sanitizes unexpected SDK throws without exposing their contents", async () => {
    mocks.rpc.mockRejectedValue(
      new Error("secret-token-in-private-SDK-detail"),
    );
    await expect(lookupSigningRecipient(code)).rejects.toMatchObject({
      status: 503,
      message: expect.not.stringContaining("secret-token"),
    });
  });
});

describe("static signing database error mapping", () => {
  it.each([
    ["22023", "INVALID_SIGNING_INPUT", 422, "VALIDATION_ERROR"],
    ["42501", "SIGNING_ACTOR_REQUIRED", 403, "SIGNING_NOT_ALLOWED"],
    ["P0002", "SIGNING_NOT_FOUND", 404, "NOT_FOUND"],
    ["P0001", "SIGNING_RECIPIENT_UNAVAILABLE", 404, "RECIPIENT_UNAVAILABLE"],
    ["P0001", "SIGNING_IDEMPOTENCY_CONFLICT", 409, "IDEMPOTENCY_CONFLICT"],
    ["P0001", "SIGNING_DOCUMENT_NOT_ELIGIBLE", 409, "DOCUMENT_NOT_ELIGIBLE"],
    ["P0001", "SIGNING_REQUEST_EXPIRED", 409, "REQUEST_EXPIRED"],
    ["P0001", "SIGNING_REQUEST_NOT_ELIGIBLE", 409, "REQUEST_NOT_ELIGIBLE"],
  ] as const)(
    "maps %s/%s to the safe %i/%s response",
    (dbCode, message, status, code) => {
      const result = mapSigningDatabaseError({ code: dbCode, message });
      expect(result).toMatchObject({ status, code });
      expect(result.message).not.toContain(message);
    },
  );

  it.each([
    null,
    { code: "PGRST202", message: "private SQL signature" },
    { code: "42501", message: "different internal error" },
    { code: "P0001", message: "private business detail" },
    { code: "22023", message: "SIGNING_ACTOR_REQUIRED" },
  ])("does not expose unknown database errors", (error) => {
    expect(mapSigningDatabaseError(error)).toMatchObject({
      status: 503,
      code: "SIGNING_UNAVAILABLE",
      message:
        "Layanan persetujuan internal sementara tidak tersedia. Silakan coba kembali.",
    });
  });
});

describe("separate approved development policy configuration", () => {
  it("reuses the existing development gate without inheriting the legacy review consent", async () => {
    const { getSigningConfiguration } = await vi.importActual<
      typeof import("@/server/signing/config")
    >("@/server/signing/config");
    expect(getSigningConfiguration()).toEqual({
      maxBytes: 10 * 1024 * 1024,
      environment: "development",
      uploadPolicyVersion: SIGNING_UPLOAD_POLICY_VERSION,
      sharingPolicyVersion: SIGNING_SHARING_POLICY_VERSION,
    });
    expect(mocks.legacyConfiguration).toHaveBeenCalledTimes(1);
  });

  it("retains the loopback gate failure", async () => {
    const { getSigningConfiguration } = await vi.importActual<
      typeof import("@/server/signing/config")
    >("@/server/signing/config");
    mocks.legacyConfiguration.mockImplementation(() => {
      throw new ApiError(
        503,
        "UPLOAD_UNAVAILABLE",
        "Lingkungan belum tersedia.",
      );
    });
    expect(() => getSigningConfiguration()).toThrow(ApiError);
  });
});
