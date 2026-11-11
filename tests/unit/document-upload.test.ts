import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Reply = { data: unknown; error: unknown };
const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  origin: vi.fn(),
  configuration: vi.fn(),
  authConfiguration: vi.fn(),
  userClient: vi.fn(),
  privilegedClient: vi.fn(),
  userFrom: vi.fn(),
  privilegedFrom: vi.fn(),
  readForm: vi.fn(),
  validate: vi.fn(),
  limit: vi.fn(),
  commit: vi.fn(),
  rpc: vi.fn(),
  storageFrom: vi.fn(),
  upload: vi.fn(),
  remove: vi.fn(),
  userReplies: {} as Record<string, Reply[]>,
  receipts: [] as Reply[],
  predicates: [] as { table: string; field: string; value: unknown }[],
}));

vi.mock("server-only", () => ({}));
vi.mock("@/server/api", () => ({
  apiSession: mocks.session,
  assertMutationOrigin: mocks.origin,
}));
vi.mock("@/lib/auth/config", () => ({
  getAuthConfiguration: mocks.authConfiguration,
}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: mocks.userClient,
}));
vi.mock("@/lib/supabase/privileged", () => ({
  createPrivilegedSupabaseClient: mocks.privilegedClient,
}));
vi.mock("@/server/documents/config", () => ({
  getSubmissionConfiguration: mocks.configuration,
}));
vi.mock("@/server/documents/multipart", () => ({
  readLimitedFormData: mocks.readForm,
}));
vi.mock("@/server/documents/pdf", () => ({ validatePdf: mocks.validate }));

import { ApiError } from "@/server/errors";
import { derivedUploadId, uploadSubmission } from "@/server/documents/upload";

const owner = "10000000-0000-4000-8000-000000000001";
const foreignOwner = "10000000-0000-4000-8000-000000000002";
const key = "20000000-0000-4000-8000-000000000001";
const categoryId = "40000000-0000-4000-8000-000000000001";
const targetId = "50000000-0000-4000-8000-000000000001";
const policy = "development-2026-11-04";
const bytes = new TextEncoder().encode(
  "Synthetic service-test bytes; parser is mocked here.",
);
const sha256 = createHash("sha256").update(bytes).digest("hex");
const file = new File([bytes], "synthetic.pdf", { type: "application/pdf" });
let log: ReturnType<typeof vi.spyOn>;

function metadata(extra: Record<string, string> = {}) {
  const values = new FormData();
  for (const [field, value] of Object.entries({
    title: "Synthetic title",
    categoryId,
    policyVersion: policy,
    consent: "true",
    ...extra,
  }))
    values.set(field, value);
  values.set("file", file);
  return values;
}

function request(extraHeaders: Record<string, string> = {}) {
  return new Request("https://dvp.example/api/v1/documents", {
    method: "POST",
    headers: {
      origin: "https://dvp.example",
      "idempotency-key": key,
      ...extraHeaders,
    },
  });
}

function receipt(target?: string, extra: Record<string, unknown> = {}) {
  const documentId = target ?? derivedUploadId(owner, key, "document");
  return {
    id: derivedUploadId(
      owner,
      key,
      target ? `revision:${target}` : "submission",
    ),
    document_id: documentId,
    version_no: target ? 2 : 1,
    status: "pending_review",
    submitted_by: owner,
    title: "Synthetic title",
    category_id: categoryId,
    custom_document_type: null,
    document_date: null,
    issuing_institution: null,
    description: null,
    original_filename: file.name,
    file_size_bytes: file.size,
    sha256,
    policy_version: policy,
    submitted_at: "2026-11-04T12:00:00.000Z",
    ...extra,
  };
}

function query(table: string, reply: Reply) {
  const value = {
    select: vi.fn(),
    eq: vi.fn((field: string, item: unknown) => {
      mocks.predicates.push({ table, field, value: item });
      return value;
    }),
    maybeSingle: vi.fn(async () => reply),
  };
  value.select.mockReturnValue(value);
  return value;
}

beforeEach(() => {
  vi.clearAllMocks();
  log = vi.spyOn(console, "error").mockImplementation(() => undefined);
  mocks.predicates = [];
  mocks.session.mockResolvedValue({
    user: { id: owner, emailConfirmed: true },
    roles: ["user"],
  });
  mocks.origin.mockImplementation((origin: string | null) => {
    if (origin !== "https://dvp.example")
      throw new ApiError(403, "INVALID_ORIGIN", "Invalid origin.");
  });
  mocks.configuration.mockReturnValue({
    maxBytes: 10 * 1024 * 1024,
    policyVersion: policy,
    environment: "development",
  });
  mocks.authConfiguration.mockReturnValue({
    flowSecret: "synthetic-upload-test-flow-secret-long-enough",
  });
  mocks.userReplies = {
    document_categories: [
      { data: { id: categoryId, slug: "pendidikan" }, error: null },
    ],
    documents: [
      {
        data: { id: targetId, current_status: "revision_requested" },
        error: null,
      },
    ],
  };
  mocks.receipts = [
    { data: null, error: null },
    { data: receipt(), error: null },
  ];
  mocks.userFrom.mockImplementation((table: string) =>
    query(
      table,
      mocks.userReplies[table]?.shift() ?? { data: null, error: null },
    ),
  );
  mocks.privilegedFrom.mockImplementation((table: string) =>
    query(table, mocks.receipts.shift() ?? { data: null, error: null }),
  );
  mocks.userClient.mockResolvedValue({ from: mocks.userFrom });
  mocks.privilegedClient.mockReturnValue({
    from: mocks.privilegedFrom,
    rpc: mocks.rpc,
    storage: { from: mocks.storageFrom },
  });
  mocks.storageFrom.mockReturnValue({
    upload: mocks.upload,
    remove: mocks.remove,
  });
  mocks.limit.mockResolvedValue({ data: true, error: null });
  mocks.commit.mockResolvedValue({ data: null, error: null });
  mocks.rpc.mockImplementation((name: string, args: unknown) =>
    name === "consume_document_upload_limit"
      ? mocks.limit(args)
      : mocks.commit(name, args),
  );
  mocks.readForm.mockResolvedValue(metadata());
  mocks.validate.mockResolvedValue({ bytes, sha256, pageCount: 1 });
  mocks.upload.mockResolvedValue({
    data: { path: "not-returned-storage-path" },
    error: null,
  });
  mocks.remove.mockResolvedValue({ data: [], error: null });
});

afterEach(() => {
  log.mockRestore();
});

describe("upload orchestration contracts (mocked provider, no stored documents)", () => {
  it("requires verified authentication before creating any storage or database client", async () => {
    mocks.session.mockRejectedValue(
      new ApiError(401, "UNAUTHENTICATED", "Login required."),
    );
    await expect(uploadSubmission(request())).rejects.toMatchObject({
      status: 401,
    });
    expect(mocks.userClient).not.toHaveBeenCalled();
    expect(mocks.privilegedClient).not.toHaveBeenCalled();
    expect(mocks.readForm).not.toHaveBeenCalled();
  });

  it("rejects cross-origin uploads before storage access", async () => {
    await expect(
      uploadSubmission(request({ origin: "https://attacker.example" })),
    ).rejects.toMatchObject({ status: 403 });
    expect(mocks.userClient).not.toHaveBeenCalled();
    expect(mocks.privilegedClient).not.toHaveBeenCalled();
  });

  it("enforces verified email and normal-user membership before upload", async () => {
    mocks.session.mockResolvedValueOnce({
      user: { id: owner, emailConfirmed: false },
      roles: ["user"],
    });
    await expect(uploadSubmission(request())).rejects.toMatchObject({
      status: 403,
      code: "EMAIL_VERIFICATION_REQUIRED",
    });
    mocks.session.mockResolvedValueOnce({
      user: { id: owner, emailConfirmed: true },
      roles: ["platform_admin"],
    });
    await expect(uploadSubmission(request())).rejects.toMatchObject({
      status: 403,
      code: "FORBIDDEN",
    });
    expect(mocks.upload).not.toHaveBeenCalled();
  });

  it("derives stable request IDs independently for each owner and operation", () => {
    const first = derivedUploadId(owner, key, "document");
    expect(first).toBe(
      derivedUploadId(owner.toUpperCase(), key.toUpperCase(), "document"),
    );
    expect(first).not.toBe(derivedUploadId(foreignOwner, key, "document"));
    expect(first).not.toBe(derivedUploadId(owner, key, "submission"));
    expect(first).toMatch(
      /^[a-f0-9]{8}-[a-f0-9]{4}-8[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/,
    );
  });

  it("rejects an invalid idempotency key before any storage write", async () => {
    await expect(
      uploadSubmission(
        request({ "idempotency-key": "browser-picked-storage-path" }),
      ),
    ).rejects.toMatchObject({ status: 400, code: "INVALID_IDEMPOTENCY_KEY" });
    expect(mocks.userClient).not.toHaveBeenCalled();
    expect(mocks.upload).not.toHaveBeenCalled();
  });

  it("uses the verified owner, inspected hash, current policy and private opaque object path", async () => {
    const result = await uploadSubmission(
      request({ "x-owner-id": foreignOwner, "x-role": "platform_admin" }),
    );
    const expected = receipt();
    const path = `${owner}/${expected.document_id}/${expected.id}.pdf`;
    expect(mocks.upload).toHaveBeenCalledWith(path, bytes, {
      contentType: "application/pdf",
      cacheControl: "0",
      upsert: false,
    });
    expect(mocks.storageFrom).toHaveBeenCalledWith("document-submissions");
    expect(mocks.commit).toHaveBeenCalledWith(
      "create_document_submission",
      expect.objectContaining({
        p_owner_id: owner,
        p_document_id: expected.document_id,
        p_submission_id: expected.id,
        p_storage_path: path,
        p_sha256: sha256,
        p_policy_version: policy,
        p_consent: true,
      }),
    );
    expect(result).toMatchObject({
      documentId: expected.document_id,
      submissionId: expected.id,
      status: "pending_review",
      versionNo: 1,
    });
    expect(JSON.stringify(result)).not.toMatch(
      /storage|signed|verification|qr|synthetic\.pdf/,
    );
    expect(mocks.remove).not.toHaveBeenCalled();
  });

  it.each(["owner_id", "role", "sha256", "storage_path", "consented_at"])(
    "rejects browser field%s before a storage write",
    async (field) => {
      mocks.readForm.mockResolvedValue(metadata({ [field]: "forged" }));
      await expect(uploadSubmission(request())).rejects.toThrow();
      expect(mocks.upload).not.toHaveBeenCalled();
      expect(mocks.commit).not.toHaveBeenCalled();
    },
  );

  it("does not store bytes when actual PDF validation rejects them", async () => {
    mocks.validate.mockRejectedValue(
      new ApiError(422, "INVALID_PDF", "Invalid PDF."),
    );
    await expect(uploadSubmission(request())).rejects.toMatchObject({
      status: 422,
    });
    expect(mocks.upload).not.toHaveBeenCalled();
    expect(mocks.commit).not.toHaveBeenCalled();
  });

  it("does not write when the persistent upload limiter refuses the request", async () => {
    mocks.limit.mockResolvedValue({ data: false, error: null });
    await expect(uploadSubmission(request())).rejects.toMatchObject({
      status: 429,
      code: "RATE_LIMITED",
    });
    expect(mocks.readForm).not.toHaveBeenCalled();
    expect(mocks.upload).not.toHaveBeenCalled();
  });

  it("returns404 for a foreign resubmission before privileged access", async () => {
    mocks.userReplies.documents = [{ data: null, error: null }];
    await expect(uploadSubmission(request(), targetId)).rejects.toMatchObject({
      status: 404,
      code: "NOT_FOUND",
    });
    expect(mocks.predicates).toContainEqual({
      table: "documents",
      field: "owner_id",
      value: owner,
    });
    expect(mocks.privilegedClient).not.toHaveBeenCalled();
    expect(mocks.upload).not.toHaveBeenCalled();
  });

  it.each(["rejected", "approved", "pending_review"])(
    "does not revise a%s document without an existing matching receipt",
    async (status) => {
      mocks.userReplies.documents = [
        { data: { id: targetId, current_status: status }, error: null },
      ];
      mocks.receipts = [{ data: null, error: null }];
      await expect(uploadSubmission(request(), targetId)).rejects.toMatchObject(
        { status: 409, code: "DOCUMENT_NOT_ELIGIBLE" },
      );
      expect(mocks.upload).not.toHaveBeenCalled();
      expect(mocks.commit).not.toHaveBeenCalled();
    },
  );

  it("replays a completed revision receipt before checking its now-pending state", async () => {
    mocks.userReplies.documents = [
      { data: { id: targetId, current_status: "pending_review" }, error: null },
    ];
    mocks.receipts = [{ data: receipt(targetId), error: null }];
    const result = await uploadSubmission(request(), targetId);
    expect(result).toMatchObject({ documentId: targetId, versionNo: 2 });
    expect(mocks.upload).not.toHaveBeenCalled();
    expect(mocks.commit).not.toHaveBeenCalled();
  });

  it("returns an existing same-request receipt without duplicating storage or database records", async () => {
    mocks.receipts = [{ data: receipt(), error: null }];
    expect((await uploadSubmission(request())).versionNo).toBe(1);
    expect(mocks.upload).not.toHaveBeenCalled();
    expect(mocks.commit).not.toHaveBeenCalled();
  });

  it("rejects reuse of a key with changed metadata", async () => {
    mocks.receipts = [{ data: receipt(), error: null }];
    mocks.readForm.mockResolvedValue(metadata({ title: "Changed title" }));
    await expect(uploadSubmission(request())).rejects.toMatchObject({
      status: 409,
      code: "IDEMPOTENCY_CONFLICT",
    });
    expect(mocks.upload).not.toHaveBeenCalled();
    expect(mocks.remove).not.toHaveBeenCalled();
  });

  it("does not remove another request's object after an upsert-disabled409", async () => {
    mocks.receipts = [
      { data: null, error: null },
      { data: null, error: null },
    ];
    mocks.upload.mockResolvedValue({
      data: null,
      error: { statusCode: "409", message: "Object exists" },
    });
    await expect(uploadSubmission(request())).rejects.toMatchObject({
      status: 409,
      code: "UPLOAD_IN_PROGRESS",
    });
    expect(mocks.commit).not.toHaveBeenCalled();
    expect(mocks.remove).not.toHaveBeenCalled();
  });

  it("compensates only its own created object after definite SQL rollback and confirmed absence", async () => {
    mocks.receipts = [
      { data: null, error: null },
      { data: null, error: null },
    ];
    mocks.commit.mockResolvedValue({ data: null, error: { code: "23505" } });
    await expect(uploadSubmission(request())).rejects.toMatchObject({
      status: 409,
      code: "STATE_CONFLICT",
    });
    const expected = receipt();
    expect(mocks.remove).toHaveBeenCalledOnce();
    expect(mocks.remove).toHaveBeenCalledWith([
      `${owner}/${expected.document_id}/${expected.id}.pdf`,
    ]);
  });

  it("keeps a potentially committed object when the RPC outcome is unknown", async () => {
    mocks.receipts = [
      { data: null, error: null },
      { data: null, error: null },
    ];
    mocks.commit.mockRejectedValue(new Error("network failure"));
    await expect(uploadSubmission(request())).rejects.toMatchObject({
      status: 503,
      code: "SUBMISSION_UNCERTAIN",
    });
    expect(mocks.remove).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledOnce();
    expect(JSON.stringify(log.mock.calls)).not.toContain(owner);
    expect(JSON.stringify(log.mock.calls)).not.toContain(sha256);
  });

  it("does not classify the five-letter network code EPIPE as definite SQL rollback", async () => {
    mocks.receipts = [
      { data: null, error: null },
      { data: null, error: null },
    ];
    mocks.commit.mockResolvedValue({ data: null, error: { code: "EPIPE" } });
    await expect(uploadSubmission(request())).rejects.toMatchObject({
      status: 503,
      code: "SUBMISSION_UNCERTAIN",
    });
    expect(mocks.remove).not.toHaveBeenCalled();
  });

  it("keeps bytes when a post-error receipt query cannot establish absence", async () => {
    mocks.receipts = [
      { data: null, error: null },
      { data: null, error: { message: "query unavailable" } },
    ];
    mocks.commit.mockResolvedValue({ data: null, error: { code: "23505" } });
    await expect(uploadSubmission(request())).rejects.toMatchObject({
      status: 503,
      code: "SUBMISSION_UNCERTAIN",
    });
    expect(mocks.remove).not.toHaveBeenCalled();
  });

  it("recovers a committed receipt even if the RPC response reported failure", async () => {
    mocks.commit.mockRejectedValue(new Error("response lost after commit"));
    expect((await uploadSubmission(request())).status).toBe("pending_review");
    expect(mocks.remove).not.toHaveBeenCalled();
  });
});
