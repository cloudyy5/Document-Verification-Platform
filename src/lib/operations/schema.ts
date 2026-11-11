import { z } from "zod";

const count = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
export const operationIssueSchema = z.strictObject({
  reference: z.string().regex(/^[a-f0-9]{64}$/),
  state: z.enum(["failed", "timed_out"]),
  code: z.enum([
    "RENDER_FAILED",
    "RENDER_LIMIT",
    "SOURCE_UNAVAILABLE",
    "STORAGE_UNAVAILABLE",
    "PROCESSING_TIMEOUT",
  ]),
  updatedAt: z.iso.datetime({ offset: true }),
  attempts: count,
});
export const operationsSnapshotSchema = z
  .strictObject({
    version: z.literal("operations-v1"),
    asOf: z.iso.datetime({ offset: true }),
    periodStart: z.iso.datetime({ offset: true }),
    scope: z.literal("signing-v1"),
    activeBasis: z.enum(["document-events", "unavailable"]),
    metrics: z.strictObject({
      registeredUsers: count,
      activeDocumentUsers30d: count.nullable(),
      uploadedDocuments: count,
      completedDocuments: count,
      pendingRequests: count,
      attentionResults: count,
      sourceVersions: count,
      awaitingResults: count,
      processingResults: count,
      legacyDocuments: count,
    }),
    attention: z.strictObject({
      items: z.array(operationIssueSchema).max(20),
      total: count,
      limit: z.literal(20),
      hasMore: z.boolean(),
    }),
  })
  .superRefine((value, ctx) => {
    if (
      value.metrics.completedDocuments > value.metrics.uploadedDocuments ||
      value.metrics.sourceVersions < value.metrics.uploadedDocuments ||
      (value.metrics.activeDocumentUsers30d ?? 0) >
        value.metrics.registeredUsers ||
      (value.activeBasis === "unavailable") !==
        (value.metrics.activeDocumentUsers30d === null) ||
      value.attention.total !== value.metrics.attentionResults ||
      value.attention.items.length > value.attention.total ||
      value.attention.items.length !==
        Math.min(value.attention.total, value.attention.limit) ||
      value.attention.hasMore !==
        value.attention.total > value.attention.items.length ||
      new Set(value.attention.items.map((item) => item.reference)).size !==
        value.attention.items.length ||
      Date.parse(value.asOf) - Date.parse(value.periodStart) !==
        720 * 60 * 60 * 1000 ||
      value.attention.items.some(
        (item) =>
          (item.state === "timed_out") !==
            (item.code === "PROCESSING_TIMEOUT") ||
          Date.parse(item.updatedAt) > Date.parse(value.asOf),
      )
    )
      ctx.addIssue({
        code: "custom",
        message: "Snapshot monitoring tidak konsisten.",
      });
  });
export type OperationIssue = z.infer<typeof operationIssueSchema>;
export type OperationsSnapshot = z.infer<typeof operationsSnapshotSchema>;
