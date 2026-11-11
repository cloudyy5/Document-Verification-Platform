import "server-only";

import { z } from "zod";

import { environmentError, hasLegacyKeyRole } from "./validation";

const serverSupabaseSchema = z.object({
  SUPABASE_SECRET_KEY: z
    .string()
    .trim()
    .min(1)
    .refine(
      (key) =>
        /^sb_secret_[A-Za-z0-9_-]+$/.test(key) ||
        hasLegacyKeyRole(key, "service_role"),
    ),
});

/** Never return this object from a page, Server Action, or Route Handler. */
export function getServerEnv(): { supabaseSecretKey: string } {
  const result = serverSupabaseSchema.safeParse({
    SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY,
  });

  if (!result.success) {
    throw environmentError(
      result.error.issues.map((issue) => String(issue.path[0])),
    );
  }

  return { supabaseSecretKey: result.data.SUPABASE_SECRET_KEY };
}
