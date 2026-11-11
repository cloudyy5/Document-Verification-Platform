import "server-only";
import { createHash } from "node:crypto";
import { z } from "zod";
import { getAppOrigin } from "@/lib/auth/config";
import { createPrivilegedSupabaseClient } from "@/lib/supabase/privileged";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { privatePdfResponse } from "@/server/documents/pdf-response";
import { acquireUploadSlot } from "@/server/documents/upload-slot";
import { ApiError } from "@/server/errors";
import { getSigningEvidence } from "./evidence";
import { serveSigningFile } from "./file";
import { mapSigningDatabaseError, signingUnavailable } from "./errors";
import { signingActor, signingR3Limit } from "./r3-context";
import { renderSigningPdf } from "./render";

export async function renderSigningEvidence(receiptId: string) {
  const session = await signingActor();
  const evidence = await getSigningEvidence(receiptId);
  if (!evidence) throw new ApiError(404, "NOT_FOUND", "Bukti tidak ditemukan.");
  if (evidence.artifact.state === "ready") return "ready" as const;
  await signingR3Limit(session.user.id, "render");
  const client = createPrivilegedSupabaseClient({ timeoutMs: 20_000 });
  const claim = await client.rpc("claim_signing_render", {
    p_actor_id: session.user.id,
    p_receipt_id: receiptId,
  });
  if (claim.error) throw mapSigningDatabaseError(claim.error);
  const parsed = z
    .object({
      state: z.enum(["ready", "processing"]),
      claimToken: z.uuid().optional(),
    })
    .safeParse(claim.data);
  if (!parsed.success) throw signingUnavailable();
  if (parsed.data.state === "ready") return "ready" as const;
  if (!parsed.data.claimToken) return "processing" as const;
  const token = parsed.data.claimToken;
  let release: (() => void) | undefined;
  let failureCode = "RENDER_FAILED";
  try {
    release = acquireUploadSlot();
    failureCode = "SOURCE_UNAVAILABLE";
    const source = await serveSigningFile(
      new Request(
        `${getAppOrigin()}/api/v2/signing-documents/${evidence.documentId}/file?versionId=${evidence.sourceVersionId}`,
      ),
      evidence.documentId,
      { timeoutMs: 20_000 },
    );
    const bytes = new Uint8Array(await source.arrayBuffer());
    if (
      createHash("sha256").update(bytes).digest("hex") !== evidence.sourceSha256
    )
      throw signingUnavailable();
    failureCode = "RENDER_FAILED";
    const rendered = await renderSigningPdf(bytes, evidence);
    const sha256 = createHash("sha256").update(rendered.bytes).digest("hex");
    const user = await createSupabaseServerClient();
    const owner = await user
      .from("signing_receipts")
      .select("owner_id")
      .eq("id", receiptId)
      .maybeSingle();
    if (owner.error || !owner.data) throw signingUnavailable();
    const path = `${owner.data.owner_id}/signing-results/${receiptId}/${token}.pdf`;
    failureCode = "STORAGE_UNAVAILABLE";
    const uploaded = await client.storage
      .from("signing-results")
      .upload(path, rendered.bytes, {
        contentType: "application/pdf",
        cacheControl: "0",
        upsert: false,
      });
    if (uploaded.error) throw signingUnavailable();
    // Verify the actual stored bytes before publishing a ready pointer.
    const stored = await client.storage.from("signing-results").download(path);
    if (
      stored.error ||
      !stored.data ||
      stored.data.size !== rendered.bytes.length ||
      createHash("sha256")
        .update(new Uint8Array(await stored.data.arrayBuffer()))
        .digest("hex") !== sha256
    )
      throw signingUnavailable();
    const finished = await client.rpc("complete_signing_render", {
      p_actor_id: session.user.id,
      p_receipt_id: receiptId,
      p_claim_token: token,
      p_storage_path: path,
      p_file_size_bytes: rendered.bytes.length,
      p_artifact_sha256: sha256,
      p_page_count: rendered.pageCount,
    });
    if (finished.error || finished.data !== true) throw signingUnavailable();
    return "ready" as const;
  } catch (error) {
    // A lost response is not rollback. A committed ready result wins; no object
    // is deleted here, including uncertain or stale-claim writes.
    const recovered = await getSigningEvidence(receiptId).catch(() => null);
    if (recovered?.artifact.state === "ready") return "ready" as const;
    if (
      error instanceof ApiError &&
      ["RENDER_LIMIT", "UPLOAD_BUSY"].includes(error.code)
    )
      failureCode = "RENDER_LIMIT";
    const failed = await client
      .rpc("fail_signing_render", {
        p_actor_id: session.user.id,
        p_receipt_id: receiptId,
        p_claim_token: token,
        p_failure_code: failureCode,
      })
      .then(
        (result) => !result.error && result.data === true,
        () => false,
      );
    if (failed) return "failed" as const;
    // Another lease may already have completed. If marking failure was not
    // acknowledged, report only the state that can actually be read back.
    const latest = await getSigningEvidence(receiptId).catch(() => null);
    if (latest) return latest.artifact.state;
    throw signingUnavailable();
  } finally {
    release?.();
  }
}

export async function serveSigningResult(
  request: Request,
  receiptId: string,
): Promise<Response> {
  const evidence = await getSigningEvidence(receiptId);
  if (!evidence) throw new ApiError(404, "NOT_FOUND", "Bukti tidak ditemukan.");
  if (evidence.artifact.state !== "ready")
    throw new ApiError(
      409,
      "RESULT_NOT_READY",
      "PDF hasil belum siap. Buka bukti untuk memeriksa prosesnya.",
    );
  const user = await createSupabaseServerClient();
  const [owner, result] = await Promise.all([
    user
      .from("signing_receipts")
      .select("owner_id")
      .eq("id", receiptId)
      .maybeSingle(),
    user
      .from("signing_artifacts")
      .select("state,storage_path,file_size_bytes,artifact_sha256")
      .eq("receipt_id", receiptId)
      .maybeSingle(),
  ]);
  if (owner.error || result.error) throw signingUnavailable();
  if (!owner.data || !result.data || result.data.state !== "ready")
    throw new ApiError(404, "NOT_FOUND", "Bukti tidak ditemukan.");
  const item = result.data;
  const prefix = `${owner.data.owner_id}/signing-results/${receiptId}/`;
  if (
    !item.storage_path?.startsWith(prefix) ||
    !z.uuid().safeParse(item.storage_path.slice(prefix.length, -4)).success ||
    !item.storage_path.endsWith(".pdf") ||
    item.file_size_bytes !== evidence.artifact.bytes ||
    item.artifact_sha256 !== evidence.artifact.sha256
  )
    throw signingUnavailable();
  const response = await createPrivilegedSupabaseClient({ timeoutMs: 20_000 })
    .storage.from("signing-results")
    .download(item.storage_path);
  if (
    response.error ||
    !response.data ||
    response.data.size !== item.file_size_bytes ||
    response.data.size > 20 * 1024 * 1024
  )
    throw signingUnavailable();
  const bytes = new Uint8Array(await response.data.arrayBuffer());
  if (createHash("sha256").update(bytes).digest("hex") !== item.artifact_sha256)
    throw signingUnavailable();
  const fresh = await getSigningEvidence(receiptId);
  if (
    !fresh ||
    fresh.artifact.state !== "ready" ||
    fresh.artifact.sha256 !== item.artifact_sha256
  )
    throw new ApiError(404, "NOT_FOUND", "Bukti tidak ditemukan.");
  return privatePdfResponse(request, bytes, "dokumen-persetujuan-internal.pdf");
}
