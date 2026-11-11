import {
  hasLegacyKeyRole,
  isSafeSupabaseUrl,
} from "../src/lib/env/validation.ts";

// Node 24 supports the erasable TypeScript syntax in this shared pure validator.
// Do not load dotenv: Docker builds must receive only the two public values.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ?? "";
const invalid = [];
if (!isSafeSupabaseUrl(url)) invalid.push("NEXT_PUBLIC_SUPABASE_URL");
if (
  !/^sb_publishable_[A-Za-z0-9_-]+$/.test(key) &&
  !hasLegacyKeyRole(key, "anon")
)
  invalid.push("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");

if (invalid.length) {
  console.error(
    `Invalid Docker public build configuration: ${invalid.join(", ")}`,
  );
  process.exitCode = 1;
} else {
  console.log("Docker public build configuration valid; values omitted.");
}
