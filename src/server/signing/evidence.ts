import "server-only";
import { z } from "zod";
import { apiSession } from "@/server/api";
import { ApiError } from "@/server/errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { SIGNING_RECEIPT_ID_PATTERN } from "@/lib/signing/receipt-link";
import { SIGNING_ACTION_POLICY_VERSION } from "@/lib/signing/policy";
import {
  QR_PLACEMENT_VERSION,
  LEGACY_SIGNING_LAYOUT,
  qrPlanSchema,
} from "@/lib/signing/placement";
import { getSigningConfiguration } from "./config";
import { signingUnavailable } from "./errors";
import type {
  SigningDecision,
  SigningEvidence,
} from "@/lib/signing/evidence-types";
export type {
  SigningDecision,
  SigningEvidence,
} from "@/lib/signing/evidence-types";

const stamp = z.iso.datetime({ offset: true });
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const decisionRow = z.object({
  id: z.uuid(),
  request_id: z.uuid(),
  source_version_id: z.uuid(),
  actor_id: z.uuid(),
  action: z.enum(["approve", "reject"]),
  reason: z.string().nullable(),
  policy_version: z.literal(SIGNING_ACTION_POLICY_VERSION),
  consent: z.boolean(),
  authentication_method: z.literal("session_explicit_confirmation-v1"),
  decided_at: stamp,
});
const receiptRow = z.object({
  id: z.string().regex(SIGNING_RECEIPT_ID_PATTERN),
  decision_id: z.uuid(),
  request_id: z.uuid(),
  source_version_id: z.uuid(),
  owner_id: z.uuid(),
  recipient_id: z.uuid(),
  signer_name: z.string().min(1).max(120),
  signer_code: z.string().regex(/^DVP-[0-9A-F]{20}$/),
  owner_name: z.string().min(1).max(120),
  document_title: z.string().min(1).max(200),
  source_sha256: hash,
  policy_version: z.literal(SIGNING_ACTION_POLICY_VERSION),
  layout_version: z.enum([LEGACY_SIGNING_LAYOUT, QR_PLACEMENT_VERSION]),
  decided_at: stamp,
});
const artifactRow = z.object({
  receipt_id: z.string(),
  state: z.enum(["pending", "processing", "failed", "ready"]),
  file_size_bytes: z
    .number()
    .int()
    .positive()
    .max(20 * 1024 * 1024)
    .nullable(),
  artifact_sha256: hash.nullable(),
  page_count: z.number().int().min(1).nullable(),
  failure_code: z.string().nullable(),
  ready_at: stamp.nullable(),
});
type Client = Awaited<ReturnType<typeof createSupabaseServerClient>>;

async function requestFor(client: Client, id: string, actor: string) {
  const { data, error } = await client
    .from("signing_requests")
    .select("id,document_id,source_version_id,owner_id,recipient_id,status")
    .eq("id", id)
    .or(`owner_id.eq.${actor},recipient_id.eq.${actor}`)
    .maybeSingle();
  if (error) throw signingUnavailable();
  if (
    !data ||
    data.id !== id ||
    ![data.owner_id, data.recipient_id].includes(actor)
  )
    return null;
  return data;
}
async function evidenceFor(
  client: Client,
  id: string,
  actor: string,
): Promise<SigningEvidence | null> {
  const { data, error } = await client
    .from("signing_receipts")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw signingUnavailable();
  if (!data) return null;
  const row = receiptRow.parse(data);
  if (row.id !== id || ![row.owner_id, row.recipient_id].includes(actor))
    return null;
  const request = await requestFor(client, row.request_id, actor);
  if (
    !request ||
    request.source_version_id !== row.source_version_id ||
    request.owner_id !== row.owner_id ||
    request.recipient_id !== row.recipient_id ||
    !["consented", "completed"].includes(request.status)
  )
    throw signingUnavailable();
  const result = await client
    .from("signing_artifacts")
    .select(
      "receipt_id,state,file_size_bytes,artifact_sha256,page_count,failure_code,ready_at",
    )
    .eq("receipt_id", row.id)
    .maybeSingle();
  if (result.error || !result.data) throw signingUnavailable();
  const artifact = artifactRow.parse(result.data);
  let placements;
  if (row.layout_version === QR_PLACEMENT_VERSION) {
    const layout = await client
      .from("signing_receipt_layouts")
      .select("placement_plan")
      .eq("receipt_id", row.id)
      .maybeSingle();
    if (layout.error || !layout.data) throw signingUnavailable();
    placements = qrPlanSchema.parse(layout.data.placement_plan);
    if (artifact.state === "ready" && artifact.page_count !== placements.length)
      throw signingUnavailable();
  } else if (
    artifact.state === "ready" &&
    (!artifact.page_count || artifact.page_count < 2)
  )
    throw signingUnavailable();
  if (
    artifact.receipt_id !== row.id ||
    (artifact.state === "ready" &&
      (!artifact.artifact_sha256 ||
        !artifact.file_size_bytes ||
        !artifact.page_count ||
        !artifact.ready_at))
  )
    throw signingUnavailable();
  return {
    id: row.id,
    decisionId: row.decision_id,
    requestId: row.request_id,
    documentId: request.document_id,
    sourceVersionId: row.source_version_id,
    ownerName: row.owner_name,
    signerName: row.signer_name,
    signerCode: row.signer_code,
    documentTitle: row.document_title,
    sourceSha256: row.source_sha256,
    decidedAt: row.decided_at,
    policyVersion: row.policy_version,
    layoutVersion: row.layout_version,
    ...(placements ? { placements } : {}),
    artifact: {
      state: artifact.state,
      sha256: artifact.artifact_sha256,
      bytes: artifact.file_size_bytes,
      pageCount: artifact.page_count,
      readyAt: artifact.ready_at,
    },
  };
}
async function scoped<T>(
  run: (client: Client, actor: string) => Promise<T>,
): Promise<T> {
  try {
    const session = await apiSession("user");
    getSigningConfiguration();
    return await run(await createSupabaseServerClient(), session.user.id);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw signingUnavailable();
  }
}
export async function getSigningEvidence(
  id: string,
): Promise<SigningEvidence | null> {
  return scoped((client, actor) =>
    SIGNING_RECEIPT_ID_PATTERN.test(id)
      ? evidenceFor(client, id, actor)
      : Promise.resolve(null),
  );
}
export async function getSigningOutcome(requestId: string): Promise<{
  decision: SigningDecision | null;
  evidence: SigningEvidence | null;
}> {
  return scoped(async (client, actor) => {
    if (!z.uuid().safeParse(requestId).success)
      throw new ApiError(404, "NOT_FOUND", "Permintaan tidak ditemukan.");
    const id = requestId.toLowerCase();
    const request = await requestFor(client, id, actor);
    if (!request)
      throw new ApiError(404, "NOT_FOUND", "Permintaan tidak ditemukan.");
    const result = await client
      .from("signing_decisions")
      .select("*")
      .eq("request_id", id)
      .maybeSingle();
    if (result.error) throw signingUnavailable();
    if (!result.data) return { decision: null, evidence: null };
    const row = decisionRow.parse(result.data);
    if (
      row.request_id !== id ||
      row.actor_id !== request.recipient_id ||
      row.source_version_id !== request.source_version_id
    )
      throw signingUnavailable();
    const decision: SigningDecision = {
      id: row.id,
      requestId: row.request_id,
      sourceVersionId: row.source_version_id,
      action: row.action,
      reason: row.reason,
      decidedAt: row.decided_at,
    };
    if (row.action === "reject") return { decision, evidence: null };
    const receipt = await client
      .from("signing_receipts")
      .select("id")
      .eq("decision_id", row.id)
      .maybeSingle();
    if (receipt.error || !receipt.data) throw signingUnavailable();
    const evidence = await evidenceFor(client, receipt.data.id, actor);
    if (
      !evidence ||
      evidence.decisionId !== row.id ||
      evidence.requestId !== id
    )
      throw signingUnavailable();
    return { decision, evidence };
  });
}
