import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const script = resolve("scripts/check-docker-public-env.mjs");
const url = "https://synthetic-project.supabase.co";
const publicKey = "sb_publishable_synthetic_build_test";
const jwt = (role: string) =>
  [
    "header",
    Buffer.from(JSON.stringify({ role })).toString("base64url"),
    "signature",
  ].join(".");

function check(values: Record<string, string>) {
  return spawnSync(process.execPath, ["--experimental-strip-types", script], {
    encoding: "utf8",
    env: {
      NODE_ENV: "test",
      PATH: process.env.PATH,
      SystemRoot: process.env.SystemRoot,
      ...values,
    },
  });
}
describe("Docker public build environment preflight", () => {
  it.each([publicKey, jwt("anon")])(
    "accepts public key formats without provider calls",
    (key) => {
      const result = check({
        NEXT_PUBLIC_SUPABASE_URL: url,
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: key,
      });
      expect(result.status).toBe(0);
      expect(result.stdout).toContain("configuration valid");
      expect(result.stdout + result.stderr).not.toContain(key);
    },
  );
  it.each([
    {
      NEXT_PUBLIC_SUPABASE_URL: url,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
        "sb_secret_synthetic_do_not_publish",
    },
    {
      NEXT_PUBLIC_SUPABASE_URL: url,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: jwt("service_role"),
    },
    {
      NEXT_PUBLIC_SUPABASE_URL: "http://remote.invalid",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: publicKey,
    },
    {
      NEXT_PUBLIC_SUPABASE_URL:
        "https://user:synthetic-password@remote.invalid",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: publicKey,
    },
    { NEXT_PUBLIC_SUPABASE_URL: "", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "" },
  ])(
    "blocks missing, unsafe or privileged public configuration with redacted errors",
    (values) => {
      const result = check(values);
      expect(result.status).toBe(1);
      expect(result.stderr).toContain(
        "Invalid Docker public build configuration",
      );
      for (const value of Object.values(values).filter(Boolean))
        expect(result.stdout + result.stderr).not.toContain(value);
      expect(result.stdout + result.stderr).not.toContain("synthetic-password");
    },
  );
});
