import "server-only";
import { createHash } from "node:crypto";
import { z } from "zod";
import { apiSession } from "@/server/api";
import { ApiError } from "@/server/errors";
import { privatePdfResponse } from "./pdf-response";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createPrivilegedSupabaseClient } from "@/lib/supabase/privileged";

export async function serveDocumentFile(
  request: Request,
  documentId: string,
): Promise<Response> {
  const session = await apiSession("user");
  const url = new URL(request.url);
  const submissionId = url.searchParams.get("submissionId");
  if (
    !z.uuid().safeParse(documentId).success ||
    (submissionId && !z.uuid().safeParse(submissionId).success)
  )
    throw new ApiError(404, "NOT_FOUND", "Dokumen tidak ditemukan.");
  const userClient = await createSupabaseServerClient();
  const document = await userClient
    .from("documents")
    .select("id,current_version_no")
    .eq("id", documentId)
    .eq("owner_id", session.user.id)
    .maybeSingle();
  if (document.error)
    throw new ApiError(
      503,
      "FILE_UNAVAILABLE",
      "File sementara tidak tersedia.",
    );
  if (!document.data)
    throw new ApiError(404, "NOT_FOUND", "Dokumen tidak ditemukan.");
  let query = userClient
    .from("document_submissions")
    .select(
      "id,storage_bucket,storage_path,original_filename,file_size_bytes,sha256",
    )
    .eq("document_id", documentId)
    .eq("submitted_by", session.user.id);
  query = submissionId
    ? query.eq("id", submissionId)
    : query.eq("version_no", document.data.current_version_no);
  const submission = await query.maybeSingle();
  if (submission.error)
    throw new ApiError(
      503,
      "FILE_UNAVAILABLE",
      "File sementara tidak tersedia.",
    );
  if (!submission.data)
    throw new ApiError(404, "NOT_FOUND", "Dokumen tidak ditemukan.");
  const source = submission.data;
  if (
    source.storage_bucket !== "document-submissions" ||
    !source.storage_path.startsWith(`${session.user.id}/`) ||
    source.file_size_bytes < 1 ||
    source.file_size_bytes > 10 * 1024 * 1024
  )
    throw new ApiError(
      503,
      "FILE_UNAVAILABLE",
      "File belum dapat ditampilkan.",
    );
  const downloaded = await createPrivilegedSupabaseClient()
    .storage.from("document-submissions")
    .download(source.storage_path);
  if (downloaded.error || !downloaded.data)
    throw new ApiError(
      503,
      "FILE_UNAVAILABLE",
      "File belum dapat ditampilkan.",
    );
  if (downloaded.data.size !== source.file_size_bytes)
    throw new ApiError(
      503,
      "FILE_UNAVAILABLE",
      "File belum dapat ditampilkan.",
    );
  const bytes = new Uint8Array(await downloaded.data.arrayBuffer());
  if (createHash("sha256").update(bytes).digest("hex") !== source.sha256)
    throw new ApiError(
      503,
      "FILE_UNAVAILABLE",
      "File belum dapat ditampilkan.",
    );
  return privatePdfResponse(request, bytes, source.original_filename);
}
