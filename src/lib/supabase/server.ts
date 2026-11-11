import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { getPublicEnv } from "@/lib/env/public";
import type { Database } from "@/types/database";

/** Create per request. Never share a cookie-scoped client between users. */
export async function createSupabaseServerClient() {
  const { supabaseUrl, supabasePublishableKey } = getPublicEnv();
  const cookieStore = await cookies();

  return createServerClient<Database>(supabaseUrl, supabasePublishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server Components cannot write cookies. src/proxy.ts refreshes
          // request/response cookies; Server Actions and routes can write here.
        }
      },
    },
  });
}
