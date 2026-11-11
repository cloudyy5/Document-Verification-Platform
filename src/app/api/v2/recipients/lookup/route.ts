import { apiRoute, apiSession, assertMutationOrigin } from "@/server/api";
import { readSmallJson } from "@/server/json";
import { recipientLookupSchema } from "@/lib/signing/validation";
import { lookupSigningRecipient } from "@/server/signing/queries";
export async function POST(request: Request) {
  return apiRoute(async () => {
    await apiSession("user");
    assertMutationOrigin(request.headers.get("origin"));
    const body = recipientLookupSchema.parse(await readSmallJson(request));
    return lookupSigningRecipient(body.code);
  });
}
