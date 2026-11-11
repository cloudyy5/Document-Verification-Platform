import type { DocumentStatus } from "@/types/database";

/** Safe DTO contract. No session tokens, storage paths or verification credentials. */
export interface Category {
  id: string;
  name: string;
  slug: string;
}

export interface DocumentSummary {
  id: string;
  submissionId: string;
  title: string;
  category: { id: string; name: string | null; slug: string | null };
  status: DocumentStatus;
  currentVersionNo: number;
  submittedAt: string;
  registeredAt: string | null;
  updatedAt: string;
}

export interface ReviewSnapshot {
  decision: "approved" | "revision_requested" | "rejected";
  note: string | null;
  createdAt: string;
  checklist: {
    completeness: boolean;
    readability: boolean;
    category_match: boolean;
    registration_eligibility: boolean;
  };
}

export interface SubmissionVersion {
  submissionId: string;
  versionNo: number;
  status: "pending_review" | "revision_requested" | "rejected" | "approved";
  title: string;
  category: DocumentSummary["category"];
  customDocumentType: string | null;
  documentDate: string | null;
  issuingInstitution: string | null;
  description: string | null;
  fileName: string;
  fileSizeBytes: number;
  sha256: string;
  submittedAt: string;
  policyVersion: string;
  consentedAt: string;
  review: ReviewSnapshot | null;
}

export interface DocumentDetail extends DocumentSummary {
  customDocumentType: string | null;
  documentDate: string | null;
  issuingInstitution: string | null;
  description: string | null;
  fileName: string;
  fileSizeBytes: number;
  sha256: string;
  policyVersion: string;
  consentedAt: string;
  revocationReason: string | null;
  revokedAt: string | null;
  versions: SubmissionVersion[];
}

export interface DocumentFilters {
  q?: string;
  status?: DocumentStatus;
  categoryId?: string;
  from?: string;
  to?: string;
  cursor?: string;
  limit?: number;
}

export interface DocumentListResult {
  items: DocumentSummary[];
  nextCursor: string | null;
  limit: number;
}

export interface DashboardData {
  counts: {
    total: number;
    pendingReview: number;
    revisionRequested: number;
    approved: number;
    rejected: number;
    revoked: number;
  };
  recentDocuments: DocumentSummary[];
}

export interface ProfileDTO {
  fullName: string | null;
  phone: string | null;
  email: string;
  emailConfirmed: boolean;
  createdAt: string;
}

export interface ProfileActionState {
  status: "idle" | "error" | "success";
  message?: string;
  fieldErrors?: Partial<Record<"fullName" | "phone", string>>;
}
