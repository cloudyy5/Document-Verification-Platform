import { afterEach, describe, expect, it, vi } from "vitest";

import {
  getPublicEnv,
  validateSupabasePublicEnv,
} from "../../src/lib/env/public";
import { getServerEnv } from "../../src/lib/env/server";

vi.mock("server-only", () => ({}));

const publicKey = "sb_publishable_unit_test_placeholder";
const configured = {
  NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: publicKey,
};

function legacyKey(role: string): string {
  const encode = (value: unknown) =>
    btoa(JSON.stringify(value))
      .replace(/=/g, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");
  return `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ role })}.signature`;
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("Supabase public environment", () => {
  it("returns only the validated public configuration", () => {
    expect(validateSupabasePublicEnv(configured)).toEqual({
      supabaseUrl: "https://project.supabase.co",
      supabasePublishableKey: publicKey,
    });
  });

  it.each([
    "http://localhost:54321",
    "http://127.0.0.1:54321",
    "http://[::1]:54321",
  ])("supports the local Supabase development URL %s", (url) => {
    expect(
      validateSupabasePublicEnv({
        ...configured,
        NEXT_PUBLIC_SUPABASE_URL: url,
      }).supabaseUrl,
    ).toBe(url);
  });

  it.each([
    "http://project.supabase.co",
    "http://localhost.attacker.example",
    "https://user:password@project.supabase.co",
    "https://project.supabase.co?token=unexpected",
    "https://project.supabase.co/rest/v1",
    "not-a-url",
  ])("rejects an unsafe or malformed backend URL %s", (url) => {
    expect(() =>
      validateSupabasePublicEnv({
        ...configured,
        NEXT_PUBLIC_SUPABASE_URL: url,
      }),
    ).toThrow("NEXT_PUBLIC_SUPABASE_URL");
  });

  it("accepts a legacy anon key without treating it as identity verification", () => {
    const anonKey = legacyKey("anon");
    expect(
      validateSupabasePublicEnv({
        ...configured,
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: anonKey,
      }).supabasePublishableKey,
    ).toBe(anonKey);
  });

  it.each([
    "sb_secret_should_never_be_public",
    legacyKey("service_role"),
    legacyKey("authenticated"),
    "eyJ.invalid.key",
  ])(
    "rejects privileged, user-session, or invalid keys in the public field",
    (key) => {
      let thrown: unknown;
      try {
        validateSupabasePublicEnv({
          ...configured,
          NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: key,
        });
      } catch (error) {
        thrown = error;
      }
      expect(thrown).toBeInstanceOf(Error);
      expect((thrown as Error).message).toContain(
        "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
      );
      expect((thrown as Error).message).not.toContain(key);
    },
  );

  it.each([
    {},
    { NEXT_PUBLIC_SUPABASE_URL: configured.NEXT_PUBLIC_SUPABASE_URL },
    { NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: publicKey },
  ])("fails closed for incomplete configuration", (values) => {
    expect(() => validateSupabasePublicEnv(values)).toThrow(
      "Konfigurasi environment belum valid",
    );
  });

  it("reads explicitly allowed public fields without returning the server secret", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", configured.NEXT_PUBLIC_SUPABASE_URL);
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", publicKey);
    vi.stubEnv("SUPABASE_SECRET_KEY", "sb_secret_server_only_placeholder");
    expect(getPublicEnv()).toEqual({
      supabaseUrl: configured.NEXT_PUBLIC_SUPABASE_URL,
      supabasePublishableKey: publicKey,
    });
    expect(JSON.stringify(getPublicEnv())).not.toContain(
      "server_only_placeholder",
    );
  });
});

describe("Supabase server environment", () => {
  it("validates the server-only secret lazily", () => {
    vi.stubEnv("SUPABASE_SECRET_KEY", "sb_secret_unit_test_placeholder");
    expect(getServerEnv()).toEqual({
      supabaseSecretKey: "sb_secret_unit_test_placeholder",
    });
  });

  it("supports a legacy service_role key only on the server", () => {
    const serviceKey = legacyKey("service_role");
    vi.stubEnv("SUPABASE_SECRET_KEY", serviceKey);
    expect(getServerEnv().supabaseSecretKey).toBe(serviceKey);
  });

  it.each([undefined, "", publicKey, legacyKey("anon")])(
    "rejects missing or nonprivileged server keys",
    (key) => {
      vi.stubEnv("SUPABASE_SECRET_KEY", key);
      expect(() => getServerEnv()).toThrow("SUPABASE_SECRET_KEY");
    },
  );
});
