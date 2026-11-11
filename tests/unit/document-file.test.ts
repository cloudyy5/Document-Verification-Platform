import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  server: vi.fn(),
  privileged: vi.fn(),
  from: vi.fn(),
  bucket: vi.fn(),
  download: vi.fn(),
  signedUrl: vi.fn(),
  filters: [] as { table: string; field: string; value: unknown }[],
  document: { data: null as unknown, error: null as unknown },
  submission: { data: null as unknown, error: null as unknown },
}));
vi.mock("server-only", () => ({}));
vi.mock("@/server/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/api")>()),
  apiSession: mocks.session,
}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: mocks.server,
}));
vi.mock("@/lib/supabase/privileged", () => ({
  createPrivilegedSupabaseClient: mocks.privileged,
}));

import { ApiError } from "@/server/errors";
import { serveDocumentFile } from "@/server/documents/file";

// Provider/storage responses are mocked. These tests verify serving authority,
// integrity and HTTP behavior; they do not claim a real Storage connection.
const owner = "71000000-0000-4000-8000-000000000001";
const otherOwner = "71000000-0000-4000-8000-000000000002";
const documentId = "72000000-0000-4000-8000-000000000001";
const submissionId = "73000000-0000-4000-8000-000000000001";
const olderSubmissionId = "73000000-0000-4000-8000-000000000002";
const bytes = new Uint8Array(
  Buffer.from("%PDF-1.7\nSynthetic private file serving fixture\n%%EOF"),
);
const filename = 'Surat "A"; β.pdf';

function source(overrides: Record<string, unknown> = {}) {
  return {
    id: submissionId,
    storage_bucket: "document-submissions",
    storage_path: `${owner}/${documentId}/${submissionId}.pdf`,
    original_filename: filename,
    file_size_bytes: bytes.byteLength,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    ...overrides,
  };
}
function request(query = "", range?: string) {
  return new Request(
    `http://127.0.0.1:3000/api/v1/documents/${documentId}/file${query}`,
    { headers: range ? { Range: range } : {} },
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.filters = [];
  mocks.session.mockResolvedValue({
    user: { id: owner, emailConfirmed: true },
    roles: ["user"],
  });
  mocks.document = {
    data: { id: documentId, current_version_no: 2 },
    error: null,
  };
  mocks.submission = { data: source(), error: null };
  mocks.from.mockImplementation((table: string) => {
    const query = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn((field: string, value: unknown) => {
        mocks.filters.push({ table, field, value });
        return query;
      }),
      maybeSingle: vi.fn(async () =>
        table === "documents" ? mocks.document : mocks.submission,
      ),
    };
    return query;
  });
  mocks.server.mockResolvedValue({ from: mocks.from });
  mocks.bucket.mockReturnValue({
    download: mocks.download,
    createSignedUrl: mocks.signedUrl,
  });
  mocks.privileged.mockReturnValue({ storage: { from: mocks.bucket } });
  mocks.download.mockResolvedValue({
    data: new Blob([bytes], { type: "application/pdf" }),
    error: null,
  });
});

describe("owner-only private PDF serving with mocked provider", () => {
  it("rejects guests before constructing a database or privileged client", async () => {
    mocks.session.mockRejectedValue(
      new ApiError(401, "UNAUTHENTICATED", "Sign in required"),
    );
    await expect(
      serveDocumentFile(request(), documentId),
    ).rejects.toMatchObject({ status: 401 });
    expect(mocks.server).not.toHaveBeenCalled();
    expect(mocks.privileged).not.toHaveBeenCalled();
  });

  it("returns generic 404 for an absent/foreign document without requesting file metadata or Storage", async () => {
    mocks.document = { data: null, error: null };
    await expect(
      serveDocumentFile(request(), documentId),
    ).rejects.toMatchObject({ status: 404, code: "NOT_FOUND" });
    expect(mocks.from.mock.calls).toEqual([["documents"]]);
    expect(mocks.privileged).not.toHaveBeenCalled();
  });

  it.each(["user", "reviewer", "platform_admin"])(
    "retains explicit owner/submission filters for a %s account",
    async (role) => {
      mocks.session.mockResolvedValue({ user: { id: owner }, roles: [role] });
      await serveDocumentFile(request(), documentId);
      expect(mocks.filters).toEqual(
        expect.arrayContaining([
          { table: "documents", field: "id", value: documentId },
          { table: "documents", field: "owner_id", value: owner },
          {
            table: "document_submissions",
            field: "document_id",
            value: documentId,
          },
          {
            table: "document_submissions",
            field: "submitted_by",
            value: owner,
          },
          { table: "document_submissions", field: "version_no", value: 2 },
        ]),
      );
    },
  );

  it.each(["bucket", "owner-path", "size-zero", "size-large"])(
    "rejects invalid private file metadata: %s",
    async (kind) => {
      mocks.submission = {
        data: source(
          kind === "bucket"
            ? { storage_bucket: "public" }
            : kind === "owner-path"
              ? { storage_path: `${otherOwner}/foreign.pdf` }
              : {
                  file_size_bytes:
                    kind === "size-zero" ? 0 : 10 * 1024 * 1024 + 1,
                },
        ),
        error: null,
      };
      await expect(
        serveDocumentFile(request(), documentId),
      ).rejects.toMatchObject({ status: 503, code: "FILE_UNAVAILABLE" });
      expect(mocks.privileged).not.toHaveBeenCalled();
      expect(mocks.download).not.toHaveBeenCalled();
    },
  );

  it("does not serve bytes when Storage length differs from the immutable metadata", async () => {
    mocks.submission = {
      data: source({ file_size_bytes: bytes.byteLength + 1 }),
      error: null,
    };
    await expect(
      serveDocumentFile(request(), documentId),
    ).rejects.toMatchObject({ status: 503 });
  });

  it("does not serve replaced or corrupted bytes whose SHA-256 differs", async () => {
    mocks.submission = {
      data: source({ sha256: "f".repeat(64) }),
      error: null,
    };
    await expect(
      serveDocumentFile(request(), documentId),
    ).rejects.toMatchObject({ status: 503 });
  });

  it("returns bytes with private security headers and encoded filename without signed URLs", async () => {
    const response = await serveDocumentFile(request(), documentId);
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
      `inline; filename="document.pdf"; filename*=UTF-8''${encodeURIComponent(filename)}`,
    );
    expect(mocks.bucket).toHaveBeenCalledExactlyOnceWith(
      "document-submissions",
    );
    expect(mocks.download).toHaveBeenCalledExactlyOnceWith(
      source().storage_path,
    );
    expect(mocks.signedUrl).not.toHaveBeenCalled();
  });

  it("supports owner-authorized historical submission selection and explicit download", async () => {
    mocks.submission = {
      data: source({
        id: olderSubmissionId,
        storage_path: `${owner}/${documentId}/${olderSubmissionId}.pdf`,
      }),
      error: null,
    };
    const response = await serveDocumentFile(
      request(`?submissionId=${olderSubmissionId}&download=1`),
      documentId,
    );
    expect(response.headers.get("content-disposition")).toMatch(/^attachment;/);
    expect(mocks.filters).toContainEqual({
      table: "document_submissions",
      field: "id",
      value: olderSubmissionId,
    });
    expect(mocks.filters).toContainEqual({
      table: "document_submissions",
      field: "submitted_by",
      value: owner,
    });
    expect(mocks.filters.some((filter) => filter.field === "version_no")).toBe(
      false,
    );
  });

  it.each(["bytes=2-5", "bytes=-5"])(
    "returns only the requested valid range %s",
    async (range) => {
      const start = range === "bytes=2-5" ? 2 : bytes.byteLength - 5;
      const end = range === "bytes=2-5" ? 5 : bytes.byteLength - 1;
      const response = await serveDocumentFile(request("", range), documentId);
      expect(response.status).toBe(206);
      expect(response.headers.get("content-range")).toBe(
        `bytes ${start}-${end}/${bytes.byteLength}`,
      );
      expect(new Uint8Array(await response.arrayBuffer())).toEqual(
        bytes.slice(start, end + 1),
      );
      expect(response.headers.get("cache-control")).toContain("no-store");
    },
  );

  it.each([
    "bytes=99999-",
    "bytes=5-2",
    "bytes=-0",
    "bytes=0-1,3-4",
    "malformed",
  ])("rejects unsatisfiable/unsupported range %s", async (range) => {
    const response = await serveDocumentFile(request("", range), documentId);
    expect(response.status).toBe(416);
    expect(response.headers.get("content-range")).toBe(
      `bytes */${bytes.byteLength}`,
    );
    expect((await response.arrayBuffer()).byteLength).toBe(0);
    expect(response.headers.get("cache-control")).toContain("no-store");
  });
});
