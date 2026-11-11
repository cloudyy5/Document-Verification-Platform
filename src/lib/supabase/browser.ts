"use client";

import { createBrowserClient } from "@supabase/ssr";

import { getPublicEnv } from "@/lib/env/public";
import type { Database } from "@/types/database";

/** User-scoped client. Authorization still belongs in server checks and RLS. */
export function createSupabaseBrowserClient() {
  const { supabaseUrl, supabasePublishableKey } = getPublicEnv();

  return createBrowserClient<Database>(supabaseUrl, supabasePublishableKey);
}
