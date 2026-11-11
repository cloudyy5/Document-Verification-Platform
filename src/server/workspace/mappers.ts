import "server-only";
import { z } from "zod";
import type { Json } from "@/types/database";
import type {
  DashboardData,
  DocumentSummary,
  ReviewSnapshot,
  SubmissionVersion,
} from "./types";

export const documentStatusSchema = z.enum([
  "pending_review",
  "revision_requested",
  "approved",
  "rejected",
  "revoked",
]);
const timestamp = z.iso.datetime({ offset: true });
export const summaryRowSchema = z.object({
  id: z.uuid(),
  owner_id: z.uuid(),
  current_version_no: z.number().int().positive(),
  current_status: documentStatusSchema,
  created_at: timestamp,
  updated_at: timestamp,
  registered_at: timestamp.nullable(),
  revoked_at: timestamp.nullable(),
  revocation_reason: z.string().nullable(),
  submission_id: z.uuid(),
  title: z.string(),
  category_id: z.uuid(),
  submitted_at: timestamp,
  category_name: z.string().nullable(),
  category_slug: z.string().nullable(),
});
export type SummaryRow = z.infer<typeof summaryRowSchema>;

export function mapDocumentSummary(row: SummaryRow): DocumentSummary {
  return {
    id: row.id,
    submissionId: row.submission_id,
    title: row.title,
    category: {
      id: row.category_id,
      name: row.category_name,
      slug: row.category_slug,
    },
    status: row.current_status,
    currentVersionNo: row.current_version_no,
    submittedAt: row.submitted_at,
    registeredAt: row.registered_at,
    updatedAt: row.updated_at,
  };
}

export function mapWorkspaceCounts(value: Json): DashboardData["counts"] {
  const count = z.number().int().nonnegative().refine(Number.isSafeInteger);
  return z
    .object({
      total: count,
      pendingReview: count,
      revisionRequested: count,
      approved: count,
      rejected: count,
      revoked: count,
    })
    .strict()
    .parse(value);
}

export const versionRowSchema = z.object({
  id: z.uuid(),
  document_id: z.uuid(),
  submitted_by: z.uuid(),
  version_no: z.number().int().positive(),
  status: z.enum([
    "pending_review",
    "revision_requested",
    "approved",
    "rejected",
  ]),
  title: z.string(),
  category_id: z.uuid(),
  custom_document_type: z.string().nullable(),
  document_date: z.string().nullable(),
  issuing_institution: z.string().nullable(),
  description: z.string().nullable(),
  original_filename: z.string(),
  file_size_bytes: z.number().int().positive().refine(Number.isSafeInteger),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  submitted_at: timestamp,
  policy_version: z.string(),
  consented_at: timestamp,
});
export type VersionRow = z.infer<typeof versionRowSchema>;

export const reviewRowSchema = z.object({
  submission_id: z.uuid(),
  decision: z.enum(["approved", "revision_requested", "rejected"]),
  decision_note: z.string().nullable(),
  created_at: timestamp,
  checklist: z
    .object({
      completeness: z.boolean(),
      readability: z.boolean(),
      category_match: z.boolean(),
      registration_eligibility: z.boolean(),
    })
    .strict(),
});
export type ReviewRow = z.infer<typeof reviewRowSchema>;

export function mapReview(row: ReviewRow): ReviewSnapshot {
  return {
    decision: row.decision,
    note: row.decision_note,
    createdAt: row.created_at,
    checklist: row.checklist,
  };
}

export function mapSubmissionVersion(
  row: VersionRow,
  category: DocumentSummary["category"],
  review: ReviewSnapshot | null,
): SubmissionVersion {
  return {
    submissionId: row.id,
    versionNo: row.version_no,
    status: row.status,
    title: row.title,
    category,
    customDocumentType: row.custom_document_type,
    documentDate: row.document_date,
    issuingInstitution: row.issuing_institution,
    description: row.description,
    fileName: row.original_filename,
    fileSizeBytes: row.file_size_bytes,
    sha256: row.sha256,
    submittedAt: row.submitted_at,
    policyVersion: row.policy_version,
    consentedAt: row.consented_at,
    review,
  };
}
