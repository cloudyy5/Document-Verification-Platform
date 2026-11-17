import "server-only";

import { createClient } from "@supabase/supabase-js";

import { getPublicEnv } from "@/lib/env/public";
import { getServerEnv } from "@/lib/env/server";
import type { Database } from "@/types/database";

/**
 * Bypasses RLS. Private operations verify session, role and participant scope.
 * The S-19 public metadata DAL is an explicit exception: it invokes only the
 * service-only limiter and four-field projection RPC, never private table reads.
 */
export function createPrivilegedSupabaseClient(options?: {
  timeoutMs: number;
}) {
  const { supabaseUrl } = getPublicEnv();
  const { supabaseSecretKey } = getServerEnv();

  return createClient<Database>(supabaseUrl, supabaseSecretKey, {
    ...(options
      ? {
          global: {
            fetch: (input: RequestInfo | URL, init?: RequestInit) =>
              fetch(input, {
                ...init,
                signal: init?.signal
                  ? AbortSignal.any([
                      init.signal,
                      AbortSignal.timeout(options.timeoutMs),
                    ])
                  : AbortSignal.timeout(options.timeoutMs),
              }),
          },
        }
      : {}),
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
