import { apiRoute, apiSession, assertMutationOrigin } from "@/server/api";
import { cancelSigningRequest } from "@/server/signing/queries";
export async function POST(
  request: Request,
  context: { params: Promise<{ requestId: string }> },
) {
  return apiRoute(async () => {
    await apiSession("user");
    assertMutationOrigin(request.headers.get("origin"));
    return cancelSigningRequest((await context.params).requestId);
  });
}
