import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const store = vi.hoisted(() => ({
  all: [] as { name: string; value: string }[],
  remove: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  cookies: async () => ({ getAll: () => store.all, delete: store.remove }),
}));

import { clearLocalAuthCookies } from "@/lib/auth/cookies";
import { RECOVERY_COOKIE } from "@/lib/auth/proof";

beforeEach(() => {
  vi.clearAllMocks();
  store.all = [];
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", undefined);
  vi.stubEnv("SUPABASE_SECRET_KEY", undefined);
  vi.stubEnv("AUTH_FLOW_SECRET", undefined);
});
afterEach(() => {
  vi.unstubAllEnvs();
});

describe("local logout cookie cleanup", () => {
  it("clears this project's session, chunks and PKCE flow keys without requiring any keys", async () => {
    const prefix = "sb-project-auth-token";
    const ownNames = [
      prefix,
      `${prefix}.0`,
      `${prefix}.12`,
      `${prefix}-user`,
      `${prefix}-user.0`,
      `${prefix}-code-verifier`,
      `${prefix}-flows-code-verifier`,
      `${prefix}-flows-code-verifier.0`,
      `${prefix}-flow-aB1234_8-code-verifier`,
      `${prefix}-flow-aB1234_8-code-verifier.0`,
    ];
    store.all = [...ownNames, RECOVERY_COOKIE].map((name) => ({
      name,
      value: "synthetic-cookie",
    }));
    await clearLocalAuthCookies();
    expect(store.remove.mock.calls.map(([name]) => name).sort()).toEqual(
      [...ownNames, RECOVERY_COOKIE].sort(),
    );
  });

  it("preserves other projects and misleading prefix matches", async () => {
    const names = [
      "sb-another-auth-token",
      "sb-project-auth-token-other-auth-token",
      "sb-project-auth-token-other-auth-token.0",
      "sb-project-auth-token-extra",
      "sb-project-auth-token.custom",
      "sb-project-auth-token.0junk",
      "sb-project-auth-token-code-verifier-backup",
      "sb-project-auth-token-flow-short-code-verifier",
      "theme",
      "other-session",
    ];
    store.all = names.map((name) => ({ name, value: "synthetic-cookie" }));
    await clearLocalAuthCookies();
    expect(store.remove.mock.calls).toEqual([[RECOVERY_COOKIE]]);
  });

  it.each([
    undefined,
    "",
    "not-a-url",
    "https://user:secret@project.supabase.co",
    "http://remote.example.invalid",
  ])(
    "does not guess a project's identity when its URL is invalid: %j",
    async (value) => {
      vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", value);
      store.all = [
        { name: "sb-project-auth-token", value: "synthetic-cookie" },
      ];
      await expect(clearLocalAuthCookies()).resolves.toBeUndefined();
      expect(store.remove.mock.calls).toEqual([[RECOVERY_COOKIE]]);
    },
  );
});
