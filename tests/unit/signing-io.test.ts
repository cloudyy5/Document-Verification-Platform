import { createHash, createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Reply = { data: unknown; error: unknown };
type Predicate = { table: string; field: string; value: unknown };
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
  bucket: vi.fn(),
  upload: vi.fn(),
  remove: vi.fn(),
  download: vi.fn(),
  signedUrl: vi.fn(),
  userReplies: {} as Record<string, Reply[]>,
  receipts: [] as Reply[],
  predicates: [] as Predicate[],
}));

vi.mock("server-only", () => ({}));
vi.mock("@/server/api", () => ({
  apiSession: mocks.session,
  assertMutationOrigin: mocks.origin,
  privateHeaders: { "Cache-Control": "private, no-store", Vary: "Cookie" },
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
vi.mock("@/server/signing/config", () => ({
  getSigningConfiguration: mocks.configuration,
}));
vi.mock("@/server/documents/multipart", () => ({
  readLimitedFormData: mocks.readForm,
}));
vi.mock("@/server/documents/pdf", () => ({ validatePdf: mocks.validate }));

import { ApiError } from "@/server/errors";
import { derivedUploadId } from "@/server/documents/upload";
import { uploadSigningDraft } from "@/server/signing/upload";
import { serveSigningFile } from "@/server/signing/file";
import {
  SIGNING_SHARING_POLICY_VERSION,
  SIGNING_UPLOAD_POLICY_VERSION,
} from "@/lib/signing/policy";

// Auth, SDK, multipart and PDF inspection are mocked. Actual upload/file
// orchestration, consent parser, ID helper and HTTP PDF response are exercised.
// These tests neither connect to Supabase nor prove live RLS or PDF parsing.
const owner = "61000000-0000-4000-8000-000000000001";
const recipient = "61000000-0000-4000-8000-000000000002";
const outsider = "61000000-0000-4000-8000-000000000003";
const key = "62000000-0000-4000-8000-000000000001";
const categoryId = "63000000-0000-4000-8000-000000000001";
const documentId = derivedUploadId(owner, key, "signing-document");
const versionId = derivedUploadId(owner, key, "signing-source");
const path = `${owner}/signing/${documentId}/${versionId}.pdf`;
const timestamp = "2026-11-05T00:00:00.000Z";
const bytes = new TextEncoder().encode(
  "%PDF-1.7\nSynthetic I/O fixture; parser mocked in this test.\n%%EOF",
);
const hash = createHash("sha256").update(bytes).digest("hex");
const filename = 'UJI; "A" β (internal).pdf';
const file = new File([bytes], filename, { type: "application/pdf" });
const flowSecret = "synthetic-signing-io-test-flow-secret-long-enough";

function reply(data: unknown): Reply {
  return { data, error: null };
}
function version(extra: Record<string, unknown> = {}) {
  return {
    id: versionId,
    document_id: documentId,
    owner_id: owner,
    version_no: 1,
    title: "UJI DEVELOPMENT synthetic private draft",
    category_id: categoryId,
    custom_document_type: null,
    document_date: null,
    issuing_institution: null,
    description: null,
    original_filename: filename,
    file_size_bytes: file.size,
    source_sha256: hash,
    storage_path: path,
    upload_policy_version: SIGNING_UPLOAD_POLICY_VERSION,
    created_at: timestamp,
    ...extra,
  };
}
function form(extra: Record<string, string> = {}) {
  const result = new FormData();
  for (const [name, value] of Object.entries({
    title: "UJI DEVELOPMENT synthetic private draft",
    categoryId,
    policyVersion: SIGNING_UPLOAD_POLICY_VERSION,
    consent: "true",
    ...extra,
  }))
    result.set(name, value);
  result.set("file", file);
  return result;
}
function uploadRequest(extra: Record<string, string> = {}, includeKey = true) {
  const headers = new Headers({
    origin: "http://127.0.0.1:3000",
    ...(includeKey ? { "idempotency-key": key } : {}),
    ...extra,
  });
  return new Request("http://127.0.0.1:3000/api/v2/signing-documents", {
    method: "POST",
    headers,
  });
}
function fileRequest(query = "", range?: string) {
  return new Request(
    `http://127.0.0.1:3000/api/v2/signing-documents/${documentId}/file${query}`,
    { headers: range ? { range } : {} },
  );
}
function builder(table: string, result: Reply) {
  const query = {
    select: vi.fn(),
    eq: vi.fn((field: string, value: unknown) => {
      mocks.predicates.push({ table, field, value });
      return query;
    }),
    maybeSingle: vi.fn(async () => result),
  };
  query.select.mockReturnValue(query);
  return query;
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-05T12:00:00.000Z"));
  mocks.predicates = [];
  mocks.session.mockResolvedValue({
    user: { id: owner, emailConfirmed: true },
    roles: ["user"],
  });
  mocks.origin.mockImplementation((origin: string | null) => {
    if (origin !== "http://127.0.0.1:3000")
      throw new ApiError(403, "INVALID_ORIGIN", "Origin tidak valid.");
  });
  mocks.configuration.mockReturnValue({
    maxBytes: 10 * 1024 * 1024,
    uploadPolicyVersion: SIGNING_UPLOAD_POLICY_VERSION,
    sharingPolicyVersion: SIGNING_SHARING_POLICY_VERSION,
    environment: "development",
  });
  mocks.authConfiguration.mockReturnValue({ flowSecret });
  mocks.userReplies = {
    document_categories: [reply({ id: categoryId, slug: "pendidikan" })],
    signing_document_versions: [reply(version()), reply(version())],
    signing_requests: [
      reply({
        id: "64000000-0000-4000-8000-000000000001",
        status: "pending",
        expires_at: "2026-11-12T00:00:00.000Z",
      }),
      reply({
        id: "64000000-0000-4000-8000-000000000001",
        status: "pending",
        expires_at: "2026-11-12T00:00:00.000Z",
      }),
    ],
  };
  mocks.receipts = [reply(null), reply(version())];
  mocks.userFrom.mockImplementation((table: string) =>
    builder(table, mocks.userReplies[table]?.shift() ?? reply(null)),
  );
  mocks.privilegedFrom.mockImplementation((table: string) =>
    builder(table, mocks.receipts.shift() ?? reply(null)),
  );
  mocks.userClient.mockResolvedValue({ from: mocks.userFrom });
  mocks.privilegedClient.mockReturnValue({
    from: mocks.privilegedFrom,
    rpc: mocks.rpc,
    storage: { from: mocks.bucket },
  });
  mocks.bucket.mockReturnValue({
    upload: mocks.upload,
    remove: mocks.remove,
    download: mocks.download,
    createSignedUrl: mocks.signedUrl,
  });
  mocks.limit.mockResolvedValue(reply(true));
  mocks.commit.mockResolvedValue(reply(null));
  mocks.rpc.mockImplementation((name: string, args: unknown) =>
    name === "consume_document_upload_limit"
      ? mocks.limit(args)
      : mocks.commit(name, args),
  );
  mocks.readForm.mockResolvedValue(form());
  mocks.validate.mockResolvedValue({ bytes, sha256: hash, pageCount: 1 });
  mocks.upload.mockResolvedValue(reply({ path }));
  mocks.remove.mockResolvedValue(reply([]));
  mocks.download.mockResolvedValue(
    reply(new Blob([bytes], { type: "application/pdf" })),
  );
});
afterEach(() => vi.useRealTimers());

describe("R2 private draft upload I/O contracts with mocked provider", () => {
  it("authenticates before Origin, configuration, parsing or provider I/O", async () => {
    mocks.session.mockRejectedValue(
      new ApiError(401, "UNAUTHENTICATED", "Masuk dahulu."),
    );
    await expect(uploadSigningDraft(uploadRequest())).rejects.toMatchObject({
      status: 401,
    });
    expect(mocks.origin).not.toHaveBeenCalled();
    expect(mocks.configuration).not.toHaveBeenCalled();
    expect(mocks.readForm).not.toHaveBeenCalled();
    expect(mocks.userClient).not.toHaveBeenCalled();
    expect(mocks.privilegedClient).not.toHaveBeenCalled();
  });

  it("rejects a cross-origin request before parsing or provider I/O", async () => {
    await expect(
      uploadSigningDraft(uploadRequest({ origin: "https://attacker.example" })),
    ).rejects.toMatchObject({ status: 403, code: "INVALID_ORIGIN" });
    expect(mocks.configuration).not.toHaveBeenCalled();
    expect(mocks.readForm).not.toHaveBeenCalled();
    expect(mocks.userClient).not.toHaveBeenCalled();
    expect(mocks.privilegedClient).not.toHaveBeenCalled();
  });

  it.each([
    [false, ["user"], "EMAIL_VERIFICATION_REQUIRED"],
    [true, ["platform_admin"], "SIGNING_NOT_ALLOWED"],
    [true, ["reviewer"], "SIGNING_NOT_ALLOWED"],
  ] as const)(
    "requires verified normal-user eligibility before I/O (%s, %j)",
    async (emailConfirmed, roles, code) => {
      mocks.session.mockResolvedValue({
        user: { id: owner, emailConfirmed },
        roles,
      });
      await expect(uploadSigningDraft(uploadRequest())).rejects.toMatchObject({
        status: 403,
        code,
      });
      expect(mocks.configuration).not.toHaveBeenCalled();
      expect(mocks.readForm).not.toHaveBeenCalled();
      expect(mocks.userClient).not.toHaveBeenCalled();
      expect(mocks.privilegedClient).not.toHaveBeenCalled();
    },
  );

  it("retains the development configuration gate before provider I/O", async () => {
    mocks.configuration.mockImplementation(() => {
      throw new ApiError(
        503,
        "UPLOAD_UNAVAILABLE",
        "Lingkungan belum tersedia.",
      );
    });
    await expect(uploadSigningDraft(uploadRequest())).rejects.toMatchObject({
      status: 503,
    });
    expect(mocks.privilegedClient).not.toHaveBeenCalled();
    expect(mocks.readForm).not.toHaveBeenCalled();
  });

  it.each(["missing", "invalid"])(
    "requires an explicit valid %s idempotency key",
    async (kind) => {
      const request =
        kind === "missing"
          ? uploadRequest({}, false)
          : uploadRequest({ "idempotency-key": "browser-path" });
      await expect(uploadSigningDraft(request)).rejects.toMatchObject({
        status: 400,
        code: "INVALID_IDEMPOTENCY_KEY",
      });
      expect(mocks.privilegedClient).not.toHaveBeenCalled();
      expect(mocks.upload).not.toHaveBeenCalled();
    },
  );

  it("creates only a private draft using session identity, new consent and separate deterministic IDs", async () => {
    const result = await uploadSigningDraft(
      uploadRequest({ "x-owner-id": outsider, "x-role": "platform_admin" }),
    );
    expect(documentId).not.toBe(derivedUploadId(owner, key, "document"));
    expect(versionId).not.toBe(derivedUploadId(owner, key, "submission"));
    expect(documentId).not.toBe(versionId);
    expect(mocks.upload).toHaveBeenCalledExactlyOnceWith(path, bytes, {
      contentType: "application/pdf",
      cacheControl: "0",
      upsert: false,
    });
    expect(mocks.bucket).toHaveBeenCalledWith("document-submissions");
    expect(mocks.commit).toHaveBeenCalledExactlyOnceWith(
      "create_signing_draft",
      {
        p_actor_id: owner,
        p_document_id: documentId,
        p_version_id: versionId,
        p_title: "UJI DEVELOPMENT synthetic private draft",
        p_category_id: categoryId,
        p_custom_document_type: null,
        p_document_date: null,
        p_issuing_institution: null,
        p_description: null,
        p_original_filename: filename,
        p_file_size_bytes: file.size,
        p_source_sha256: hash,
        p_storage_path: path,
        p_upload_policy_version: SIGNING_UPLOAD_POLICY_VERSION,
        p_upload_consent: true,
      },
    );
    expect(mocks.rpc.mock.calls.map(([name]) => name)).toEqual([
      "consume_document_upload_limit",
      "create_signing_draft",
    ]);
    expect(result).toEqual({
      documentId,
      versionId,
      versionNo: 1,
      status: "draft",
      createdAt: timestamp,
    });
    expect(JSON.stringify(result)).not.toMatch(
      /storage|recipient|invitation|review|qr|sha256|original_filename/,
    );
    expect(mocks.remove).not.toHaveBeenCalled();
    expect(mocks.signedUrl).not.toHaveBeenCalled();
  });

  it("reuses the shared persistent upload limiter with HMAC-only identities", async () => {
    await uploadSigningDraft(uploadRequest());
    const digest = (value: string) =>
      createHmac("sha256", flowSecret).update(value).digest("hex");
    expect(mocks.limit).toHaveBeenCalledExactlyOnceWith({
      p_key_digest: digest(`upload\0${owner}`),
      p_global_digest: digest("upload\0application"),
    });
    expect(JSON.stringify(mocks.limit.mock.calls)).not.toMatch(
      new RegExp(`${owner}|${flowSecret}`),
    );
  });

  it("stops before parsing or storing when the persistent upload quota is exhausted", async () => {
    mocks.limit.mockResolvedValue(reply(false));
    await expect(uploadSigningDraft(uploadRequest())).rejects.toMatchObject({
      status: 429,
      code: "RATE_LIMITED",
    });
    expect(mocks.readForm).not.toHaveBeenCalled();
    expect(mocks.upload).not.toHaveBeenCalled();
    expect(mocks.commit).not.toHaveBeenCalled();
  });

  it.each([
    { policyVersion: "development-2026-11-04" },
    { policyVersion: SIGNING_SHARING_POLICY_VERSION },
    { consent: "false" },
    { owner_id: outsider },
    { recipientId: recipient },
    { storage_path: "browser-owned/path.pdf" },
    { source_sha256: "f".repeat(64) },
  ] as Record<string, string>[])(
    "rejects legacy consent, missing consent or injected draft authority before storage",
    async (extra) => {
      mocks.readForm.mockResolvedValue(form(extra));
      await expect(uploadSigningDraft(uploadRequest())).rejects.toThrow();
      expect(mocks.upload).not.toHaveBeenCalled();
      expect(mocks.commit).not.toHaveBeenCalled();
    },
  );

  it("does not store or insert when PDF inspection rejects the file", async () => {
    mocks.validate.mockRejectedValue(
      new ApiError(422, "INVALID_PDF", "PDF tidak valid."),
    );
    await expect(uploadSigningDraft(uploadRequest())).rejects.toMatchObject({
      status: 422,
      code: "INVALID_PDF",
    });
    expect(mocks.upload).not.toHaveBeenCalled();
    expect(mocks.commit).not.toHaveBeenCalled();
  });

  it("rejects a padded filename before Storage so a committed receipt cannot conflict with SQL canonicalization", async () => {
    const padded = form();
    padded.set(
      "file",
      new File([bytes], " UJI DEVELOPMENT.pdf", { type: "application/pdf" }),
    );
    mocks.readForm.mockResolvedValue(padded);
    await expect(uploadSigningDraft(uploadRequest())).rejects.toMatchObject({
      status: 422,
      code: "INVALID_FILENAME",
    });
    expect(mocks.validate).not.toHaveBeenCalled();
    expect(mocks.upload).not.toHaveBeenCalled();
    expect(mocks.commit).not.toHaveBeenCalled();
  });

  it("returns an identical existing receipt without a second Storage or SQL write", async () => {
    mocks.receipts = [reply(version())];
    expect(await uploadSigningDraft(uploadRequest())).toEqual({
      documentId,
      versionId,
      versionNo: 1,
      status: "draft",
      createdAt: timestamp,
    });
    expect(mocks.upload).not.toHaveBeenCalled();
    expect(mocks.commit).not.toHaveBeenCalled();
    expect(mocks.predicates).toEqual(
      expect.arrayContaining([
        { table: "signing_document_versions", field: "owner_id", value: owner },
        {
          table: "signing_document_versions",
          field: "document_id",
          value: documentId,
        },
        { table: "signing_document_versions", field: "id", value: versionId },
      ]),
    );
  });

  it.each([
    { title: "Another title" },
    { source_sha256: "f".repeat(64) },
    { original_filename: "another.pdf" },
    { upload_policy_version: "legacy-review-policy" },
  ])(
    "rejects idempotency reuse for different persisted content",
    async (extra) => {
      mocks.receipts = [reply(version(extra))];
      await expect(uploadSigningDraft(uploadRequest())).rejects.toMatchObject({
        status: 409,
        code: "IDEMPOTENCY_CONFLICT",
      });
      expect(mocks.upload).not.toHaveBeenCalled();
      expect(mocks.commit).not.toHaveBeenCalled();
      expect(mocks.remove).not.toHaveBeenCalled();
    },
  );

  it("stops before Storage if an earlier receipt cannot be checked", async () => {
    mocks.receipts = [{ data: null, error: { message: "private SQL detail" } }];
    await expect(uploadSigningDraft(uploadRequest())).rejects.toMatchObject({
      status: 503,
      code: "SIGNING_UNAVAILABLE",
    });
    expect(mocks.upload).not.toHaveBeenCalled();
    expect(mocks.commit).not.toHaveBeenCalled();
  });

  it("removes only its newly created object after definite SQL rollback and confirmed absence", async () => {
    mocks.receipts = [reply(null), reply(null)];
    mocks.commit.mockResolvedValue({
      data: null,
      error: { code: "P0001", message: "SIGNING_DOCUMENT_NOT_ELIGIBLE" },
    });
    await expect(uploadSigningDraft(uploadRequest())).rejects.toMatchObject({
      status: 409,
      code: "DOCUMENT_NOT_ELIGIBLE",
    });
    expect(mocks.upload).toHaveBeenCalledOnce();
    expect(mocks.privilegedFrom).toHaveBeenCalledTimes(2);
    expect(mocks.remove).toHaveBeenCalledExactlyOnceWith([path]);
    expect(mocks.remove.mock.invocationCallOrder[0]).toBeGreaterThan(
      mocks.privilegedFrom.mock.invocationCallOrder[1]!,
    );
  });

  it("retains its bytes when the rollback is definite but absence is unconfirmed", async () => {
    mocks.receipts = [
      reply(null),
      { data: null, error: { message: "query unavailable" } },
    ];
    mocks.commit.mockResolvedValue({ data: null, error: { code: "23505" } });
    await expect(uploadSigningDraft(uploadRequest())).rejects.toMatchObject({
      status: 503,
      code: "UPLOAD_UNCONFIRMED",
    });
    expect(mocks.remove).not.toHaveBeenCalled();
  });

  it.each(["network-throw", "network-code", "success-without-receipt"])(
    "preserves bytes after an uncertain %s SQL outcome",
    async (kind) => {
      mocks.receipts = [reply(null), reply(null)];
      if (kind === "network-throw")
        mocks.commit.mockRejectedValue(new Error("private network failure"));
      else if (kind === "network-code")
        mocks.commit.mockResolvedValue({
          data: null,
          error: { code: "EPIPE" },
        });
      await expect(uploadSigningDraft(uploadRequest())).rejects.toMatchObject({
        status: 503,
        code: "UPLOAD_UNCONFIRMED",
      });
      expect(mocks.upload).toHaveBeenCalledOnce();
      expect(mocks.remove).not.toHaveBeenCalled();
    },
  );

  it("recovers a committed receipt after losing the RPC response without deleting bytes", async () => {
    mocks.commit.mockRejectedValue(new Error("response lost after commit"));
    expect(await uploadSigningDraft(uploadRequest())).toMatchObject({
      status: "draft",
      documentId,
      versionId,
    });
    expect(mocks.remove).not.toHaveBeenCalled();
  });

  it("does not delete an existing private object after Storage returns 409", async () => {
    mocks.receipts = [reply(null), reply(null)];
    mocks.upload.mockResolvedValue({
      data: null,
      error: { statusCode: "409" },
    });
    await expect(uploadSigningDraft(uploadRequest())).rejects.toMatchObject({
      status: 409,
      code: "UPLOAD_IN_PROGRESS",
    });
    expect(mocks.commit).not.toHaveBeenCalled();
    expect(mocks.remove).not.toHaveBeenCalled();
  });

  it("can recover an identical race winner after Storage 409 without SQL or cleanup", async () => {
    mocks.upload.mockResolvedValue({ data: null, error: { statusCode: 409 } });
    expect(await uploadSigningDraft(uploadRequest())).toMatchObject({
      status: "draft",
      versionId,
    });
    expect(mocks.commit).not.toHaveBeenCalled();
    expect(mocks.remove).not.toHaveBeenCalled();
  });
});

describe("R2 private source serving I/O contracts with mocked provider", () => {
  it("authenticates before configuration, metadata or Storage I/O", async () => {
    mocks.session.mockRejectedValue(
      new ApiError(401, "UNAUTHENTICATED", "Masuk dahulu."),
    );
    await expect(
      serveSigningFile(fileRequest(), documentId),
    ).rejects.toMatchObject({ status: 401 });
    expect(mocks.configuration).not.toHaveBeenCalled();
    expect(mocks.userClient).not.toHaveBeenCalled();
    expect(mocks.privilegedClient).not.toHaveBeenCalled();
  });

  it("retains the development gate before querying source metadata", async () => {
    mocks.configuration.mockImplementation(() => {
      throw new ApiError(
        503,
        "UPLOAD_UNAVAILABLE",
        "Lingkungan belum tersedia.",
      );
    });
    await expect(
      serveSigningFile(fileRequest(), documentId),
    ).rejects.toMatchObject({ status: 503 });
    expect(mocks.userClient).not.toHaveBeenCalled();
    expect(mocks.download).not.toHaveBeenCalled();
  });

  it.each(["missing", "uninvited", "cancelled", "expired", "rejected"])(
    "returns generic 404 for an RLS-hidden %s source without privileged download",
    async () => {
      mocks.session.mockResolvedValue({
        user: { id: outsider, emailConfirmed: true },
        roles: ["user", "platform_admin"],
      });
      mocks.userReplies.signing_document_versions = [reply(null)];
      await expect(
        serveSigningFile(fileRequest(), documentId),
      ).rejects.toMatchObject({ status: 404, code: "NOT_FOUND" });
      expect(mocks.userFrom).toHaveBeenCalledExactlyOnceWith(
        "signing_document_versions",
      );
      expect(mocks.privilegedClient).not.toHaveBeenCalled();
      expect(mocks.download).not.toHaveBeenCalled();
    },
  );

  it.each([
    ["malformed document ID", "not-a-uuid", ""],
    ["malformed version ID", documentId, "?versionId=storage/path.pdf"],
  ])(
    "rejects %s before metadata or Storage access",
    async (_label, id, query) => {
      await expect(
        serveSigningFile(fileRequest(query), id),
      ).rejects.toMatchObject({ status: 404, code: "NOT_FOUND" });
      expect(mocks.userClient).not.toHaveBeenCalled();
      expect(mocks.download).not.toHaveBeenCalled();
    },
  );

  it.each([owner, recipient])(
    "serves the exact source owner's path to RLS-authorized participant %s",
    async (actor) => {
      mocks.session.mockResolvedValue({
        user: { id: actor, emailConfirmed: true },
        roles: ["user"],
      });
      const response = await serveSigningFile(
        fileRequest(`?versionId=${versionId}`),
        documentId,
      );
      expect(new Uint8Array(await response.arrayBuffer())).toEqual(bytes);
      expect(mocks.download).toHaveBeenCalledExactlyOnceWith(path);
      expect(
        mocks.predicates.filter(
          ({ table, field }) =>
            table === "signing_document_versions" && field === "document_id",
        ),
      ).toEqual([
        {
          table: "signing_document_versions",
          field: "document_id",
          value: documentId,
        },
        {
          table: "signing_document_versions",
          field: "document_id",
          value: documentId,
        },
      ]);
      expect(mocks.predicates.filter(({ field }) => field === "id")).toEqual([
        { table: "signing_document_versions", field: "id", value: versionId },
        { table: "signing_document_versions", field: "id", value: versionId },
      ]);
      if (actor === recipient) {
        for (const [field, value] of Object.entries({
          document_id: documentId,
          source_version_id: versionId,
          owner_id: owner,
          recipient_id: recipient,
        }))
          expect(
            mocks.predicates.filter(
              (predicate) =>
                predicate.table === "signing_requests" &&
                predicate.field === field,
            ),
          ).toEqual([
            { table: "signing_requests", field, value },
            { table: "signing_requests", field, value },
          ]);
      } else {
        expect(mocks.userFrom).not.toHaveBeenCalledWith("signing_requests");
      }
      expect(mocks.signedUrl).not.toHaveBeenCalled();
    },
  );

  it.each([
    { storage_path: `${recipient}/signing/${documentId}/${versionId}.pdf` },
    { storage_path: `${owner}/signing/../${versionId}.pdf` },
    { storage_path: `${owner}/${documentId}/${versionId}.pdf` },
    { file_size_bytes: 0 },
    { file_size_bytes: 10 * 1024 * 1024 + 1 },
  ])(
    "rejects malformed source path or bounds before privileged download",
    async (extra) => {
      mocks.userReplies.signing_document_versions = [reply(version(extra))];
      await expect(
        serveSigningFile(fileRequest(), documentId),
      ).rejects.toMatchObject({ status: 503, code: "FILE_UNAVAILABLE" });
      expect(mocks.privilegedClient).not.toHaveBeenCalled();
      expect(mocks.download).not.toHaveBeenCalled();
    },
  );

  it.each(["cancelled", "expired", "rejected", "missing"])(
    "rejects a non-owner's %s invitation before Storage even if a stale version row was returned",
    async (status) => {
      mocks.session.mockResolvedValue({
        user: { id: recipient },
        roles: ["user"],
      });
      mocks.userReplies.signing_requests = [
        reply(
          status === "missing"
            ? null
            : {
                id: "64000000-0000-4000-8000-000000000001",
                status: status === "expired" ? "pending" : status,
                expires_at: "2026-11-05T11:59:59.000Z",
              },
        ),
      ];
      await expect(
        serveSigningFile(fileRequest(), documentId),
      ).rejects.toMatchObject({ status: 404 });
      expect(mocks.download).not.toHaveBeenCalled();
      expect(mocks.privilegedClient).not.toHaveBeenCalled();
    },
  );

  it.each(["consented", "completed"])(
    "preserves recipient file access for a reserved %s record after its original invitation window",
    async (status) => {
      mocks.session.mockResolvedValue({
        user: { id: recipient },
        roles: ["user"],
      });
      const grant = reply({
        id: "64000000-0000-4000-8000-000000000001",
        status,
        expires_at: "2026-11-01T00:00:00.000Z",
      });
      mocks.userReplies.signing_requests = [grant, grant];
      const response = await serveSigningFile(fileRequest(), documentId);
      expect(new Uint8Array(await response.arrayBuffer())).toEqual(bytes);
    },
  );

  it("discards bytes when the recipient relationship ends during download despite a stale version row", async () => {
    mocks.session.mockResolvedValue({
      user: { id: recipient },
      roles: ["user"],
    });
    mocks.userReplies.signing_requests = [
      reply({
        id: "64000000-0000-4000-8000-000000000001",
        status: "pending",
        expires_at: "2026-11-12T00:00:00.000Z",
      }),
      reply({
        id: "64000000-0000-4000-8000-000000000001",
        status: "cancelled",
        expires_at: "2026-11-12T00:00:00.000Z",
      }),
    ];
    await expect(
      serveSigningFile(fileRequest(), documentId),
    ).rejects.toMatchObject({ status: 404 });
    expect(mocks.download).toHaveBeenCalledOnce();
  });

  it("fails closed on unavailable RLS metadata without a privileged fallback", async () => {
    mocks.userReplies.signing_document_versions = [
      { data: null, error: { message: "private database detail" } },
    ];
    await expect(
      serveSigningFile(fileRequest(), documentId),
    ).rejects.toMatchObject({
      status: 503,
      code: "FILE_UNAVAILABLE",
      message: "File sementara tidak tersedia.",
    });
    expect(mocks.privilegedClient).not.toHaveBeenCalled();
  });

  it("does not return bytes when their SHA-256 differs from the immutable version", async () => {
    mocks.userReplies.signing_document_versions = [
      reply(version({ source_sha256: "f".repeat(64) })),
    ];
    await expect(
      serveSigningFile(fileRequest(), documentId),
    ).rejects.toMatchObject({ status: 503, code: "FILE_UNAVAILABLE" });
    expect(mocks.download).toHaveBeenCalledOnce();
    expect(mocks.userFrom).toHaveBeenCalledTimes(1);
  });

  it("does not return bytes whose length differs from immutable metadata", async () => {
    mocks.userReplies.signing_document_versions = [
      reply(version({ file_size_bytes: bytes.byteLength + 1 })),
    ];
    await expect(
      serveSigningFile(fileRequest(), documentId),
    ).rejects.toMatchObject({ status: 503, code: "FILE_UNAVAILABLE" });
    expect(mocks.userFrom).toHaveBeenCalledTimes(1);
  });

  it.each(["cancelled", "expired"])(
    "discards buffered bytes when access is %s during download",
    async () => {
      mocks.session.mockResolvedValue({
        user: { id: recipient, emailConfirmed: true },
        roles: ["user"],
      });
      mocks.userReplies.signing_document_versions = [
        reply(version()),
        reply(null),
      ];
      await expect(
        serveSigningFile(fileRequest(), documentId),
      ).rejects.toMatchObject({ status: 404, code: "NOT_FOUND" });
      expect(mocks.download).toHaveBeenCalledExactlyOnceWith(path);
      expect(mocks.userFrom.mock.invocationCallOrder[2]).toBeGreaterThan(
        mocks.download.mock.invocationCallOrder[0]!,
      );
    },
  );

  it("discards buffered bytes if the post-download authorization recheck fails", async () => {
    mocks.userReplies.signing_document_versions = [
      reply(version()),
      { data: null, error: { message: "recheck unavailable" } },
    ];
    await expect(
      serveSigningFile(fileRequest(), documentId),
    ).rejects.toMatchObject({ status: 503, code: "FILE_UNAVAILABLE" });
    expect(mocks.download).toHaveBeenCalledOnce();
  });

  it("returns private security headers and an encoded filename without issuing a bearer URL", async () => {
    const response = await serveSigningFile(fileRequest(), documentId);
    expect(response.status).toBe(200);
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(bytes);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("vary")).toBe("Cookie");
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(response.headers.get("content-length")).toBe(
      String(bytes.byteLength),
    );
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
    expect(response.headers.get("x-frame-options")).toBe("SAMEORIGIN");
    expect(response.headers.get("content-security-policy")).toContain(
      "frame-ancestors 'self'; sandbox",
    );
    expect(response.headers.get("content-disposition")).toBe(
      `inline; filename="document.pdf"; filename*=UTF-8''${encodeURIComponent(filename).replace(/[\u0027()*]/g, (value) => `%${value.charCodeAt(0).toString(16).toUpperCase()}`)}`,
    );
    expect(response.headers.has("location")).toBe(false);
    expect(mocks.signedUrl).not.toHaveBeenCalled();
  });

  it.each(["bytes=2-5", "bytes=-5"])(
    "returns only an authorized range %s after integrity and permission checks",
    async (range) => {
      const response = await serveSigningFile(
        fileRequest("?download=1", range),
        documentId,
      );
      const start = range === "bytes=2-5" ? 2 : bytes.length - 5;
      const end = range === "bytes=2-5" ? 5 : bytes.length - 1;
      expect(response.status).toBe(206);
      expect(response.headers.get("content-range")).toBe(
        `bytes ${start}-${end}/${bytes.length}`,
      );
      expect(response.headers.get("content-disposition")).toMatch(
        /^attachment;/,
      );
      expect(response.headers.get("cache-control")).toBe("private, no-store");
      expect(new Uint8Array(await response.arrayBuffer())).toEqual(
        bytes.slice(start, end + 1),
      );
      expect(mocks.userFrom).toHaveBeenCalledTimes(2);
    },
  );

  it.each([
    "bytes=5-2",
    "bytes=99999-",
    "bytes=-0",
    "bytes=0-1,3-4",
    "invalid",
  ])("returns a private empty 416 for unsupported range %s", async (range) => {
    const response = await serveSigningFile(fileRequest("", range), documentId);
    expect(response.status).toBe(416);
    expect(response.headers.get("content-range")).toBe(
      `bytes */${bytes.length}`,
    );
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect((await response.arrayBuffer()).byteLength).toBe(0);
  });
});
