import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireUserWorkspace } from "@/lib/auth/session";
import { getSigningEvidence } from "@/server/signing/evidence";
import { SigningEvidenceView } from "@/features/signing/evidence-view";
import { SigningUnavailable } from "@/features/signing/states";
import { ApiError } from "@/server/errors";
export const metadata: Metadata = { title: "Bukti persetujuan privat" };
export default async function ReceiptPage({
  params,
}: {
  params: Promise<{ receiptId: string }>;
}) {
  const { receiptId } = await params;
  await requireUserWorkspace(`/receipts/${receiptId}`);
  let evidence: Awaited<ReturnType<typeof getSigningEvidence>>;
  try {
    evidence = await getSigningEvidence(receiptId);
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
    return <SigningUnavailable title="Bukti persetujuan" />;
  }
  if (!evidence) notFound();
  return <SigningEvidenceView evidence={evidence} />;
}
