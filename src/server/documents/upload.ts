import "server-only";
import { createHash, createHmac, randomUUID } from "node:crypto";
import { z } from "zod";
import { apiSession, assertMutationOrigin } from "@/server/api";
import { ApiError } from "@/server/errors";
import { getAuthConfiguration } from "@/lib/auth/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createPrivilegedSupabaseClient } from "@/lib/supabase/privileged";
import {
  parseSubmissionFields,
  type SubmissionMetadata,
} from "@/lib/documents/validation";
import type { Database } from "@/types/database";
import { getSubmissionConfiguration } from "./config";
import { readLimitedFormData } from "./multipart";
import { validatePdf } from "./pdf";
import { acquireUploadSlot } from "./upload-slot";

type Submission = Database["public"]["Tables"]["document_submissions"]["Row"];
type Client = ReturnType<typeof createPrivilegedSupabaseClient>;
const bucket = "document-submissions";
const submissionSelect =
  "id,document_id,version_no,status,submitted_by,title,category_id,custom_document_type,document_date,issuing_institution,description,original_filename,file_size_bytes,sha256,policy_version,submitted_at";

/** Stable UUIDv8 scoped to the authenticated owner and operation, without secrets. */
export function derivedUploadId(
  ownerId: string,
  key: string,
  purpose: string,
): string {
  const bytes = createHash("sha256")
    .update(
      `dvp-upload-v1\0${ownerId.toLowerCase()}\0${key.toLowerCase()}\0${purpose}`,
    )
    .digest()
    .subarray(0, 16);
  bytes[6] = (bytes[6]! & 0x0f) | 0x80;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

async function findReceipt(
  client: Client,
  ownerId: string,
  documentId: string,
  submissionId: string,
) {
  const { data, error } = await client
    .from("document_submissions")
    .select(submissionSelect)
    .eq("id", submissionId)
    .eq("document_id", documentId)
    .eq("submitted_by", ownerId)
    .maybeSingle();
  return { data, certain: !error };
}

type ReceiptRow = NonNullable<Awaited<ReturnType<typeof findReceipt>>["data"]>;
function matches(
  row: ReceiptRow,
  metadata: SubmissionMetadata,
  file: File,
  sha256: string,
): boolean {
  return (
    row.title === metadata.title &&
    row.category_id === metadata.categoryId &&
    row.custom_document_type === metadata.customDocumentType &&
    row.document_date === metadata.documentDate &&
    row.issuing_institution === metadata.issuingInstitution &&
    row.description === metadata.description &&
    row.original_filename === file.name &&
    row.file_size_bytes === file.size &&
    row.sha256 === sha256 &&
    row.policy_version === metadata.policyVersion
  );
}
function receipt(row: ReceiptRow) {
  return {
    documentId: row.document_id,
    submissionId: row.id,
    versionNo: row.version_no,
    status: row.status,
    submittedAt: row.submitted_at,
  };
}
function sameRequestOrConflict(
  row: ReceiptRow,
  metadata: SubmissionMetadata,
  file: File,
  sha256: string,
) {
  if (!matches(row, metadata, file, sha256))
    throw new ApiError(
      409,
      "IDEMPOTENCY_CONFLICT",
      "Permintaan ini sudah digunakan untuk pengajuan berbeda. Periksa Dokumen Saya sebelum mengajukan kembali.",
    );
  return receipt(row);
}

async function allowUpload(client: Client, ownerId: string) {
  const { flowSecret } = getAuthConfiguration();
  const digest = (value: string) =>
    createHmac("sha256", flowSecret).update(value).digest("hex");
  const { data, error } = await client.rpc("consume_document_upload_limit", {
    p_key_digest: digest(`upload\0${ownerId}`),
    p_global_digest: digest("upload\0application"),
  });
  if (error)
    throw new ApiError(
      503,
      "UPLOAD_UNAVAILABLE",
      "Layanan pengajuan sementara tidak tersedia.",
    );
  if (data !== true)
    throw new ApiError(
      429,
      "RATE_LIMITED",
      "Terlalu banyak pengajuan. Tunggu beberapa saat sebelum mencoba kembali.",
    );
}

/** All identities, object names, byte hashes and policy values are server derived. */
export async function uploadSubmission(
  request: Request,
  targetDocumentId?: string,
) {
  const session = await apiSession("user");
  assertMutationOrigin(request.headers.get("origin"));
  if (!session.user.emailConfirmed)
    throw new ApiError(
      403,
      "EMAIL_VERIFICATION_REQUIRED",
      "Verifikasi email sebelum mengajukan dokumen.",
    );
  if (!session.roles.includes("user"))
    throw new ApiError(
      403,
      "FORBIDDEN",
      "Akun belum dapat mengajukan dokumen.",
    );
  const configuration = getSubmissionConfiguration();
  const keyInput = request.headers.get("idempotency-key") ?? randomUUID();
  if (!z.uuid().safeParse(keyInput).success)
    throw new ApiError(
      400,
      "INVALID_IDEMPOTENCY_KEY",
      "Referensi permintaan tidak valid. Muat ulang formulir.",
    );
  const key = keyInput.toLowerCase();
  if (targetDocumentId && !z.uuid().safeParse(targetDocumentId).success)
    throw new ApiError(404, "NOT_FOUND", "Dokumen tidak ditemukan.");
  const documentId =
    targetDocumentId?.toLowerCase() ??
    derivedUploadId(session.user.id, key, "document");
  const submissionId = derivedUploadId(
    session.user.id,
    key,
    targetDocumentId ? `revision:${documentId}` : "submission",
  );
  const userClient = await createSupabaseServerClient();
  let existingDocument: { id: string; current_status: string } | null = null;
  if (targetDocumentId) {
    const result = await userClient
      .from("documents")
      .select("id,current_status")
      .eq("id", documentId)
      .eq("owner_id", session.user.id)
      .maybeSingle();
    if (result.error)
      throw new ApiError(
        503,
        "WORKSPACE_UNAVAILABLE",
        "Data dokumen sementara tidak tersedia.",
      );
    if (!result.data)
      throw new ApiError(404, "NOT_FOUND", "Dokumen tidak ditemukan.");
    existingDocument = result.data;
  }
  // Per-process memory guard is separate from the persistent distributed limiter.
  const releaseUpload = acquireUploadSlot();
  try {
    const privileged = createPrivilegedSupabaseClient();
    await allowUpload(privileged, session.user.id);
    const form = await readLimitedFormData(request, configuration.maxBytes);
    const categoryId = z
      .uuid("Pilih kategori yang tersedia.")
      .parse(form.get("categoryId"));
    const category = await userClient
      .from("document_categories")
      .select("id,slug")
      .eq("id", categoryId)
      .eq("is_active", true)
      .maybeSingle();
    if (category.error)
      throw new ApiError(
        503,
        "CATEGORIES_UNAVAILABLE",
        "Kategori sementara tidak tersedia.",
      );
    if (!category.data)
      throw new ApiError(
        422,
        "INVALID_CATEGORY",
        "Pilih kategori dokumen yang tersedia.",
        [{ field: "categoryId", message: "Kategori tidak tersedia." }],
      );
    const metadata = parseSubmissionFields(
      form,
      configuration.policyVersion,
      category.data.slug === "lainnya",
    );
    metadata.categoryId = category.data.id;
    const file = form.get("file");
    if (!(file instanceof File))
      throw new ApiError(422, "INVALID_FILE", "Pilih file PDF untuk diajukan.");
    const inspected = await validatePdf(file, configuration.maxBytes);
    const previous = await findReceipt(
      privileged,
      session.user.id,
      documentId,
      submissionId,
    );
    if (!previous.certain)
      throw new ApiError(
        503,
        "WORKSPACE_UNAVAILABLE",
        "Status pengajuan belum dapat diperiksa. Coba kembali.",
      );
    if (previous.data)
      return sameRequestOrConflict(
        previous.data,
        metadata,
        file,
        inspected.sha256,
      );
    // A completed revision retry is handled above, even after state became pending.
    if (
      existingDocument &&
      existingDocument.current_status !== "revision_requested"
    )
      throw new ApiError(
        409,
        "DOCUMENT_NOT_ELIGIBLE",
        "Dokumen hanya dapat direvisi setelah permintaan revisi. Pengajuan setelah ditolak dibuat sebagai dokumen baru.",
      );
    const path = `${session.user.id}/${documentId}/${submissionId}.pdf`;
    const stored = await privileged.storage
      .from(bucket)
      .upload(path, inspected.bytes, {
        contentType: "application/pdf",
        cacheControl: "0",
        upsert: false,
      });
    if (stored.error) {
      const recovered = await findReceipt(
        privileged,
        session.user.id,
        documentId,
        submissionId,
      );
      if (recovered.data)
        return sameRequestOrConflict(
          recovered.data,
          metadata,
          file,
          inspected.sha256,
        );
      if (
        "statusCode" in stored.error &&
        String(stored.error.statusCode) === "409"
      )
        throw new ApiError(
          409,
          "UPLOAD_IN_PROGRESS",
          "Permintaan ini sedang diproses atau perlu diperiksa. Lihat Dokumen Saya sebelum mencoba kembali.",
        );
      throw new ApiError(
        503,
        "STORAGE_UNAVAILABLE",
        "File belum dapat disimpan. Silakan coba kembali.",
      );
    }
    const args = {
      p_owner_id: session.user.id,
      p_document_id: documentId,
      p_submission_id: submissionId,
      p_title: metadata.title,
      p_category_id: metadata.categoryId,
      p_custom_document_type: metadata.customDocumentType,
      p_document_date: metadata.documentDate,
      p_issuing_institution: metadata.issuingInstitution,
      p_description: metadata.description,
      p_original_filename: file.name,
      p_file_size_bytes: file.size,
      p_sha256: inspected.sha256,
      p_storage_path: path,
      p_policy_version: configuration.policyVersion,
      p_consent: true,
    };
    let failure: { code?: string } | null = null;
    try {
      const result = targetDocumentId
        ? await privileged.rpc("create_document_resubmission", args)
        : await privileged.rpc("create_document_submission", args);
      failure = result.error;
    } catch {
      failure = {};
    }
    const committed = await findReceipt(
      privileged,
      session.user.id,
      documentId,
      submissionId,
    );
    if (committed.data)
      return sameRequestOrConflict(
        committed.data,
        metadata,
        file,
        inspected.sha256,
      );
    // Delete only a file created here, after a definite SQL rollback and a
    // successful absence check. A network failure may hide a committed RPC.
    const definiteRollback = Boolean(
      failure?.code &&
      new Set([
        "P0001",
        "P0002",
        "23505",
        "42501",
        "22023",
        "23503",
        "23514",
        "23502",
        "22001",
        "22P02",
        "40001",
        "40P01",
        "PGRST202",
      ]).has(failure.code),
    );
    if (definiteRollback && committed.certain) {
      const cleanup = await privileged.storage.from(bucket).remove([path]);
      if (cleanup.error)
        console.error("document-upload cleanup requires reconciliation", {
          requestId: randomUUID(),
        });
      if (failure?.code === "P0001" || failure?.code === "23505")
        throw new ApiError(
          409,
          "STATE_CONFLICT",
          "Status dokumen telah berubah. Periksa detail dokumen sebelum mengajukan kembali.",
        );
      if (failure?.code === "42501")
        throw new ApiError(
          403,
          "SUBMISSION_NOT_ALLOWED",
          "Akun atau status verifikasi email belum memenuhi syarat pengajuan.",
        );
      if (failure?.code === "22023")
        throw new ApiError(
          422,
          "VALIDATION_ERROR",
          "Data atau kategori pengajuan telah berubah. Muat ulang formulir.",
        );
      throw new ApiError(
        503,
        "SUBMISSION_UNAVAILABLE",
        "Pengajuan belum tersimpan. Silakan coba kembali.",
      );
    }
    console.error("document-upload outcome requires reconciliation", {
      requestId: randomUUID(),
    });
    throw new ApiError(
      503,
      "SUBMISSION_UNCERTAIN",
      "Status penyimpanan belum dapat dipastikan. Periksa Dokumen Saya sebelum mengulang permintaan yang sama.",
    );
  } finally {
    releaseUpload();
  }
}

export type SubmissionReceipt = Pick<Submission, "status"> & {
  documentId: string;
  submissionId: string;
  versionNo: number;
  submittedAt: string;
};
