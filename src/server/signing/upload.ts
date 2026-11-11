import "server-only";
import { createHmac } from "node:crypto";
import { z } from "zod";
import { apiSession, assertMutationOrigin } from "@/server/api";
import { ApiError } from "@/server/errors";
import { getAuthConfiguration } from "@/lib/auth/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createPrivilegedSupabaseClient } from "@/lib/supabase/privileged";
import { parseSigningDraftForm } from "@/lib/signing/validation";
import type { SubmissionMetadata } from "@/lib/documents/validation";
import type { Database } from "@/types/database";
import { derivedUploadId } from "@/server/documents/upload";
import { acquireUploadSlot } from "@/server/documents/upload-slot";
import { readLimitedFormData } from "@/server/documents/multipart";
import { validatePdf } from "@/server/documents/pdf";
import { getSigningConfiguration } from "./config";
import { mapSigningDatabaseError } from "./errors";

type Client = ReturnType<typeof createPrivilegedSupabaseClient>;
type Version = Database["public"]["Tables"]["signing_document_versions"]["Row"];
const bucket = "document-submissions";
const fields =
  "id,document_id,owner_id,version_no,title,category_id,custom_document_type,document_date,issuing_institution,description,original_filename,file_size_bytes,source_sha256,upload_policy_version,created_at";

async function findVersion(
  client: Client,
  owner: string,
  documentId: string,
  versionId: string,
) {
  const { data, error } = await client
    .from("signing_document_versions")
    .select(fields)
    .eq("owner_id", owner)
    .eq("document_id", documentId)
    .eq("id", versionId)
    .maybeSingle();
  return { data, certain: !error };
}
type Existing = NonNullable<Awaited<ReturnType<typeof findVersion>>["data"]>;
function matches(
  row: Existing,
  metadata: SubmissionMetadata,
  file: File,
  hash: string,
) {
  return (
    row.title === metadata.title &&
    row.category_id === metadata.categoryId &&
    row.custom_document_type === metadata.customDocumentType &&
    row.document_date === metadata.documentDate &&
    row.issuing_institution === metadata.issuingInstitution &&
    row.description === metadata.description &&
    row.original_filename === file.name &&
    row.file_size_bytes === file.size &&
    row.source_sha256 === hash &&
    row.upload_policy_version === metadata.policyVersion
  );
}
function receipt(
  row: Pick<Version, "document_id" | "id" | "version_no" | "created_at">,
) {
  return {
    documentId: row.document_id,
    versionId: row.id,
    versionNo: row.version_no,
    status: "draft" as const,
    createdAt: row.created_at,
  };
}
function existingReceipt(
  row: Existing,
  metadata: SubmissionMetadata,
  file: File,
  hash: string,
) {
  if (!matches(row, metadata, file, hash))
    throw new ApiError(
      409,
      "IDEMPOTENCY_CONFLICT",
      "Referensi unggahan sudah dipakai untuk data berbeda. Periksa dokumen persetujuan Anda.",
    );
  return receipt(row);
}

/** Creates only a private draft: no invitation, administrative review or QR. */
export async function uploadSigningDraft(request: Request) {
  const session = await apiSession("user");
  assertMutationOrigin(request.headers.get("origin"));
  if (!session.user.emailConfirmed)
    throw new ApiError(
      403,
      "EMAIL_VERIFICATION_REQUIRED",
      "Verifikasi email sebelum mengunggah dokumen.",
    );
  if (!session.roles.includes("user"))
    throw new ApiError(
      403,
      "SIGNING_NOT_ALLOWED",
      "Akun belum dapat menggunakan persetujuan internal.",
    );
  const configuration = getSigningConfiguration();
  const key = request.headers.get("idempotency-key");
  if (!z.uuid().safeParse(key).success)
    throw new ApiError(
      400,
      "INVALID_IDEMPOTENCY_KEY",
      "Referensi unggahan tidak valid. Muat ulang formulir.",
    );
  const owner = session.user.id.toLowerCase();
  const documentId = derivedUploadId(owner, key!, "signing-document");
  const versionId = derivedUploadId(owner, key!, "signing-source");
  const releaseUpload = acquireUploadSlot();
  try {
    const client = createPrivilegedSupabaseClient();
    const { flowSecret } = getAuthConfiguration();
    const digest = (value: string) =>
      createHmac("sha256", flowSecret).update(value).digest("hex");
    const quota = await client.rpc("consume_document_upload_limit", {
      p_key_digest: digest(`upload\0${owner}`),
      p_global_digest: digest("upload\0application"),
    });
    if (quota.error || typeof quota.data !== "boolean")
      throw new ApiError(
        503,
        "UPLOAD_UNAVAILABLE",
        "Layanan unggahan sementara tidak tersedia.",
      );
    if (!quota.data)
      throw new ApiError(
        429,
        "RATE_LIMITED",
        "Terlalu banyak unggahan. Tunggu sebelum mencoba kembali.",
      );
    const form = await readLimitedFormData(request, configuration.maxBytes);
    const categoryId = z
      .uuid("Pilih kategori yang tersedia.")
      .parse(form.get("categoryId"));
    const user = await createSupabaseServerClient();
    const category = await user
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
        "Pilih kategori yang tersedia.",
      );
    const metadata = parseSigningDraftForm(
      form,
      category.data.slug === "lainnya",
    );
    metadata.categoryId = category.data.id;
    const file = form.get("file");
    if (!(file instanceof File))
      throw new ApiError(422, "INVALID_FILE", "Pilih file PDF untuk disimpan.");
    if (file.name !== file.name.trim())
      throw new ApiError(
        422,
        "INVALID_FILENAME",
        "Hapus spasi di awal atau akhir nama file PDF, lalu pilih kembali.",
        [
          {
            field: "file",
            message: "Nama file tidak boleh diawali atau diakhiri spasi.",
          },
        ],
      );
    const inspected = await validatePdf(file, configuration.maxBytes);
    const prior = await findVersion(client, owner, documentId, versionId);
    if (!prior.certain)
      throw new ApiError(
        503,
        "SIGNING_UNAVAILABLE",
        "Status draft belum dapat diperiksa. Coba kembali.",
      );
    if (prior.data)
      return existingReceipt(prior.data, metadata, file, inspected.sha256);
    const path = `${owner}/signing/${documentId}/${versionId}.pdf`;
    let storageError: { statusCode?: string | number } | null = null;
    try {
      const stored = await client.storage
        .from(bucket)
        .upload(path, inspected.bytes, {
          contentType: "application/pdf",
          cacheControl: "0",
          upsert: false,
        });
      storageError = stored.error;
    } catch {
      storageError = {};
    }
    if (storageError) {
      const recovered = await findVersion(client, owner, documentId, versionId);
      if (recovered.data)
        return existingReceipt(
          recovered.data,
          metadata,
          file,
          inspected.sha256,
        );
      if (String(storageError.statusCode) === "409")
        throw new ApiError(
          409,
          "UPLOAD_IN_PROGRESS",
          "Unggahan sedang diproses atau perlu diperiksa. Lihat daftar dokumen sebelum mencoba lagi.",
        );
      throw new ApiError(
        503,
        "STORAGE_UNAVAILABLE",
        "File belum dapat disimpan. Coba kembali.",
      );
    }
    let failure: { code?: string; message?: string } | null = null;
    try {
      const result = await client.rpc("create_signing_draft", {
        p_actor_id: owner,
        p_document_id: documentId,
        p_version_id: versionId,
        p_title: metadata.title,
        p_category_id: metadata.categoryId,
        p_custom_document_type: metadata.customDocumentType,
        p_document_date: metadata.documentDate,
        p_issuing_institution: metadata.issuingInstitution,
        p_description: metadata.description,
        p_original_filename: file.name,
        p_file_size_bytes: file.size,
        p_source_sha256: inspected.sha256,
        p_storage_path: path,
        p_upload_policy_version: configuration.uploadPolicyVersion,
        p_upload_consent: true,
      });
      failure = result.error;
    } catch {
      failure = {};
    }
    const committed = await findVersion(client, owner, documentId, versionId);
    if (committed.data)
      return existingReceipt(committed.data, metadata, file, inspected.sha256);
    const rolledBack = Boolean(
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
    if (rolledBack && committed.certain) {
      try {
        await client.storage.from(bucket).remove([path]);
      } catch {
        /* Preserve uncertain objects for reconciliation. */
      }
    }
    if (
      failure?.code === "P0001" ||
      failure?.code === "P0002" ||
      failure?.code === "42501" ||
      failure?.code === "22023"
    )
      throw mapSigningDatabaseError(failure);
    throw new ApiError(
      503,
      "UPLOAD_UNCONFIRMED",
      "Unggahan belum terkonfirmasi. Periksa daftar dokumen sebelum mengirim unggahan baru.",
    );
  } finally {
    releaseUpload();
  }
}
