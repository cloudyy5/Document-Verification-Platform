import { z } from "zod";
export const archiveScopeSchema = z.enum(["owned", "sent", "received"]);
export const archiveStatusSchema = z.enum([
  "pending",
  "expired",
  "cancelled",
  "rejected",
  "consented",
  "completed",
]);
export const archiveFiltersSchema = z
  .strictObject({
    scope: archiveScopeSchema.default("owned"),
    status: z.preprocess(
      (value) => (value === "" ? undefined : value),
      archiveStatusSchema.optional(),
    ),
    q: z.preprocess(
      (value) => (value === "" ? undefined : value),
      z.string().trim().max(200).optional(),
    ),
    cursor: z
      .string()
      .max(512)
      .regex(/^[A-Za-z0-9_-]+$/)
      .optional(),
  })
  .refine((value) => (value.scope === "owned" ? !value.status : !value.q));
export type ArchiveFilters = z.infer<typeof archiveFiltersSchema>;
export const archiveHistoryStatusSchema = z.enum([
  "completed",
  "rejected",
  "cancelled",
  "expired",
]);
export const archiveHistoryFiltersSchema = z.strictObject({
  scope: z.enum(["sent", "received"]).default("sent"),
  status: archiveHistoryStatusSchema.default("completed"),
  cursor: z
    .string()
    .max(512)
    .regex(/^[A-Za-z0-9_-]+$/)
    .optional(),
});
export type ArchiveHistoryFilters = z.infer<typeof archiveHistoryFiltersSchema>;
const count = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
export const archiveMetricsSchema = z.object({
  ownedDocuments: count,
  sentRequests: count,
  receivedRequests: count,
  pending: count,
  completed: count,
  rejected: count,
  cancelled: count,
  consented: count,
  expired: count,
});
export type ArchiveMetrics = z.infer<typeof archiveMetricsSchema>;
