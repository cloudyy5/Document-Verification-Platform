import { z } from "zod";
import { apiRoute, apiSession, assertMutationOrigin } from "@/server/api";
import { ApiError } from "@/server/errors";
import { readSmallJson } from "@/server/json";
import { sendSigningRequestSchema } from "@/lib/signing/validation";
import {
  getSigningRequests,
  sendSigningRequest,
} from "@/server/signing/queries";
export async function GET(request: Request) {
  return apiRoute(async () => {
    await apiSession("user");
    const params = new URL(request.url).searchParams;
    if (
      [...params.keys()].some(
        (key) => !["scope", "cursor", "limit"].includes(key),
      )
    )
      throw new ApiError(
        422,
        "VALIDATION_ERROR",
        "Parameter daftar tidak valid.",
      );
    const scope = z
      .enum(["received", "sent"])
      .parse(params.get("scope") ?? "received");
    return getSigningRequests({
      scope,
      ...(params.has("cursor") ? { cursor: params.get("cursor")! } : {}),
      ...(params.has("limit") ? { limit: params.get("limit")! } : {}),
    });
  });
}
export async function POST(request: Request) {
  return apiRoute(async () => {
    await apiSession("user");
    assertMutationOrigin(request.headers.get("origin"));
    const key = request.headers.get("idempotency-key");
    if (!z.uuid().safeParse(key).success)
      throw new ApiError(
        400,
        "INVALID_IDEMPOTENCY_KEY",
        "Referensi permintaan tidak valid. Muat ulang formulir.",
      );
    const body = sendSigningRequestSchema.parse(await readSmallJson(request));
    return sendSigningRequest(body, key!);
  }, 201);
}
