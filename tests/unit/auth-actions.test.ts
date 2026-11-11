import { beforeEach, describe, expect, it, vi } from "vitest";

// Contract tests with mocked provider responses. These do not claim a live
// Supabase connection, SMTP delivery, or end-to-end account authentication.
const mocks = vi.hoisted(() => ({
  origin: "https://dvp.example" as string | null,
  configuration: vi.fn(),
  appOrigin: vi.fn(),
  headers: vi.fn(),
  createClient: vi.fn(),
  allowAttempt: vi.fn(),
  getSession: vi.fn(),
  requireConfirmation: vi.fn(),
  getRecovery: vi.fn(),
  consumeRecovery: vi.fn(),
  clearProof: vi.fn(),
  clearCookies: vi.fn(),
  signIn: vi.fn(),
  signUp: vi.fn(),
  recover: vi.fn(),
  resend: vi.fn(),
  update: vi.fn(),
  signOut: vi.fn(),
  events: [] as string[],
  redirect: vi.fn((path: string): never => {
    throw new Error(`NEXT_REDIRECT:${path}`);
  }),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ headers: mocks.headers }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: mocks.createClient,
}));
vi.mock("@/lib/auth/config", () => ({
  getAuthConfiguration: mocks.configuration,
  getAppOrigin: mocks.appOrigin,
}));
vi.mock("@/lib/auth/rate-limit", () => ({
  allowAuthAttempt: mocks.allowAttempt,
}));
vi.mock("@/lib/auth/session", () => ({ getAuthSession: mocks.getSession }));
vi.mock("@/lib/auth/provider-policy", () => ({
  requireProviderEmailConfirmation: mocks.requireConfirmation,
}));
vi.mock("@/lib/auth/recovery", () => ({
  getRecoveryContext: mocks.getRecovery,
  consumeRecoveryGrant: mocks.consumeRecovery,
  clearRecoveryProof: mocks.clearProof,
}));
vi.mock("@/lib/auth/cookies", () => ({
  clearLocalAuthCookies: mocks.clearCookies,
}));

import {
  loginAction,
  registerAction,
  forgotPasswordAction,
  resendVerificationAction,
  resetPasswordAction,
  logoutAction,
} from "@/app/(auth)/actions";

const idle = { status: "idle" } as const;
const password = "Synthetic-password-A9!";
const userId = "10000000-0000-4000-8000-000000000001";
const client = {
  auth: {
    signInWithPassword: mocks.signIn,
    signUp: mocks.signUp,
    resetPasswordForEmail: mocks.recover,
    resend: mocks.resend,
    updateUser: mocks.update,
    signOut: mocks.signOut,
  },
};

function form(extra: Record<string, string> = {}) {
  const value = new FormData();
  for (const [key, item] of Object.entries({
    fullName: "Synthetic Owner",
    email: "owner@example.invalid",
    password,
    confirmPassword: password,
    next: "/dashboard",
    ...extra,
  }))
    value.set(key, item);
  return value;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.events = [];
  mocks.origin = "https://dvp.example";
  mocks.appOrigin.mockReturnValue("https://dvp.example");
  mocks.configuration.mockReturnValue({
    appOrigin: "https://dvp.example",
    flowSecret: "synthetic-unit-test-secret-with-more-than-32-characters",
  });
  mocks.headers.mockImplementation(
    async () => new Headers(mocks.origin ? { origin: mocks.origin } : {}),
  );
  mocks.createClient.mockResolvedValue(client);
  mocks.allowAttempt.mockResolvedValue(true);
  mocks.requireConfirmation.mockResolvedValue(undefined);
  mocks.getSession.mockResolvedValue({
    user: { id: userId, emailConfirmed: true },
    roles: ["user"],
  });
  mocks.signIn.mockResolvedValue({
    data: {
      user: { id: userId, app_metadata: { role: "platform_admin" } },
      session: {},
    },
    error: null,
  });
  mocks.signUp.mockResolvedValue({
    data: { user: { id: userId }, session: null },
    error: null,
  });
  mocks.recover.mockResolvedValue({ data: {}, error: null });
  mocks.resend.mockResolvedValue({ data: {}, error: null });
  mocks.getRecovery.mockResolvedValue({
    client,
    proof: {
      userId,
      sessionId: "20000000-0000-4000-8000-000000000001",
      nonce: "synthetic-test-nonce",
      version: 1,
      expiresAt: 2_000_000_000,
    },
  });
  mocks.consumeRecovery.mockImplementation(async () => {
    mocks.events.push("consume");
    return true;
  });
  mocks.clearProof.mockImplementation(async () => {
    mocks.events.push("clearProof");
  });
  mocks.clearCookies.mockImplementation(async () => {
    mocks.events.push("clearCookies");
  });
  mocks.update.mockImplementation(async () => {
    mocks.events.push("update");
    return { data: {}, error: null };
  });
  mocks.signOut.mockImplementation(async () => {
    mocks.events.push("signOut");
    return { error: null };
  });
});

describe("authentication Server Action contracts (mocked provider)", () => {
  const actions = [
    ["login", () => loginAction(idle, form())],
    ["register", () => registerAction(idle, form())],
    ["forgot password", () => forgotPasswordAction(idle, form())],
    ["resend verification", () => resendVerificationAction(idle, form())],
    ["reset password", () => resetPasswordAction(idle, form())],
    ["logout", () => logoutAction()],
  ] as const;

  it.each(actions)(
    "rejects cross-origin %s before a provider mutation",
    async (_name, run) => {
      mocks.origin = "https://attacker.example";
      await run();
      expect(mocks.createClient).not.toHaveBeenCalled();
      expect(mocks.allowAttempt).not.toHaveBeenCalled();
      expect(mocks.update).not.toHaveBeenCalled();
      expect(mocks.signOut).not.toHaveBeenCalled();
      expect(mocks.clearCookies).not.toHaveBeenCalled();
    },
  );

  it.each([null, "null", "https://dvp.example.attacker.test"])(
    "rejects missing and deceptive origins",
    async (origin) => {
      mocks.origin = origin;
      const result = await loginAction(idle, form());
      expect(result.status).toBe("error");
      expect(mocks.signIn).not.toHaveBeenCalled();
    },
  );

  it("fails closed and does not expose configuration failure details", async () => {
    mocks.configuration.mockImplementation(() => {
      throw new Error("sb_secret_do_not_echo_internal_configuration");
    });
    const result = await loginAction(idle, form());
    expect(result.status).toBe("error");
    expect(JSON.stringify(result)).not.toContain("sb_secret_do_not_echo");
    expect(mocks.signIn).not.toHaveBeenCalled();
  });

  it("does not call authentication for invalid form input", async () => {
    const result = await registerAction(
      idle,
      form({ email: "invalid", confirmPassword: "does-not-match" }),
    );
    expect(result.status).toBe("error");
    expect(result.fieldErrors?.email).toBeTruthy();
    expect(mocks.allowAttempt).not.toHaveBeenCalled();
    expect(mocks.signUp).not.toHaveBeenCalled();
  });

  it("blocks a rate-limited login before password authentication", async () => {
    mocks.allowAttempt.mockResolvedValue(false);
    const result = await loginAction(idle, form());
    expect(result.status).toBe("error");
    expect(mocks.signIn).not.toHaveBeenCalled();
  });

  it("fails closed if the durable rate limiter is unavailable", async () => {
    mocks.allowAttempt.mockRejectedValue(new Error("internal database error"));
    expect((await forgotPasswordAction(idle, form())).status).toBe("error");
    expect(mocks.recover).not.toHaveBeenCalled();
  });

  it("derives a login destination from verified roles instead of submitted roles or metadata", async () => {
    await expect(
      loginAction(
        idle,
        form({
          role: "platform_admin",
          owner_id: "different-owner",
          next: "/admin/overview",
        }),
      ),
    ).rejects.toThrow("NEXT_REDIRECT:/dashboard");
    expect(mocks.getSession).toHaveBeenCalledOnce();
    expect(mocks.signIn).toHaveBeenCalledWith({
      email: "owner@example.invalid",
      password,
    });
    expect(mocks.clearProof).toHaveBeenCalledOnce();
  });

  it("allows a reviewer to return only to a safe in-app review destination", async () => {
    mocks.getSession.mockResolvedValue({
      user: { id: userId, emailConfirmed: true },
      roles: ["user", "reviewer"],
    });
    await expect(
      loginAction(idle, form({ next: "/admin/review-queue" })),
    ).rejects.toThrow("NEXT_REDIRECT:/admin/review-queue");
  });

  it.each(["", "/dashboard", "/signing/new", "/requests/incoming"])(
    "sends a successful ordinary login to admin despite a stale user return path %s",
    async (next) => {
      mocks.getSession.mockResolvedValue({
        user: { id: userId, emailConfirmed: true },
        roles: ["user", "platform_admin"],
      });
      await expect(
        loginAction(idle, form({ next, role: "user" })),
      ).rejects.toThrow("NEXT_REDIRECT:/admin/overview");
      expect(mocks.signIn).toHaveBeenCalledWith({
        email: "owner@example.invalid",
        password,
      });
    },
  );
  it("sends an ordinary user login without a return path to the user dashboard", async () => {
    await expect(loginAction(idle, form({ next: "" }))).rejects.toThrow(
      "NEXT_REDIRECT:/dashboard",
    );
  });

  it("does not report login success without verified server identity and role context", async () => {
    mocks.getSession.mockResolvedValue(null);
    const result = await loginAction(idle, form());
    expect(result.status).toBe("error");
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("uses the same login response for account-specific provider failures", async () => {
    mocks.signIn.mockResolvedValueOnce({
      data: { user: null, session: null },
      error: {
        status: 400,
        code: "invalid_credentials",
        message: "account not found",
      },
    });
    const unknown = await loginAction(idle, form());
    mocks.signIn.mockResolvedValueOnce({
      data: { user: null, session: null },
      error: {
        status: 400,
        code: "email_not_confirmed",
        message: "email not confirmed",
      },
    });
    const unconfirmed = await loginAction(idle, form());
    expect(unknown).toEqual(unconfirmed);
    expect(JSON.stringify(unknown)).not.toMatch(
      /account not found|email not confirmed/,
    );
  });

  it("sends only ordinary registration metadata and the canonical callback URL", async () => {
    const result = await registerAction(
      idle,
      form({
        role: "platform_admin",
        roles: "reviewer",
        user_id: "another-user",
        next: "//attacker.example",
      }),
    );
    expect(result.status).toBe("success");
    expect(mocks.requireConfirmation).toHaveBeenCalledOnce();
    expect(mocks.signUp).toHaveBeenCalledWith({
      email: "owner@example.invalid",
      password,
      options: {
        data: { full_name: "Synthetic Owner" },
        emailRedirectTo: "https://dvp.example/auth/callback",
      },
    });
  });

  it("refuses signup when provider email confirmation is not enforced", async () => {
    mocks.requireConfirmation.mockRejectedValue(
      new Error("provider policy unavailable"),
    );
    expect((await registerAction(idle, form())).status).toBe("error");
    expect(mocks.signUp).not.toHaveBeenCalled();
  });

  it("removes an unexpected automatic registration session", async () => {
    mocks.signUp.mockResolvedValue({
      data: {
        user: { id: userId },
        session: { access_token: "synthetic-session-not-for-output" },
      },
      error: null,
    });
    const result = await registerAction(idle, form());
    // The conditional email response is identical; the browser receives no session.
    expect(result.status).toBe("success");
    expect(mocks.signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(mocks.clearCookies).toHaveBeenCalledOnce();
    expect(mocks.redirect).not.toHaveBeenCalled();
    expect(JSON.stringify(result)).not.toContain(
      "synthetic-session-not-for-output",
    );
  });

  it.each([
    [
      "registration",
      registerAction,
      mocks.signUp,
      { data: { user: null, session: null } },
    ],
    ["password recovery", forgotPasswordAction, mocks.recover, { data: {} }],
    [
      "verification resend",
      resendVerificationAction,
      mocks.resend,
      { data: {} },
    ],
  ] as const)(
    "does not reveal %s account existence through SMTP/provider outcomes",
    async (_name, action, provider, response) => {
      provider.mockResolvedValueOnce({ ...response, error: null });
      const accepted = await action(idle, form());
      provider.mockResolvedValueOnce({
        ...response,
        error: {
          status: 422,
          code: "user_not_found",
          message: "private account detail",
        },
      });
      const unknown = await action(idle, form());
      provider.mockResolvedValueOnce({
        ...response,
        error: {
          status: 500,
          code: "unexpected_failure",
          message: "SMTP failed for an existing account",
        },
      });
      const smtpFailure = await action(idle, form());
      provider.mockRejectedValueOnce(
        new Error("SMTP network failure for known account"),
      );
      const thrownFailure = await action(idle, form());
      expect(accepted).toEqual(unknown);
      expect(accepted).toEqual(smtpFailure);
      expect(accepted).toEqual(thrownFailure);
      expect(JSON.stringify(accepted)).not.toMatch(
        /private account detail|SMTP failed/,
      );
    },
  );

  it("requires a bound recovery context instead of a normal signed-in session", async () => {
    mocks.getRecovery.mockResolvedValue(null);
    const result = await resetPasswordAction(idle, form());
    expect(result.status).toBe("error");
    expect(mocks.consumeRecovery).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("does not change a password after recovery grant replay", async () => {
    mocks.consumeRecovery.mockResolvedValue(false);
    const result = await resetPasswordAction(idle, form());
    expect(result.status).toBe("error");
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("consumes the recovery grant before a password mutation and then clears sessions", async () => {
    await expect(resetPasswordAction(idle, form())).rejects.toThrow(
      "NEXT_REDIRECT:/login?notice=password_updated",
    );
    expect(mocks.update).toHaveBeenCalledWith({ password });
    expect(mocks.events.indexOf("consume")).toBeLessThan(
      mocks.events.indexOf("update"),
    );
    expect(mocks.signOut).toHaveBeenCalledWith({ scope: "global" });
    expect(mocks.clearCookies).toHaveBeenCalledOnce();
  });

  it("does not claim password update success when the provider rejects the mutation", async () => {
    mocks.update.mockResolvedValue({
      data: {},
      error: { status: 400, message: "private provider detail" },
    });
    const result = await resetPasswordAction(idle, form());
    expect(result.status).toBe("error");
    expect(mocks.redirect).not.toHaveBeenCalled();
    expect(JSON.stringify(result)).not.toContain("private provider detail");
  });

  it("clears local credentials even when remote sign-out throws", async () => {
    mocks.signOut.mockRejectedValue(new Error("temporary provider outage"));
    await expect(logoutAction()).rejects.toThrow(
      "NEXT_REDIRECT:/login?notice=signed_out",
    );
    expect(mocks.clearCookies).toHaveBeenCalledOnce();
  });

  it("allows local logout when unrelated authentication secrets are unavailable", async () => {
    mocks.configuration.mockImplementation(() => {
      throw new Error("unavailable service or flow secret");
    });
    await expect(logoutAction()).rejects.toThrow(
      "NEXT_REDIRECT:/login?notice=signed_out",
    );
    expect(mocks.configuration).not.toHaveBeenCalled();
    expect(mocks.signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(mocks.clearCookies).toHaveBeenCalledOnce();
  });

  it("clears local credentials when the provider client cannot be created", async () => {
    mocks.createClient.mockRejectedValue(
      new Error("missing public authentication key"),
    );
    await expect(logoutAction()).rejects.toThrow(
      "NEXT_REDIRECT:/login?notice=signed_out",
    );
    expect(mocks.signOut).not.toHaveBeenCalled();
    expect(mocks.clearCookies).toHaveBeenCalledOnce();
  });

  it("clears local credentials when the provider returns a sign-out error", async () => {
    mocks.signOut.mockResolvedValue({
      error: { status: 503, message: "provider unavailable" },
    });
    await expect(logoutAction()).rejects.toThrow(
      "NEXT_REDIRECT:/login?notice=signed_out",
    );
    expect(mocks.clearCookies).toHaveBeenCalledOnce();
  });

  it("does not clear credentials when the canonical logout origin is missing", async () => {
    mocks.appOrigin.mockImplementation(() => {
      throw new Error("missing canonical origin");
    });
    await logoutAction();
    expect(mocks.createClient).not.toHaveBeenCalled();
    expect(mocks.clearCookies).not.toHaveBeenCalled();
    expect(mocks.redirect).not.toHaveBeenCalled();
  });
});
