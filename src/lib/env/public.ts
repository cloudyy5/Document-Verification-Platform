import { z } from "zod";

import {
  environmentError,
  hasLegacyKeyRole,
  isSafeSupabaseUrl,
} from "./validation";

const publicSupabaseSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().trim().min(1).refine(isSafeSupabaseUrl),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z
    .string()
    .trim()
    .min(1)
    .refine(
      (key) =>
        /^sb_publishable_[A-Za-z0-9_-]+$/.test(key) ||
        hasLegacyKeyRole(key, "anon"),
    ),
});

export interface PublicEnv {
  supabaseUrl: string;
  supabasePublishableKey: string;
}

export interface SupabasePublicEnvValues {
  NEXT_PUBLIC_SUPABASE_URL?: string | undefined;
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?: string | undefined;
}

/** Pure validation, separate from environment reads for deterministic tests. */
export function validateSupabasePublicEnv(
  values: SupabasePublicEnvValues,
): PublicEnv {
  const result = publicSupabaseSchema.safeParse(values);

  if (!result.success) {
    throw environmentError(
      result.error.issues.map((issue) => String(issue.path[0])),
    );
  }

  return {
    supabaseUrl: result.data.NEXT_PUBLIC_SUPABASE_URL,
    supabasePublishableKey: result.data.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  };
}

/** Lazy by design: the Phase 0 interface runs without a configured backend. */
export function getPublicEnv(): PublicEnv {
  // Explicit references let Next.js inline only these two public values.
  return validateSupabasePublicEnv({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  });
}
