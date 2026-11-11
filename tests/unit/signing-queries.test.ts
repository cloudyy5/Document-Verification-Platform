import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Reply = { data: unknown; error: unknown };
type Query = {
  table: string;
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  limit: ReturnType<typeof vi.fn>;
  or: ReturnType<typeof vi.fn>;
  in: ReturnType<typeof vi.fn>;
  maybeSingle: ReturnType<typeof vi.fn>;
  then: (
    resolve: (reply: Reply) => unknown,
    reject: (error: unknown) => unknown,
  ) => Promise<unknown>;
};
const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  configuration: vi.fn(),
  createClient: vi.fn(),
  createPrivilegedClient: vi.fn(),
  from: vi.fn(),
  queries: [] as Query[],
  replies: {} as Record<string, Reply[]>,
}));
vi.mock("server-only", () => ({}));
vi.mock("@/server/api", () => ({ apiSession: mocks.session }));
vi.mock("@/server/signing/config", () => ({
  getSigningConfiguration: mocks.configuration,
}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: mocks.createClient,
}));
vi.mock("@/lib/supabase/privileged", () => ({
  createPrivilegedSupabaseClient: mocks.createPrivilegedClient,
}));
vi.mock("@/server/signing/mutations", () => ({
  cancelSigningRequest: vi.fn(),
  lookupSigningRecipient: vi.fn(),
  sendSigningRequest: vi.fn(),
}));

import { ApiError } from "@/server/errors";
import {
  getSigningDocument,
  getSigningDocuments,
  getSigningRequest,
  getSigningRequests,
  getSigningUserCode,
} from "@/server/signing/queries";

const owner = "10000000-0000-4000-8000-000000000001";
const recipient = "10000000-0000-4000-8000-000000000002";
const other = "10000000-0000-4000-8000-000000000003";
const documentId = "20000000-0000-4000-8000-000000000001";
const versionId = "30000000-0000-4000-8000-000000000001";
const requestId = "40000000-0000-4000-8000-000000000001";
const categoryId = "50000000-0000-4000-8000-000000000001";
const timestamp = "2026-11-05T00:00:00.000Z";
const expiresAt = "2026-11-12T00:00:00.000Z";
const code = "DVP-1234567890ABCDEF1234";
function reply(data: unknown): Reply {
  return { data, error: null };
}
function version(extra: Record<string, unknown> = {}) {
  return {
    id: versionId,
    document_id: documentId,
    owner_id: owner,
    version_no: 1,
    title: "Synthetic private document",
    category_id: categoryId,
    custom_document_type: null,
    document_date: null,
    issuing_institution: null,
    description: null,
    original_filename: "synthetic-private.pdf",
    file_size_bytes: 2800,
    source_sha256: "a".repeat(64),
    created_at: timestamp,
    ...extra,
  };
}
function requestRow(extra: Record<string, unknown> = {}) {
  return {
    id: requestId,
    document_id: documentId,
    source_version_id: versionId,
    owner_id: owner,
    recipient_id: recipient,
    owner_display_name: "Synthetic owner",
    recipient_display_name: "Synthetic recipient",
    status: "pending",
    sent_at: timestamp,
    expires_at: expiresAt,
    cancelled_at: null,
    ...extra,
  };
}
function builder(table: string): Query {
  const result = mocks.replies[table]?.shift() ?? reply([]);
  const query: Query = {
    table,
    select: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    or: vi.fn(),
    in: vi.fn(),
    maybeSingle: vi.fn(),
    then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
  };
  for (const method of [
    "select",
    "eq",
    "order",
    "limit",
    "or",
    "in",
    "maybeSingle",
  ] as const)
    query[method].mockReturnValue(query);
  mocks.queries.push(query);
  return query;
}
function setUser(id: string, roles = ["user"]) {
  mocks.session.mockResolvedValue({
    user: { id, emailConfirmed: true },
    roles,
  });
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-05T12:00:00.000Z"));
  mocks.queries = [];
  mocks.replies = {};
  setUser(owner);
  mocks.configuration.mockReturnValue({ environment: "development" });
  mocks.from.mockImplementation(builder);
  mocks.createClient.mockResolvedValue({ from: mocks.from });
});
afterEach(() => vi.useRealTimers());

describe("signing DAL query contracts (mocked SDK; native database tests prove RLS)", () => {
  it.each([
    ["own code", () => getSigningUserCode()],
    ["own drafts", () => getSigningDocuments()],
    ["document detail", () => getSigningDocument(documentId)],
    ["received requests", () => getSigningRequests({ scope: "received" })],
    ["sent requests", () => getSigningRequests({ scope: "sent" })],
    ["request detail", () => getSigningRequest(requestId)],
  ] as const)(
    "authenticates %s before configuration or data access",
    async (_name, run) => {
      mocks.session.mockRejectedValue(
        new ApiError(401, "UNAUTHENTICATED", "Masuk dahulu."),
      );
      await expect(run()).rejects.toMatchObject({
        status: 401,
        code: "UNAUTHENTICATED",
      });
      expect(mocks.configuration).not.toHaveBeenCalled();
      expect(mocks.createClient).not.toHaveBeenCalled();
      expect(mocks.createPrivilegedClient).not.toHaveBeenCalled();
    },
  );

  it("reads the immutable own code without allocating or exposing the user ID", async () => {
    mocks.replies.signing_user_identifiers = [
      reply({
        user_id: owner,
        code,
        created_at: timestamp,
        email: "hidden-contact",
      }),
    ];
    expect(await getSigningUserCode()).toEqual({ code, createdAt: timestamp });
    expect(mocks.queries[0]!.eq).toHaveBeenCalledWith("user_id", owner);
    expect(mocks.createPrivilegedClient).not.toHaveBeenCalled();
  });

  it("does not fabricate a code when migration or identifier is unavailable", async () => {
    mocks.replies.signing_user_identifiers = [reply(null)];
    await expect(getSigningUserCode()).rejects.toMatchObject({
      status: 503,
      code: "SIGNING_UNAVAILABLE",
    });
    expect(mocks.createPrivilegedClient).not.toHaveBeenCalled();
  });

  it.each([["user"], ["user", "reviewer"], ["user", "platform_admin"]])(
    "keeps document lists owner-scoped for roles %j",
    async (...roles) => {
      setUser(owner, roles);
      mocks.replies.signing_document_versions = [
        reply([version({ owner_id: other })]),
      ];
      await expect(getSigningDocuments()).rejects.toMatchObject({
        status: 503,
      });
      expect(mocks.queries[0]!.eq).toHaveBeenCalledWith("owner_id", owner);
      expect(mocks.createPrivilegedClient).not.toHaveBeenCalled();
    },
  );

  it("emits minimal owner draft DTOs and never selects storage or contact data", async () => {
    mocks.replies.signing_document_versions = [
      reply([
        version({ storage_path: "hidden-path", email: "hidden-contact" }),
      ]),
    ];
    mocks.replies.signing_requests = [reply([])];
    const result = await getSigningDocuments();
    expect(result).toMatchObject({
      hasMore: false,
      cursor: null,
      items: [{ id: documentId, versionId, isOwner: true, request: null }],
    });
    expect(mocks.queries[0]!.limit).toHaveBeenCalledWith(21);
    expect(mocks.queries[0]!.order).toHaveBeenNthCalledWith(1, "created_at", {
      ascending: false,
    });
    expect(mocks.queries[0]!.order).toHaveBeenNthCalledWith(2, "id", {
      ascending: false,
    });
    for (const query of mocks.queries)
      expect(query.select.mock.calls.flat().join()).not.toMatch(
        /storage_path|email|phone|\*/,
      );
    expect(JSON.stringify(result)).not.toMatch(
      /hidden-path|hidden-contact|owner_id/,
    );
    expect(mocks.createPrivilegedClient).not.toHaveBeenCalled();
  });

  it("keeps a stable bounded cursor across document pages", async () => {
    const nextId = "30000000-0000-4000-8000-000000000002";
    mocks.replies.signing_document_versions = [
      reply([version(), version({ id: nextId })]),
      reply([]),
    ];
    mocks.replies.signing_requests = [reply([])];
    const result = await getSigningDocuments({ limit: "1" });
    expect(result.items).toHaveLength(1);
    expect(result.hasMore).toBe(true);
    expect(
      JSON.parse(Buffer.from(result.cursor!, "base64url").toString()),
    ).toEqual({ at: timestamp, id: versionId });
    await getSigningDocuments({ limit: 1, cursor: result.cursor });
    const next = mocks.queries.at(-1)!;
    expect(next.eq).toHaveBeenCalledWith("owner_id", owner);
    expect(next.or).toHaveBeenCalledWith(
      `created_at.lt.${timestamp},and(created_at.eq.${timestamp},id.lt.${versionId})`,
    );
  });

  it.each([
    { limit: 0 },
    { limit: 51 },
    { limit: "1.5" },
    { cursor: "!invalid" },
    { cursor: "a".repeat(513) },
    { owner_id: other },
    {
      cursor: Buffer.from(
        JSON.stringify({
          at: `${timestamp},owner_id.eq.${other}`,
          id: versionId,
        }),
      ).toString("base64url"),
    },
    {
      cursor: Buffer.from(
        JSON.stringify({ at: timestamp, id: versionId, owner_id: other }),
      ).toString("base64url"),
    },
  ])(
    "rejects malformed or authority-changing list input before selecting rows",
    async (input) => {
      await expect(getSigningDocuments(input)).rejects.toMatchObject({
        status: 422,
        code: "VALIDATION_ERROR",
      });
      expect(mocks.from).not.toHaveBeenCalled();
    },
  );

  it("returns the same absence for a revoked recipient, missing or malformed document", async () => {
    setUser(recipient);
    mocks.replies.signing_document_versions = [reply(null), reply(null)];
    expect(await getSigningDocument(documentId)).toBeNull();
    expect(
      await getSigningDocument("20000000-0000-4000-8000-000000000099"),
    ).toBeNull();
    expect(await getSigningDocument("invalid")).toBeNull();
    expect(mocks.queries).toHaveLength(2);
    expect(mocks.createPrivilegedClient).not.toHaveBeenCalled();
  });

  it("returns invited recipient content only from the RLS-readable exact version", async () => {
    setUser(recipient);
    mocks.replies.signing_document_versions = [reply(version())];
    mocks.replies.signing_requests = [reply([requestRow()])];
    const result = await getSigningDocument(documentId);
    expect(result).toMatchObject({
      id: documentId,
      versionId,
      isOwner: false,
      request: { isOwner: false, canReadFile: true, status: "pending" },
    });
    expect(mocks.queries[0]!.eq).not.toHaveBeenCalledWith(
      "owner_id",
      recipient,
    );
    expect(mocks.queries[1]!.in).toHaveBeenCalledWith("source_version_id", [
      versionId,
    ]);
    expect(mocks.createPrivilegedClient).not.toHaveBeenCalled();
  });

  it("fails closed on mismatched version/request ownership", async () => {
    mocks.replies.signing_document_versions = [reply(version())];
    mocks.replies.signing_requests = [
      reply([requestRow({ owner_id: other, recipient_id: owner })]),
    ];
    await expect(getSigningDocument(documentId)).rejects.toMatchObject({
      status: 503,
    });
  });

  it.each(["cancelled", "rejected", "expired"])(
    "keeps minimum recipient %s history while withholding metadata",
    async (state) => {
      setUser(recipient);
      mocks.replies.signing_requests = [
        reply(
          requestRow({
            status: state === "expired" ? "pending" : state,
            expires_at:
              state === "expired" ? "2026-11-05T10:00:00.000Z" : expiresAt,
            cancelled_at:
              state === "cancelled" ? "2026-11-05T11:00:00.000Z" : null,
          }),
        ),
      ];
      mocks.replies.signing_document_versions = [reply([])];
      const result = await getSigningRequest(requestId);
      expect(result).toMatchObject({
        document: null,
        request: {
          status: state,
          documentTitle: null,
          canReadFile: false,
          isOwner: false,
        },
      });
      expect(JSON.stringify(result)).not.toMatch(
        /Synthetic private document|synthetic-private\.pdf|source_sha256/,
      );
      expect(mocks.createPrivilegedClient).not.toHaveBeenCalled();
    },
  );

  it("retains owner access to a cancelled request's immutable source", async () => {
    mocks.replies.signing_requests = [
      reply(requestRow({ status: "cancelled", cancelled_at: timestamp })),
    ];
    mocks.replies.signing_document_versions = [reply([version()])];
    expect(await getSigningRequest(requestId)).toMatchObject({
      request: {
        status: "cancelled",
        documentTitle: "Synthetic private document",
        isOwner: true,
        canReadFile: true,
      },
      document: { id: documentId, isOwner: true },
    });
  });

  it.each(["consented", "completed"])(
    "retains a recipient's RLS-granted %s source after the invitation deadline",
    async (state) => {
      setUser(recipient);
      mocks.replies.signing_requests = [
        reply(
          requestRow({ status: state, expires_at: "2026-11-05T10:00:00.000Z" }),
        ),
      ];
      mocks.replies.signing_document_versions = [reply([version()])];
      expect(await getSigningRequest(requestId)).toMatchObject({
        request: { status: state, canReadFile: true },
        document: { versionId, isOwner: false },
      });
    },
  );

  it("ignores unavailable metadata instead of filling it using privileged reads", async () => {
    setUser(recipient);
    mocks.replies.signing_requests = [reply([requestRow()])];
    mocks.replies.signing_document_versions = [reply([])];
    const result = await getSigningRequests({ scope: "received" });
    expect(result.items[0]).toMatchObject({
      documentTitle: null,
      canReadFile: false,
    });
    expect(mocks.queries[0]!.eq).toHaveBeenCalledWith(
      "recipient_id",
      recipient,
    );
    expect(mocks.queries[1]!.in).toHaveBeenCalledWith("id", [versionId]);
    expect(mocks.createPrivilegedClient).not.toHaveBeenCalled();
  });

  it("pages sent requests by sent_at and ID without changing owner scope", async () => {
    mocks.replies.signing_requests = [
      reply([
        requestRow(),
        requestRow({ id: "40000000-0000-4000-8000-000000000002" }),
      ]),
      reply([]),
    ];
    mocks.replies.signing_document_versions = [reply([version()])];
    const first = await getSigningRequests({ scope: "sent", limit: 1 });
    expect(first.hasMore).toBe(true);
    await getSigningRequests({
      scope: "sent",
      limit: 1,
      cursor: first.cursor!,
    });
    const next = mocks.queries.at(-1)!;
    expect(next.eq).toHaveBeenCalledWith("owner_id", owner);
    expect(next.or).toHaveBeenCalledWith(
      `sent_at.lt.${timestamp},and(sent_at.eq.${timestamp},id.lt.${requestId})`,
    );
    expect(next.order).toHaveBeenNthCalledWith(1, "sent_at", {
      ascending: false,
    });
    expect(next.order).toHaveBeenNthCalledWith(2, "id", { ascending: false });
  });

  it("does not widen sent scope for an administrator", async () => {
    setUser(owner, ["user", "platform_admin"]);
    mocks.replies.signing_requests = [
      reply([requestRow({ owner_id: other, recipient_id: owner })]),
    ];
    await expect(getSigningRequests({ scope: "sent" })).rejects.toMatchObject({
      status: 503,
    });
    expect(mocks.createPrivilegedClient).not.toHaveBeenCalled();
  });

  it("sanitizes database and malformed response failures", async () => {
    mocks.replies.signing_document_versions = [
      { data: null, error: { message: "sensitive database detail" } },
      reply([version({ source_sha256: "corrupt private row" })]),
    ];
    for (let attempt = 0; attempt < 2; attempt++)
      await expect(getSigningDocuments()).rejects.toMatchObject({
        status: 503,
        code: "SIGNING_UNAVAILABLE",
        message: expect.not.stringMatching(/sensitive|corrupt/),
      });
  });
});
