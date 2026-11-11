import type { QrPlan } from "./placement";
export type SigningDecision = {
  id: string;
  requestId: string;
  sourceVersionId: string;
  action: "approve" | "reject";
  reason: string | null;
  decidedAt: string;
};
export type SigningEvidence = {
  id: string;
  decisionId: string;
  requestId: string;
  documentId: string;
  sourceVersionId: string;
  ownerName: string;
  signerName: string;
  signerCode: string;
  documentTitle: string;
  sourceSha256: string;
  decidedAt: string;
  policyVersion: string;
  layoutVersion: string;
  placements?: QrPlan;
  artifact: {
    state: "pending" | "processing" | "failed" | "ready";
    sha256: string | null;
    bytes: number | null;
    pageCount: number | null;
    readyAt: string | null;
  };
};
