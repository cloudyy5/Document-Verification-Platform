import "server-only";
import { createHmac, createHash } from "node:crypto";
import { z } from "zod";
import { signingDecisionSchema } from "@/lib/signing/decision-validation";
import { getAuthConfiguration, getAppOrigin } from "@/lib/auth/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createPrivilegedSupabaseClient } from "@/lib/supabase/privileged";
import { derivedUploadId } from "@/server/documents/upload";
import { ApiError } from "@/server/errors";
import { SIGNING_RECEIPT_ID_PATTERN } from "@/lib/signing/receipt-link";
import { serveSigningFile } from "./file";
import { signingActor, signingR3Limit } from "./r3-context";
import { mapSigningDatabaseError, signingUnavailable } from "./errors";
import { renderSigningEvidence } from "./artifacts";
import { inspectSigningPlacement } from "./layout";
import { getSigningOutcome } from "./evidence";
import { acquireUploadSlot } from "@/server/documents/upload-slot";
import { qrPlanSchema, type QrPlan } from "@/lib/signing/placement";

const resultSchema = z.object({
  decisionId: z.uuid(),
  requestId: z.uuid(),
  sourceVersionId: z.uuid(),
  action: z.enum(["approve", "reject"]),
  reason: z.string().nullable(),
  decidedAt: z.iso.datetime({ offset: true }),
  receiptId: z.string().regex(SIGNING_RECEIPT_ID_PATTERN).nullable(),
});
export async function decideSigningRequest(
  requestId: string,
  input: unknown,
  key: string | null,
) {
  const session = await signingActor();
  if (!z.uuid().safeParse(requestId).success)
    throw new ApiError(404, "NOT_FOUND", "Permintaan tidak ditemukan.");
  if (!z.uuid().safeParse(key).success)
    throw new ApiError(
      400,
      "INVALID_IDEMPOTENCY_KEY",
      "Referensi tindakan tidak valid. Muat ulang formulir.",
    );
  const body = signingDecisionSchema.parse(input),
    id = requestId.toLowerCase();
  const user = await createSupabaseServerClient();
  const claims = await user.auth.getClaims();
  const sessionId = claims.data?.claims.session_id;
  if (
    claims.error ||
    claims.data?.claims.sub !== session.user.id ||
    !z.uuid().safeParse(sessionId).success
  )
    throw signingUnavailable();
  const scoped = await user
    .from("signing_requests")
    .select("id,document_id,source_version_id,recipient_id")
    .eq("id", id)
    .eq("recipient_id", session.user.id)
    .maybeSingle();
  if (scoped.error) throw signingUnavailable();
  if (!scoped.data || scoped.data.recipient_id !== session.user.id)
    throw new ApiError(404, "NOT_FOUND", "Permintaan tidak ditemukan.");
  if (scoped.data.source_version_id !== body.sourceVersionId)
    throw new ApiError(
      409,
      "VERSION_CONFLICT",
      "Versi dokumen tidak cocok. Muat ulang permintaan.",
    );
  await signingR3Limit(session.user.id, "decision");
  const existing = await user
    .from("signing_decisions")
    .select("id,action")
    .eq("request_id", id)
    .maybeSingle();
  if (existing.error) throw signingUnavailable();
  let placementPlan: QrPlan | undefined;
  if (existing.data && body.action === "approve") {
    const outcome = await getSigningOutcome(id);
    if (outcome.decision?.action !== "approve" || !outcome.evidence?.placements)
      throw new ApiError(
        409,
        "IDEMPOTENCY_CONFLICT",
        "Keputusan sudah final. Posisi QR tidak dapat diubah.",
      );
    placementPlan = qrPlanSchema.parse(outcome.evidence.placements);
    if (
      placementPlan.length !== body.placements.length ||
      placementPlan.some(
        (item, index) =>
          item.page !== body.placements[index]?.page ||
          item.x !== Math.floor(body.placements[index]!.x * 1e6) / 1e6 ||
          item.y !== Math.floor(body.placements[index]!.y * 1e6) / 1e6,
      )
    )
      throw new ApiError(
        409,
        "IDEMPOTENCY_CONFLICT",
        "Posisi QR berbeda dari persetujuan yang sudah tercatat.",
      );
  }
  if (!existing.data) {
    // Source size/hash and live participant access are checked before a new
    // decision. A rejected exact retry uses the committed decision instead.
    const source = await serveSigningFile(
      new Request(
        `${getAppOrigin()}/api/v2/signing-documents/${scoped.data.document_id}/file?versionId=${body.sourceVersionId}`,
      ),
      scoped.data.document_id,
      { timeoutMs: 20_000 },
    );
    const bytes = new Uint8Array(await source.arrayBuffer());
    const sourceHash = createHash("sha256").update(bytes).digest("hex");
    if (sourceHash !== body.sourceSha256)
      throw new ApiError(
        409,
        "VERSION_CONFLICT",
        "Hash sumber tidak cocok dengan versi yang ditampilkan.",
      );
    if (body.action === "approve") {
      const release = acquireUploadSlot();
      try {
        placementPlan = await inspectSigningPlacement(
          bytes,
          sourceHash,
          body.placements,
        );
      } finally {
        release();
      }
    }
  }
  const reason = body.action === "reject" ? body.reason : null;
  const digest = createHmac("sha256", getAuthConfiguration().flowSecret)
    .update(
      JSON.stringify([
        sessionId,
        session.user.id,
        id,
        body.sourceVersionId,
        body.sourceSha256,
        body.action,
        reason,
        body.policyVersion,
        key,
        ...(placementPlan ? [placementPlan] : []),
      ]),
    )
    .digest("hex");
  const decisionId = derivedUploadId(
    session.user.id,
    key!,
    `signing-decision:${id}`,
  );
  const privileged = createPrivilegedSupabaseClient({
    timeoutMs: 20_000,
  });
  const common = {
    p_actor_id: session.user.id,
    p_request_id: id,
    p_decision_id: decisionId,
    p_source_version_id: body.sourceVersionId,
    p_source_sha256: body.sourceSha256,
    p_policy_version: body.policyVersion,
    p_consent: body.consent,
    p_confirmed: body.confirmed,
    p_confirmation_digest: digest,
  };
  const result =
    body.action === "approve"
      ? await privileged.rpc("approve_signing_request_with_placement", {
          ...common,
          p_placement_plan: placementPlan!,
        })
      : await privileged.rpc("decide_signing_request", {
          ...common,
          p_action: "reject",
          p_reason: reason,
        });
  if (result.error) throw mapSigningDatabaseError(result.error);
  const parsed = resultSchema.safeParse(result.data);
  if (
    !parsed.success ||
    parsed.data.decisionId !== decisionId ||
    parsed.data.requestId !== id ||
    parsed.data.sourceVersionId !== body.sourceVersionId ||
    parsed.data.action !== body.action ||
    parsed.data.reason !== reason ||
    (body.action === "approve"
      ? parsed.data.receiptId === null
      : parsed.data.receiptId !== null)
  )
    throw signingUnavailable();
  const receipt = parsed.data;
  const artifactState = receipt.receiptId
    ? await renderSigningEvidence(receipt.receiptId).catch(
        () => "pending" as const,
      )
    : null;
  return { ...receipt, artifactState };
}
