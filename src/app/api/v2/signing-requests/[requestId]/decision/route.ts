import { apiRoute, apiSession } from "@/server/api";
import { getSigningOutcome } from "@/server/signing/evidence";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ requestId: string }> },
) {
  return apiRoute(async () => {
    await apiSession("user");
    return getSigningOutcome((await params).requestId);
  });
}
