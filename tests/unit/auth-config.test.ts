import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  getAppOrigin,
  getAuthConfiguration,
  isAuthConfigured,
} from "@/lib/auth/config";

beforeEach(() => {
  vi.stubEnv("APP_URL", "https://app.example.invalid");
  vi.stubEnv(
    "AUTH_FLOW_SECRET",
    "unit-test-flow-secret-with-at-least-thirty-two-characters",
  );
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");
  vi.stubEnv(
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    "sb_publishable_unit_public",
  );
  vi.stubEnv("SUPABASE_SECRET_KEY", "sb_secret_unit_private");
});
afterEach(() => {
  vi.unstubAllEnvs();
});

describe("canonical application origin", () => {
  it("remains available without any Supabase keys, project URL, or recovery secret", () => {
    for (const name of [
      "AUTH_FLOW_SECRET",
      "NEXT_PUBLIC_SUPABASE_URL",
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
      "SUPABASE_SECRET_KEY",
    ])
      vi.stubEnv(name, undefined);
    expect(getAppOrigin()).toBe("https://app.example.invalid");
    expect(isAuthConfigured()).toBe(false);
  });

  it.each([
    ["https://APP.example.invalid:443/", "https://app.example.invalid"],
    ["http://127.0.0.1:3000", "http://127.0.0.1:3000"],
    ["http://localhost:3100/", "http://localhost:3100"],
    ["http://[::1]:3000/", "http://[::1]:3000"],
  ])("normalizes a valid canonical URL %s", (value, expected) => {
    vi.stubEnv("APP_URL", value);
    expect(getAppOrigin()).toBe(expected);
  });

  it.each([
    undefined,
    "",
    "not-a-url",
    "http://app.example.invalid",
    "//app.example.invalid",
    "https://user:private-password@app.example.invalid",
    "https://app.example.invalid/path",
    "https://app.example.invalid/?next=evil",
    "https://app.example.invalid/#fragment",
    "ftp://app.example.invalid",
    "javascript:alert(1)",
  ])(
    "rejects unsafe canonical URL %j without returning its contents",
    (value) => {
      vi.stubEnv("APP_URL", value);
      expect(getAppOrigin).toThrow("Layanan autentikasi belum dikonfigurasi.");
      expect(isAuthConfigured()).toBe(false);
    },
  );
});

describe("full authentication configuration", () => {
  it("requires every public and privileged setting for flows that use them", () => {
    expect(getAuthConfiguration()).toEqual({
      appOrigin: getAppOrigin(),
      flowSecret: process.env.AUTH_FLOW_SECRET,
    });
    expect(isAuthConfigured()).toBe(true);
  });

  it.each([
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    "SUPABASE_SECRET_KEY",
    "AUTH_FLOW_SECRET",
  ])(
    "keeps full auth unavailable when %s is absent while retaining canonical origin",
    (name) => {
      vi.stubEnv(name, undefined);
      expect(isAuthConfigured()).toBe(false);
      expect(getAuthConfiguration).toThrow();
      expect(getAppOrigin()).toBe("https://app.example.invalid");
    },
  );

  it("does not expose an invalid flow secret in its configuration error", () => {
    const privateValue = "short-private-value";
    vi.stubEnv("AUTH_FLOW_SECRET", privateValue);
    let failure: unknown;
    try {
      getAuthConfiguration();
    } catch (error) {
      failure = error;
    }
    expect(failure).toBeInstanceOf(Error);
    expect((failure as Error).message).not.toContain(privateValue);
  });
});
