import "server-only";
import { createHash } from "node:crypto";
import { z } from "zod";
import { apiSession } from "@/server/api";
import { ApiError } from "@/server/errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createPrivilegedSupabaseClient } from "@/lib/supabase/privileged";
import { privatePdfResponse } from "@/server/documents/pdf-response";
import { getSigningConfiguration } from "./config";

export async function serveSigningFile(
  request: Request,
  documentId: string,
  options?: { timeoutMs: number },
): Promise<Response> {
  const session = await apiSession("user");
  getSigningConfiguration();
  const versionId = new URL(request.url).searchParams.get("versionId");
  if (
    !z.uuid().safeParse(documentId).success ||
    (versionId && !z.uuid().safeParse(versionId).success)
  )
    throw new ApiError(404, "NOT_FOUND", "Dokumen tidak ditemukan.");
  const user = await createSupabaseServerClient();
  const query = () => {
    let scoped = user
      .from("signing_document_versions")
      .select(
        "id,document_id,owner_id,storage_path,original_filename,file_size_bytes,source_sha256",
      )
      .eq("document_id", documentId);
    scoped = versionId
      ? scoped.eq("id", versionId)
      : scoped.eq("version_no", 1);
    return (
      options
        ? scoped.abortSignal(AbortSignal.timeout(options.timeoutMs))
        : scoped
    ).maybeSingle();
  };
  // Database RLS checks the exact version grant, cancellation and database time.
  const result = await query();
  if (result.error)
    throw new ApiError(
      503,
      "FILE_UNAVAILABLE",
      "File sementara tidak tersedia.",
    );
  if (!result.data)
    throw new ApiError(404, "NOT_FOUND", "Dokumen tidak ditemukan.");
  const source = result.data;
  const assertRecipient = async () => {
    if (source.owner_id === session.user.id) return;
    const grantQuery = user
      .from("signing_requests")
      .select("id,status,expires_at")
      .eq("document_id", source.document_id)
      .eq("source_version_id", source.id)
      .eq("owner_id", source.owner_id)
      .eq("recipient_id", session.user.id);
    const grant = await (
      options
        ? grantQuery.abortSignal(AbortSignal.timeout(options.timeoutMs))
        : grantQuery
    ).maybeSingle();
    if (grant.error)
      throw new ApiError(
        503,
        "FILE_UNAVAILABLE",
        "Akses file belum dapat diperiksa.",
      );
    if (
      !grant.data ||
      !(
        grant.data.status === "completed" ||
        grant.data.status === "consented" ||
        (grant.data.status === "pending" &&
          Date.parse(grant.data.expires_at) > Date.now())
      )
    )
      throw new ApiError(404, "NOT_FOUND", "Dokumen tidak ditemukan.");
  };
  await assertRecipient();
  const expected = `${source.owner_id}/signing/${source.document_id}/${source.id}.pdf`;
  if (
    source.storage_path !== expected ||
    source.file_size_bytes < 1 ||
    source.file_size_bytes > 10 * 1024 * 1024
  )
    throw new ApiError(
      503,
      "FILE_UNAVAILABLE",
      "File belum dapat ditampilkan.",
    );
  const privileged = options
    ? createPrivilegedSupabaseClient(options)
    : createPrivilegedSupabaseClient();
  const downloaded = await privileged.storage
    .from("document-submissions")
    .download(source.storage_path);
  if (
    downloaded.error ||
    !downloaded.data ||
    downloaded.data.size !== source.file_size_bytes
  )
    throw new ApiError(
      503,
      "FILE_UNAVAILABLE",
      "File belum dapat ditampilkan.",
    );
  const bytes = new Uint8Array(await downloaded.data.arrayBuffer());
  if (createHash("sha256").update(bytes).digest("hex") !== source.source_sha256)
    throw new ApiError(
      503,
      "FILE_UNAVAILABLE",
      "File belum dapat ditampilkan.",
    );
  // Recheck before returning buffered bytes if a cancel/expiry raced the download.
  const fresh = await query();
  if (fresh.error)
    throw new ApiError(
      503,
      "FILE_UNAVAILABLE",
      "Akses file belum dapat diperiksa.",
    );
  if (!fresh.data || fresh.data.id !== source.id)
    throw new ApiError(404, "NOT_FOUND", "Dokumen tidak ditemukan.");
  await assertRecipient();
  return privatePdfResponse(request, bytes, source.original_filename);
}
