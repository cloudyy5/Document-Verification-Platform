import { apiRoute, apiSession, assertMutationOrigin } from "@/server/api";
import { readSmallJson } from "@/server/json";
import { z } from "zod";
import { ApiError } from "@/server/errors";
import { signingDecisionSchema } from "@/lib/signing/decision-validation";
import { decideSigningRequest } from "@/server/signing/decisions";
export const runtime = "nodejs";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ requestId: string }> },
) {
  return apiRoute(async () => {
    await apiSession("user");
    assertMutationOrigin(request.headers.get("origin"));
    const key = request.headers.get("idempotency-key");
    if (!z.uuid().safeParse(key).success)
      throw new ApiError(
        400,
        "INVALID_IDEMPOTENCY_KEY",
        "Referensi tindakan tidak valid. Muat ulang formulir.",
      );
    const body = signingDecisionSchema.parse(
      await readSmallJson(request, 256 * 1024),
    );
    return decideSigningRequest((await params).requestId, body, key);
  }, 201);
}
