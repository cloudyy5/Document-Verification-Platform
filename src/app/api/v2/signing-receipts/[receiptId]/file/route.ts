import { apiRoute, apiSession } from "@/server/api";
import { serveSigningResult } from "@/server/signing/artifacts";
export const runtime = "nodejs";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ receiptId: string }> },
) {
  return apiRoute(async () => {
    await apiSession("user");
    return serveSigningResult(request, (await params).receiptId);
  });
}
