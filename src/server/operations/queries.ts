import "server-only";
import { apiSession } from "@/server/api";
import { ApiError } from "@/server/errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  operationsSnapshotSchema,
  type OperationsSnapshot,
} from "@/lib/operations/schema";

export function operationsUnavailable() {
  return new ApiError(
    503,
    "OPERATIONS_UNAVAILABLE",
    "Data monitoring sementara tidak tersedia. Silakan muat ulang.",
  );
}
export async function getOperationsSnapshot(
  params?: URLSearchParams,
): Promise<OperationsSnapshot> {
  const session = await apiSession();
  if (!session.user.emailConfirmed || !session.roles.includes("platform_admin"))
    throw new ApiError(
      403,
      "OPERATIONS_NOT_ALLOWED",
      "Akun Anda tidak memiliki akses monitoring platform.",
    );
  if (params && params.size > 0)
    throw new ApiError(
      422,
      "VALIDATION_ERROR",
      "Endpoint monitoring ini tidak menerima filter atau identitas dari browser.",
    );
  try {
    // Cookie-scoped client, no service key, row fetch or shared data cache.
    const client = await createSupabaseServerClient();
    const result = await client
      .rpc("get_operations_snapshot", {})
      .abortSignal(AbortSignal.timeout(8000));
    if (result.error?.code === "42501")
      throw new ApiError(
        403,
        "OPERATIONS_NOT_ALLOWED",
        "Akun Anda tidak memiliki akses monitoring platform.",
      );
    if (result.error) throw operationsUnavailable();
    const parsed = operationsSnapshotSchema.safeParse(result.data);
    if (!parsed.success || parsed.data.activeBasis !== "document-events")
      throw operationsUnavailable();
    return parsed.data;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw operationsUnavailable();
  }
}
