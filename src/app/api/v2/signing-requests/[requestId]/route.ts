import { apiRoute } from "@/server/api";
import { ApiError } from "@/server/errors";
import { getSigningRequest } from "@/server/signing/queries";
export async function GET(
  _request: Request,
  context: { params: Promise<{ requestId: string }> },
) {
  return apiRoute(async () => {
    const detail = await getSigningRequest((await context.params).requestId);
    if (!detail)
      throw new ApiError(404, "NOT_FOUND", "Permintaan tidak ditemukan.");
    return detail;
  });
}
