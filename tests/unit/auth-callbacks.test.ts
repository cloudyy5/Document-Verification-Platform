import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Route contracts use a mocked SDK. Cryptographic provider verification is
// exercised separately by the explicitly enabled live integration suite.
const mocks = vi.hoisted(() => ({
  configuration: vi.fn(),
  createClient: vi.fn(),
  exchange: vi.fn(),
  verify: vi.fn(),
  signOut: vi.fn(),
  issueGrant: vi.fn(),
  clearCookies: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: mocks.createClient,
}));
vi.mock("@/lib/auth/config", () => ({
  getAuthConfiguration: mocks.configuration,
}));
vi.mock("@/lib/auth/recovery", () => ({
  issueRecoveryGrant: mocks.issueGrant,
}));
vi.mock("@/lib/auth/cookies", () => ({
  clearLocalAuthCookies: mocks.clearCookies,
}));

import {
  GET as callback,
  HEAD as callbackHead,
} from "@/app/auth/callback/route";
import { GET as confirm, HEAD as confirmHead } from "@/app/auth/confirm/route";

const code = "synthetic_pkce_code_for_unit_tests_only";
const tokenHash = "a".repeat(64);
const client = {
  auth: {
    exchangeCodeForSession: mocks.exchange,
    verifyOtp: mocks.verify,
    signOut: mocks.signOut,
  },
};
const providerIdentity = {
  user: { id: "10000000-0000-4000-8000-000000000001" },
  session: { access_token: "synthetic-secret-session-never-output" },
};

function request(
  path: string,
  params: Record<string, string | undefined> = {},
  origin = "https://dvp.example",
) {
  const url = new URL(path, origin);
  for (const [key, value] of Object.entries(params))
    if (value !== undefined) url.searchParams.set(key, value);
  return new NextRequest(url);
}

function expectRedirect(response: Response, path: string) {
  expect(response.status).toBe(303);
  expect(response.headers.get("location")).toBe(`https://dvp.example${path}`);
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(response.headers.get("referrer-policy")).toBe("no-referrer");
  expect(response.headers.get("location")).not.toContain(
    "synthetic-secret-session",
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.configuration.mockReturnValue({
    appOrigin: "https://dvp.example",
    flowSecret: "synthetic-unit-test-secret-with-more-than-32-characters",
  });
  mocks.createClient.mockResolvedValue(client);
  mocks.exchange.mockResolvedValue({
    data: { ...providerIdentity, redirectType: "signup" },
    error: null,
  });
  mocks.verify.mockResolvedValue({ data: providerIdentity, error: null });
  mocks.signOut.mockResolvedValue({ error: null });
  mocks.issueGrant.mockResolvedValue(undefined);
  mocks.clearCookies.mockResolvedValue(undefined);
});

describe("email authentication callback contracts (mocked provider)", () => {
  it.each([undefined, "short", "https://attacker.example", "a".repeat(2049)])(
    "rejects a missing or malformed PKCE code before exchange",
    async (value) => {
      const response = await callback(
        request("/auth/callback", value === undefined ? {} : { code: value }),
      );
      expectRedirect(response, "/login?error=invalid_callback");
      expect(mocks.exchange).not.toHaveBeenCalled();
      expect(mocks.issueGrant).not.toHaveBeenCalled();
    },
  );

  it.each([
    {},
    { token_hash: "short", type: "recovery" },
    { token_hash: tokenHash, type: "magiclink" },
    { token_hash: tokenHash, type: "invite" },
    { token_hash: tokenHash, type: "email_change" },
    { token_hash: tokenHash },
    { token_hash: "a".repeat(2049), type: "recovery" },
    { token_hash: `${tokenHash}.invalid`, type: "recovery" },
  ])(
    "does not accept an unapproved or malformed confirmation request",
    async (params) => {
      const response = await confirm(request("/auth/confirm", params));
      expectRedirect(response, "/login?error=invalid_link");
      expect(mocks.verify).not.toHaveBeenCalled();
      expect(mocks.issueGrant).not.toHaveBeenCalled();
    },
  );

  it("verifies a recovery token using the provider's recovery category before issuing a grant", async () => {
    const response = await confirm(
      request("/auth/confirm", { token_hash: tokenHash, type: "recovery" }),
    );
    expect(mocks.verify).toHaveBeenCalledWith({
      token_hash: tokenHash,
      type: "recovery",
    });
    expect(mocks.issueGrant).toHaveBeenCalledWith(client);
    expect(mocks.verify.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.issueGrant.mock.invocationCallOrder[0]!,
    );
    expectRedirect(response, "/reset-password");
  });

  it("allows provider-prefixed URL-safe hashes while leaving their authenticity to the provider", async () => {
    const hash = `pkce_${"b".repeat(64)}`;
    await confirm(
      request("/auth/confirm", { token_hash: hash, type: "recovery" }),
    );
    expect(mocks.verify).toHaveBeenCalledWith({
      token_hash: hash,
      type: "recovery",
    });
  });

  it.each([
    {
      data: providerIdentity,
      error: { status: 400, message: "expired token for a private account" },
    },
    { data: { ...providerIdentity, user: null }, error: null },
    { data: { ...providerIdentity, session: null }, error: null },
  ])(
    "does not issue recovery authority without a complete provider-verified result",
    async (result) => {
      mocks.verify.mockResolvedValue(result);
      const response = await confirm(
        request("/auth/confirm", { token_hash: tokenHash, type: "recovery" }),
      );
      expectRedirect(response, "/login?error=invalid_link");
      expect(mocks.verify).toHaveBeenCalledOnce();
      expect(mocks.issueGrant).not.toHaveBeenCalled();
      expect(await response.text()).not.toContain("private account");
    },
  );

  it("does not convert an ordinary signup confirmation into a recovery grant or automatic login", async () => {
    const response = await confirm(
      request("/auth/confirm", {
        token_hash: tokenHash,
        type: "signup",
        next: "/admin/overview",
      }),
    );
    expect(mocks.verify).toHaveBeenCalledWith({
      token_hash: tokenHash,
      type: "signup",
    });
    expect(mocks.issueGrant).not.toHaveBeenCalled();
    expect(mocks.signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(mocks.clearCookies).toHaveBeenCalledOnce();
    expectRedirect(response, "/login?notice=email_verified");
  });

  it("does not infer recovery authority from browser-controlled PKCE redirect metadata", async () => {
    mocks.exchange.mockResolvedValue({
      data: { ...providerIdentity, redirectType: "recovery" },
      error: null,
    });
    const response = await callback(
      request("/auth/callback", {
        code,
        type: "recovery",
        next: "/reset-password",
      }),
    );
    expect(mocks.issueGrant).not.toHaveBeenCalled();
    expect(mocks.signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(mocks.clearCookies).toHaveBeenCalledOnce();
    expectRedirect(response, "/forgot-password?error=recovery_required");
  });

  it("finishes an ordinary PKCE email confirmation at login without preserving an automatic session", async () => {
    const response = await callback(
      request("/auth/callback", {
        code,
        next: "https://attacker.example",
        type: "recovery",
      }),
    );
    expect(mocks.exchange).toHaveBeenCalledWith(code);
    expect(mocks.issueGrant).not.toHaveBeenCalled();
    expect(mocks.signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(mocks.clearCookies).toHaveBeenCalledOnce();
    expectRedirect(response, "/login?notice=email_verified");
  });

  it.each([
    {
      data: providerIdentity,
      error: { status: 400, message: "provider contains sensitive detail" },
    },
    { data: { ...providerIdentity, user: null }, error: null },
    { data: { ...providerIdentity, session: null }, error: null },
  ])("does not accept a partial or failed PKCE exchange", async (result) => {
    mocks.exchange.mockResolvedValue(result);
    expectRedirect(
      await callback(request("/auth/callback", { code })),
      "/login?error=invalid_callback",
    );
    expect(mocks.issueGrant).not.toHaveBeenCalled();
  });

  it.each([
    ["PKCE", callback, "/auth/callback", { code }],
    [
      "confirmation",
      confirm,
      "/auth/confirm",
      { token_hash: tokenHash, type: "recovery" },
    ],
  ] as const)(
    "uses the configured canonical origin for %s redirects despite an untrusted request host",
    async (_name, handler, path, params) => {
      const response = await handler(
        request(path, params, "https://attacker.invalid"),
      );
      expect(new URL(response.headers.get("location")!).origin).toBe(
        "https://dvp.example",
      );
      expect(response.headers.get("location")).not.toContain(
        "attacker.invalid",
      );
      expect(response.headers.get("location")).not.toContain(tokenHash);
      expect(response.headers.get("location")).not.toContain(code);
    },
  );

  it.each([
    ["PKCE", callback, "/auth/callback", { code }],
    [
      "confirmation",
      confirm,
      "/auth/confirm",
      { token_hash: tokenHash, type: "recovery" },
    ],
  ] as const)(
    "returns an unavailable response for %s when canonical configuration is absent",
    async (_name, handler, path, params) => {
      mocks.configuration.mockImplementation(() => {
        throw new Error("private configuration detail");
      });
      const response = await handler(
        request(path, params, "https://attacker.invalid"),
      );
      expect(response.status).toBe(503);
      expect(response.headers.get("location")).toBeNull();
      expect(response.headers.get("cache-control")).toBe("private, no-store");
      expect(response.headers.get("referrer-policy")).toBe("no-referrer");
      expect(await response.text()).not.toContain(
        "private configuration detail",
      );
      expect(mocks.createClient).not.toHaveBeenCalled();
    },
  );

  it("does not send a recovery browser to reset-password when durable grant creation fails", async () => {
    mocks.issueGrant.mockRejectedValue(new Error("private RPC failure"));
    expectRedirect(
      await confirm(
        request("/auth/confirm", { token_hash: tokenHash, type: "recovery" }),
      ),
      "/login?error=auth_unavailable",
    );
  });

  it("clears local signup credentials even if provider sign-out throws", async () => {
    mocks.signOut.mockRejectedValue(new Error("private signout failure"));
    expectRedirect(
      await confirm(
        request("/auth/confirm", { token_hash: tokenHash, type: "signup" }),
      ),
      "/login?error=auth_unavailable",
    );
    expect(mocks.clearCookies).toHaveBeenCalledOnce();
  });

  it.each([
    ["PKCE", callbackHead],
    ["confirmation", confirmHead],
  ] as const)(
    "rejects %s HEAD requests without consuming any token",
    async (_name, handler) => {
      const response = handler();
      expect(response.status).toBe(405);
      expect(response.headers.get("allow")).toBe("GET");
      expect(await response.text()).toBe("");
      expect(mocks.createClient).not.toHaveBeenCalled();
      expect(mocks.issueGrant).not.toHaveBeenCalled();
    },
  );
});
