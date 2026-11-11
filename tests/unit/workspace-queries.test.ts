import { beforeEach, describe, expect, it, vi } from "vitest";

type Reply = { data: unknown; error: unknown };
type Query = {
  table: string;
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  limit: ReturnType<typeof vi.fn>;
  ilike: ReturnType<typeof vi.fn>;
  gte: ReturnType<typeof vi.fn>;
  lte: ReturnType<typeof vi.fn>;
  or: ReturnType<typeof vi.fn>;
  in: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  maybeSingle: ReturnType<typeof vi.fn>;
  then: (
    resolve: (reply: Reply) => unknown,
    reject: (reason: unknown) => unknown,
  ) => Promise<unknown>;
};

const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  createClient: vi.fn(),
  from: vi.fn(),
  rpc: vi.fn(),
  replies: {} as Record<string, Reply[]>,
  queries: [] as Query[],
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/session", () => ({ getAuthSession: mocks.session }));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: mocks.createClient,
}));

import {
  getWorkspaceCategories,
  getWorkspaceDashboard,
  getWorkspaceDocument,
  getWorkspaceDocuments,
  getWorkspaceProfile,
  updateWorkspaceProfile,
} from "@/server/workspace/queries";

const owner = "10000000-0000-4000-8000-000000000001";
const foreignOwner = "10000000-0000-4000-8000-000000000002";
const documentId = "20000000-0000-4000-8000-000000000001";
const submissionId = "30000000-0000-4000-8000-000000000002";
const categoryId = "40000000-0000-4000-8000-000000000001";
const timestamp = "2026-11-04T10:00:00.000Z";
const counts = {
  total: 0,
  pendingReview: 0,
  revisionRequested: 0,
  approved: 0,
  rejected: 0,
  revoked: 0,
};

function summary(extra: Record<string, unknown> = {}) {
  return {
    id: documentId,
    owner_id: owner,
    current_version_no: 2,
    current_status: "pending_review",
    created_at: timestamp,
    updated_at: timestamp,
    registered_at: null,
    revoked_at: null,
    revocation_reason: null,
    submission_id: submissionId,
    title: "Synthetic current title",
    category_id: categoryId,
    submitted_at: timestamp,
    category_name: "Lainnya",
    category_slug: "lainnya",
    ...extra,
  };
}

function version(extra: Record<string, unknown> = {}) {
  return {
    id: submissionId,
    document_id: documentId,
    submitted_by: owner,
    version_no: 2,
    status: "pending_review",
    title: "Synthetic current title",
    category_id: categoryId,
    custom_document_type: "Synthetic category detail",
    document_date: "2026-11-04",
    issuing_institution: null,
    description: null,
    original_filename: "synthetic-current.pdf",
    file_size_bytes: 1024,
    sha256: "a".repeat(64),
    submitted_at: timestamp,
    policy_version: "development-2026-11-04",
    consented_at: timestamp,
    ...extra,
  };
}

function reply(data: unknown): Reply {
  return { data, error: null };
}

function builder(table: string): Query {
  const result = mocks.replies[table]?.shift() ?? reply([]);
  const query: Query = {
    table,
    select: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    ilike: vi.fn(),
    gte: vi.fn(),
    lte: vi.fn(),
    or: vi.fn(),
    in: vi.fn(),
    update: vi.fn(),
    maybeSingle: vi.fn(),
    then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
  };
  for (const key of [
    "select",
    "eq",
    "order",
    "limit",
    "ilike",
    "gte",
    "lte",
    "or",
    "in",
    "update",
    "maybeSingle",
  ] as const)
    query[key].mockReturnValue(query);
  mocks.queries.push(query);
  return query;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.replies = {};
  mocks.queries = [];
  mocks.session.mockResolvedValue({
    user: {
      id: owner,
      email: "synthetic@example.invalid",
      emailConfirmed: true,
    },
    roles: ["user"],
  });
  mocks.from.mockImplementation(builder);
  mocks.rpc.mockResolvedValue(reply(counts));
  mocks.createClient.mockResolvedValue({ from: mocks.from, rpc: mocks.rpc });
});

describe("owner workspace query contracts (mocked SDK, not live RLS)", () => {
  it.each([
    ["documents", () => getWorkspaceDocuments()],
    ["dashboard", () => getWorkspaceDashboard()],
    ["categories", () => getWorkspaceCategories()],
    ["detail", () => getWorkspaceDocument(documentId)],
    ["profile", () => getWorkspaceProfile()],
    [
      "profile update",
      () => updateWorkspaceProfile({ fullName: "Synthetic owner" }),
    ],
  ] as const)(
    "rejects anonymous %s before creating a data client",
    async (_name, run) => {
      mocks.session.mockResolvedValue(null);
      await expect(run()).rejects.toMatchObject({
        status: 401,
        code: "UNAUTHENTICATED",
      });
      expect(mocks.createClient).not.toHaveBeenCalled();
      expect(mocks.from).not.toHaveBeenCalled();
    },
  );

  it("does not replace unavailable backend data with zero-count success", async () => {
    mocks.rpc.mockResolvedValue({
      data: null,
      error: { message: "private SQL details" },
    });
    await expect(getWorkspaceDashboard()).rejects.toMatchObject({
      status: 503,
      code: "WORKSPACE_UNAVAILABLE",
    });
  });

  it("sanitizes failures during identity lookup", async () => {
    mocks.session.mockRejectedValue(
      new Error("internal credential or database detail"),
    );
    await expect(getWorkspaceDocuments()).rejects.toThrow(
      "Data workspace sementara tidak tersedia.",
    );
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it("scopes a filtered list to verified owner and treats search wildcards literally", async () => {
    mocks.replies.workspace_documents = [
      reply([
        summary({
          storage_path: "must-not-be-returned",
          verification_code: "must-not-be-returned",
        }),
      ]),
    ];
    const result = await getWorkspaceDocuments({
      q: "50%_\\",
      status: "pending_review",
      categoryId,
      from: "2026-11-01",
      to: "2026-11-04",
      owner_id: foreignOwner,
      role: "platform_admin",
    });
    const query = mocks.queries[0]!;
    expect(query.eq).toHaveBeenCalledWith("owner_id", owner);
    expect(query.eq).not.toHaveBeenCalledWith("owner_id", foreignOwner);
    expect(query.ilike).toHaveBeenCalledWith("title", "%50\\%\\_\\\\%");
    expect(query.eq).toHaveBeenCalledWith("current_status", "pending_review");
    expect(query.eq).toHaveBeenCalledWith("category_id", categoryId);
    expect(query.gte).toHaveBeenCalledWith(
      "submitted_at",
      "2026-11-01T00:00:00.000000Z",
    );
    expect(query.lte).toHaveBeenCalledWith(
      "submitted_at",
      "2026-11-04T23:59:59.999999Z",
    );
    expect(result.items).toHaveLength(1);
    expect(JSON.stringify(result)).not.toContain("must-not-be-returned");
    expect(result.items[0]).not.toHaveProperty("owner_id");
  });

  it.each([["user"], ["user", "reviewer"]])(
    "does not widen document ownership for privileged workspace roles",
    async (...roles) => {
      mocks.session.mockResolvedValue({
        user: { id: owner, emailConfirmed: true },
        roles,
      });
      mocks.replies.workspace_documents = [
        reply([summary({ owner_id: foreignOwner })]),
      ];
      await expect(getWorkspaceDocuments()).rejects.toMatchObject({
        status: 503,
      });
      expect(mocks.queries[0]!.eq).toHaveBeenCalledWith("owner_id", owner);
    },
  );

  it("denies an admin's user workspace queries before creating the database client", async () => {
    mocks.session.mockResolvedValue({
      user: { id: owner, emailConfirmed: true },
      roles: ["user", "platform_admin"],
    });
    await expect(getWorkspaceDocuments()).rejects.toMatchObject({
      status: 403,
      code: "USER_WORKSPACE_NOT_ALLOWED",
    });
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it("retains an admin's own profile read and update without document access", async () => {
    mocks.session.mockResolvedValue({
      user: { id: owner, emailConfirmed: true },
      roles: ["user", "platform_admin"],
    });
    const row = {
      full_name: "Synthetic admin",
      phone: null,
      created_at: timestamp,
    };
    mocks.replies.profiles = [reply(row), reply(row)];
    expect((await getWorkspaceProfile()).fullName).toBe("Synthetic admin");
    expect(
      (await updateWorkspaceProfile({ fullName: "Synthetic admin" })).fullName,
    ).toBe("Synthetic admin");
    expect(mocks.queries).toHaveLength(2);
    for (const query of mocks.queries) {
      expect(query.table).toBe("profiles");
      expect(query.eq).toHaveBeenCalledWith("id", owner);
    }
  });

  it("emits a bounded cursor from the last returned row and retains owner scope on the next page", async () => {
    const secondId = "20000000-0000-4000-8000-000000000002";
    mocks.replies.workspace_documents = [
      reply([
        summary(),
        summary({ id: secondId }),
        summary({ id: "20000000-0000-4000-8000-000000000003" }),
      ]),
      reply([]),
    ];
    const first = await getWorkspaceDocuments({ limit: "2" });
    expect(first.items).toHaveLength(2);
    expect(mocks.queries[0]!.limit).toHaveBeenCalledWith(3);
    expect(
      JSON.parse(Buffer.from(first.nextCursor!, "base64url").toString("utf8")),
    ).toEqual({ submittedAt: timestamp, id: secondId });
    await getWorkspaceDocuments({ limit: 2, cursor: first.nextCursor });
    expect(mocks.queries[1]!.eq).toHaveBeenCalledWith("owner_id", owner);
    expect(mocks.queries[1]!.or).toHaveBeenCalledWith(
      `submitted_at.lt.${timestamp},and(submitted_at.eq.${timestamp},id.lt.${secondId})`,
    );
  });

  it.each([
    { limit: "0" },
    { limit: "51" },
    { limit: "1.5" },
    { limit: -1 },
    { status: "public" },
    { categoryId: "other-owner" },
    { from: "2026-02-30" },
    { from: "2026-11-05", to: "2026-11-04" },
    { cursor: "!invalid" },
    { cursor: "a".repeat(513) },
    {
      cursor: Buffer.from(
        JSON.stringify({
          submittedAt: `${timestamp},owner_id.eq.${foreignOwner}`,
          id: documentId,
        }),
      ).toString("base64url"),
    },
    {
      cursor: Buffer.from(
        JSON.stringify({
          submittedAt: timestamp,
          id: documentId,
          owner_id: foreignOwner,
        }),
      ).toString("base64url"),
    },
  ])(
    "rejects invalid filters or cursor data before querying documents",
    async (input) => {
      await expect(getWorkspaceDocuments(input)).rejects.toMatchObject({
        status: 422,
        code: "VALIDATION_ERROR",
      });
      expect(mocks.from).not.toHaveBeenCalled();
    },
  );

  it("returns the same not-found result for foreign, missing, and malformed document IDs", async () => {
    mocks.replies.workspace_documents = [
      reply(summary({ owner_id: foreignOwner })),
      reply(null),
    ];
    expect(await getWorkspaceDocument(documentId)).toBeNull();
    expect(await getWorkspaceDocument(documentId)).toBeNull();
    expect(await getWorkspaceDocument("not-a-uuid")).toBeNull();
    expect(mocks.queries).toHaveLength(2);
    expect(
      mocks.queries.every((query) => query.table === "workspace_documents"),
    ).toBe(true);
  });

  it("preserves each historical submission's metadata and consent while omitting storage internals", async () => {
    const previousId = "30000000-0000-4000-8000-000000000001";
    mocks.replies.workspace_documents = [reply(summary())];
    mocks.replies.document_submissions = [
      reply([
        version({
          storage_path: "hidden-path",
          signed_url: "hidden-bearer-url",
        }),
        version({
          id: previousId,
          version_no: 1,
          status: "revision_requested",
          title: "Synthetic previous title",
          policy_version: "previous-development-policy",
          consented_at: "2026-11-01T10:00:00.000Z",
        }),
      ]),
    ];
    mocks.replies.review_decisions = [reply([])];
    mocks.replies.document_categories = [
      reply([{ id: categoryId, name: "Lainnya", slug: "lainnya" }]),
    ];
    const result = await getWorkspaceDocument(documentId);
    expect(result?.versions).toHaveLength(2);
    expect(result?.versions[1]).toMatchObject({
      versionNo: 1,
      title: "Synthetic previous title",
      policyVersion: "previous-development-policy",
      consentedAt: "2026-11-01T10:00:00.000Z",
    });
    expect(result?.policyVersion).toBe("development-2026-11-04");
    expect(JSON.stringify(result)).not.toMatch(
      /hidden-path|hidden-bearer-url|storage_path|storage_bucket|verification_code/,
    );
    expect(
      mocks.queries.find((query) => query.table === "document_submissions")!.eq,
    ).toHaveBeenCalledWith("submitted_by", owner);
  });

  it("fails closed when a returned historical version belongs to another account", async () => {
    mocks.replies.workspace_documents = [reply(summary())];
    mocks.replies.document_submissions = [
      reply([version({ submitted_by: foreignOwner })]),
    ];
    await expect(getWorkspaceDocument(documentId)).rejects.toMatchObject({
      status: 503,
    });
    expect(
      mocks.queries.some((query) => query.table === "review_decisions"),
    ).toBe(false);
  });

  it("reads only active form categories", async () => {
    mocks.replies.document_categories = [
      reply([{ id: categoryId, name: "Lainnya", slug: "lainnya" }]),
    ];
    expect(await getWorkspaceCategories()).toHaveLength(1);
    expect(mocks.queries[0]!.eq).toHaveBeenCalledWith("is_active", true);
  });

  it.each([
    "role",
    "roles",
    "email",
    "owner_id",
    "user_id",
    "accountStatus",
    "is_active",
  ])("rejects profile field %s before any update", async (field) => {
    await expect(
      updateWorkspaceProfile({
        fullName: "Synthetic owner",
        [field]: "forged",
      }),
    ).rejects.toMatchObject({ status: 422, code: "VALIDATION_ERROR" });
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("updates only allowed fields on the verified profile and returns verified email", async () => {
    mocks.replies.profiles = [
      reply({
        full_name: "Synthetic owner",
        phone: null,
        created_at: timestamp,
      }),
    ];
    const result = await updateWorkspaceProfile({
      fullName: "  Synthetic owner  ",
      phone: " ",
    });
    expect(mocks.queries[0]!.update).toHaveBeenCalledWith({
      full_name: "Synthetic owner",
      phone: null,
    });
    expect(mocks.queries[0]!.eq).toHaveBeenCalledWith("id", owner);
    expect(result.email).toBe("synthetic@example.invalid");
    expect(result).not.toHaveProperty("roles");
  });
});
