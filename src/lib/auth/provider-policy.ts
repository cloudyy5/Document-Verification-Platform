import "server-only";
import { getPublicEnv } from "@/lib/env/public";

/** Registration must never silently auto-confirm email in a misconfigured project. */
export async function requireProviderEmailConfirmation() {
  const { supabaseUrl, supabasePublishableKey } = getPublicEnv();
  const response = await fetch(`${supabaseUrl}/auth/v1/settings`, {
    headers: { apikey: supabasePublishableKey },
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error("Authentication provider unavailable.");
  const settings: unknown = await response.json();
  if (
    !settings ||
    typeof settings !== "object" ||
    !("mailer_autoconfirm" in settings) ||
    settings.mailer_autoconfirm !== false ||
    !("disable_signup" in settings) ||
    settings.disable_signup !== false
  ) {
    throw new Error("Email confirmation policy is not configured.");
  }
}
