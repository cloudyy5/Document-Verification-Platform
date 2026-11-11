import { apiRoute, apiSession } from "@/server/api";
import { ApiError } from "@/server/errors";
import { getSigningEvidence } from "@/server/signing/evidence";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ receiptId: string }> },
) {
  return apiRoute(async () => {
    await apiSession("user");
    const evidence = await getSigningEvidence((await params).receiptId);
    if (!evidence)
      throw new ApiError(404, "NOT_FOUND", "Bukti tidak ditemukan.");
    return evidence;
  });
}
