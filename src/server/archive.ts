import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { archiveMetricsSchema } from "@/lib/archive/schema";
import { apiSession } from "./api";
import { ApiError } from "./errors";
import { getSigningConfiguration } from "./signing/config";
import { getSigningRequests } from "./signing/queries";

export async function getArchiveOverview() {
  const session = await apiSession("user");
  getSigningConfiguration();
  try {
    const client = await createSupabaseServerClient();
    const asOf = new Date().toISOString();
    const owned = client
      .from("signing_document_versions")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", session.user.id)
      .eq("version_no", 1);
    const requests = (field: "owner_id" | "recipient_id") =>
      client
        .from("signing_requests")
        .select("id", { count: "exact", head: true })
        .eq(field, session.user.id);
    const keys = [
      "ownedDocuments",
      "sentRequests",
      "receivedRequests",
      "pending",
      "completed",
      "rejected",
      "cancelled",
      "consented",
      "expired",
    ] as const;
    const results = await Promise.all([
      owned,
      requests("owner_id"),
      requests("recipient_id"),
      requests("owner_id").eq("status", "pending").gt("expires_at", asOf),
      requests("owner_id").eq("status", "completed"),
      requests("owner_id").eq("status", "rejected"),
      requests("owner_id").eq("status", "cancelled"),
      requests("owner_id").eq("status", "consented"),
      requests("owner_id").eq("status", "pending").lte("expires_at", asOf),
    ]);
    if (results.some((result) => result.error))
      throw new Error("Count unavailable");
    const metrics = archiveMetricsSchema.parse(
      Object.fromEntries(
        keys.map((key, index) => [key, results[index]!.count]),
      ),
    );
    const [sent, received] = await Promise.all([
      getSigningRequests({ scope: "sent", limit: 5 }),
      getSigningRequests({ scope: "received", limit: 5 }),
    ]);
    return { asOf, metrics, sent: sent.items, received: received.items };
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(
      503,
      "ARCHIVE_UNAVAILABLE",
      "Ringkasan arsip belum dapat dimuat. Silakan coba kembali.",
    );
  }
}
export type ArchiveOverviewData = Awaited<
  ReturnType<typeof getArchiveOverview>
>;
