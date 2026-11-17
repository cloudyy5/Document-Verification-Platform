import "server-only";
import { createHmac } from "node:crypto";
import { getAuthConfiguration } from "@/lib/auth/config";
import { createPrivilegedSupabaseClient } from "@/lib/supabase/privileged";
import { SIGNING_RECEIPT_ID_PATTERN } from "@/lib/signing/receipt-link";
import {
  signingPublicMetadataSchema,
  type SigningPublicMetadata,
} from "@/lib/signing/public-metadata";
import { ApiError } from "@/server/errors";
import { getSigningConfiguration } from "./config";

/** Deliberate S-19 public projection. No session lookup and no private table reads. */
export async function getSigningPublicMetadata(
  id: string,
): Promise<SigningPublicMetadata | null> {
  if (!SIGNING_RECEIPT_ID_PATTERN.test(id)) return null;
  try {
    getSigningConfiguration();
    const { flowSecret } = getAuthConfiguration();
    const digest = (key: string) =>
      createHmac("sha256", flowSecret)
        .update(`public-signing-metadata\0${key}`)
        .digest("hex");
    const client = createPrivilegedSupabaseClient({ timeoutMs: 8000 });
    const limit = await client.rpc("consume_public_signing_metadata_limit", {
      p_key_digest: digest(`receipt:${id}`),
      p_global_digest: digest("global"),
    });
    if (limit.error || typeof limit.data !== "boolean")
      throw new Error("Limit unavailable");
    if (!limit.data)
      throw new ApiError(
        429,
        "PUBLIC_METADATA_LIMITED",
        "Terlalu banyak pemindaian. Tunggu beberapa saat lalu coba kembali.",
      );
    const result = await client.rpc("get_signing_public_metadata", {
      p_receipt_id: id,
    });
    if (result.error) throw new Error("Metadata unavailable");
    if (result.data === null) return null;
    return signingPublicMetadataSchema.parse(result.data);
  } catch (error) {
    if (error instanceof ApiError && error.code === "PUBLIC_METADATA_LIMITED")
      throw error;
    throw new ApiError(
      503,
      "PUBLIC_METADATA_UNAVAILABLE",
      "Metadata persetujuan belum dapat dimuat. Silakan coba kembali.",
    );
  }
}
