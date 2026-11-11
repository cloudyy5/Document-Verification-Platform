import "server-only";
import { createHmac } from "node:crypto";
import { apiSession } from "@/server/api";
import { ApiError } from "@/server/errors";
import { getAuthConfiguration } from "@/lib/auth/config";
import { createPrivilegedSupabaseClient } from "@/lib/supabase/privileged";
import { getSigningConfiguration } from "./config";
import { signingUnavailable } from "./errors";

export async function signingActor() {
  const session = await apiSession("user");
  getSigningConfiguration();
  if (!session.user.emailConfirmed || !session.roles.includes("user"))
    throw new ApiError(
      403,
      "SIGNING_NOT_ALLOWED",
      "Akun atau verifikasi email belum memenuhi syarat.",
    );
  return session;
}
export async function signingR3Limit(
  actor: string,
  action: "decision" | "render",
) {
  const { flowSecret } = getAuthConfiguration();
  const digest = (value: string) =>
    createHmac("sha256", flowSecret).update(value).digest("hex");
  const { data, error } = await createPrivilegedSupabaseClient({
    timeoutMs: 20_000,
  }).rpc("consume_signing_r3_limit", {
    p_action: action,
    p_key_digest: digest(`r3\0${action}\0${actor}`),
    p_global_digest: digest(`r3\0${action}\0application`),
  });
  if (error || typeof data !== "boolean") throw signingUnavailable();
  if (!data)
    throw new ApiError(
      429,
      "RATE_LIMITED",
      "Terlalu banyak percobaan. Tunggu sebelum mencoba kembali.",
    );
}
