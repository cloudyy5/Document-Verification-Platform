import { apiRoute, apiSession, assertMutationOrigin } from "@/server/api";
import { renderSigningEvidence } from "@/server/signing/artifacts";
export const runtime = "nodejs";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ receiptId: string }> },
) {
  return apiRoute(async () => {
    await apiSession("user");
    assertMutationOrigin(request.headers.get("origin"));
    return { state: await renderSigningEvidence((await params).receiptId) };
  });
}
