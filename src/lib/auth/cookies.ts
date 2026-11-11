import "server-only";
import { cookies } from "next/headers";
import { isSafeSupabaseUrl } from "@/lib/env/validation";
import { RECOVERY_COOKIE } from "./proof";

/** Clear this project's local session even if the provider is unavailable. */
export async function clearLocalAuthCookies() {
  const store = await cookies();
  store.delete(RECOVERY_COOKIE);
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  // If the project URL is unknown, do not guess which project's cookies to delete.
  if (!supabaseUrl || !isSafeSupabaseUrl(supabaseUrl)) return;
  const prefix = `sb-${new URL(supabaseUrl).hostname.split(".")[0]}-auth-token`;
  for (const cookie of store.getAll()) {
    const suffix = cookie.name.startsWith(prefix)
      ? cookie.name.slice(prefix.length)
      : null;
    // Match only this SDK's session/user/PKCE keys and numeric chunk suffixes.
    // A loose prefix match could also match a different project's storage key.
    if (
      suffix !== null &&
      /^(?:-(?:user|code-verifier|flows-code-verifier|flow-[A-Za-z0-9_-]{8,64}-code-verifier))?(?:\.[0-9]+)?$/.test(
        suffix,
      )
    )
      store.delete(cookie.name);
  }
}
