import "server-only";
import { createHmac } from "node:crypto";
import { getAuthConfiguration } from "./config";
import { createPrivilegedSupabaseClient } from "@/lib/supabase/privileged";

export type AuthOperation =
  "login" | "register" | "recovery" | "resend" | "reset";

/** Persistent atomic counters; never store email addresses or passwords. */
export async function allowAuthAttempt(
  operation: AuthOperation,
  identity: string,
): Promise<boolean> {
  const { flowSecret } = getAuthConfiguration();
  const client = createPrivilegedSupabaseClient();
  for (const [action, key] of [
    [`${operation}_global`, "application"],
    [operation, identity.trim().toLowerCase()],
  ] as const) {
    const digest = createHmac("sha256", flowSecret)
      .update(`${action}\0${key}`)
      .digest("hex");
    const { data, error } = await client.rpc("consume_auth_rate_limit", {
      p_action: action,
      p_key_digest: digest,
    });
    if (error) throw new Error("Layanan autentikasi sementara tidak tersedia.");
    if (data !== true) return false;
  }
  return true;
}
