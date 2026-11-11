import { randomBytes, randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Database } from "../../src/types/database";
import { validateSupabasePublicEnv } from "../../src/lib/env/public";
import { hasLegacyKeyRole } from "../../src/lib/env/validation";

// REAL GoTrue/PostgREST checks. They are intentionally skipped without an
// explicit development-project opt-in and never substitute a fake backend.
const enabled = process.env.SUPABASE_AUTH_TEST_ENABLED === "1";
let service: SupabaseClient<Database> | undefined;
let clientA: SupabaseClient<Database>;
let clientB: SupabaseClient<Database>;
let projectUrl = "";
let publicKey = "";
const created: { id: string; email: string; password: string }[] = [];

const authOptions = {
  persistSession: false,
  autoRefreshToken: false,
  detectSessionInUrl: false,
} as const;

function newUserClient() {
  return createClient<Database>(projectUrl, publicKey, { auth: authOptions });
}

function password() {
  return `${randomBytes(24).toString("base64url")}aA9!`;
}

function requireSuccess(error: { code?: string } | null, operation: string) {
  if (error)
    throw new Error(
      `${operation} failed (${error.code ?? "provider_error"}). No credential values are logged.`,
    );
}

describe.skipIf(!enabled)(
  "real Supabase development authentication integration",
  () => {
    beforeAll(async () => {
      if (process.env.SUPABASE_AUTH_TEST_CONFIRM !== "development-project") {
        throw new Error(
          "Set SUPABASE_AUTH_TEST_CONFIRM=development-project only for an isolated development project.",
        );
      }
      const configuration = validateSupabasePublicEnv({
        NEXT_PUBLIC_SUPABASE_URL: process.env.SUPABASE_AUTH_TEST_URL,
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
          process.env.SUPABASE_AUTH_TEST_PUBLISHABLE_KEY,
      });
      const secret = process.env.SUPABASE_AUTH_TEST_SECRET_KEY ?? "";
      if (
        !/^sb_secret_[A-Za-z0-9_-]+$/.test(secret) &&
        !hasLegacyKeyRole(secret, "service_role")
      ) {
        throw new Error(
          "SUPABASE_AUTH_TEST_SECRET_KEY must be configured server-side for synthetic account setup and cleanup.",
        );
      }
      projectUrl = configuration.supabaseUrl;
      publicKey = configuration.supabasePublishableKey;
      service = createClient<Database>(projectUrl, secret, {
        auth: authOptions,
      });

      for (const suffix of ["a", "b"]) {
        const email = `dvp-auth-${randomUUID()}-${suffix}@example.invalid`;
        const value = password();
        // Admin provisioning confirms synthetic accounts directly. It does not
        // send signup/invite/confirmation email to any address.
        const result = await service.auth.admin.createUser({
          email,
          password: value,
          email_confirm: true,
          user_metadata: {
            full_name: "Synthetic authentication test",
            role: "platform_admin",
            roles: ["reviewer"],
          },
        });
        requireSuccess(result.error, "Synthetic account creation");
        if (!result.data.user)
          throw new Error("Synthetic account creation returned no identity.");
        created.push({ id: result.data.user.id, email, password: value });
      }
      clientA = newUserClient();
      clientB = newUserClient();
      for (const [index, client] of [clientA, clientB].entries()) {
        const identity = created[index]!;
        const result = await client.auth.signInWithPassword({
          email: identity.email,
          password: identity.password,
        });
        requireSuccess(result.error, "Synthetic account sign-in");
        expect(Boolean(result.data.session)).toBe(true);
      }
    });

    afterAll(async () => {
      if (!service) return;
      let failures = 0;
      for (const identity of created) {
        const result = await service.auth.admin.deleteUser(identity.id);
        if (result.error) failures++;
      }
      if (failures)
        throw new Error(
          "Synthetic test account cleanup failed. Review the dedicated development project; no credentials are logged.",
        );
    });

    it("verifies signed-in identities and creates only normal user roles despite metadata", async () => {
      for (const [index, client] of [clientA, clientB].entries()) {
        const identity = await client.auth.getUser();
        requireSuccess(identity.error, "Server identity verification");
        expect(identity.data.user?.id).toBe(created[index]!.id);
        const roles = await client.from("user_roles").select("role");
        requireSuccess(roles.error, "Own role query");
        expect(roles.data).toEqual([{ role: "user" }]);
      }
    });

    it("enforces own profile and role visibility through the actual Data API", async () => {
      const own = await clientA
        .from("profiles")
        .select("id")
        .eq("id", created[0]!.id);
      requireSuccess(own.error, "Own profile query");
      expect(own.data).toEqual([{ id: created[0]!.id }]);
      const foreignProfile = await clientA
        .from("profiles")
        .select("id")
        .eq("id", created[1]!.id);
      requireSuccess(foreignProfile.error, "Cross-account profile query");
      expect(foreignProfile.data).toEqual([]);
      const foreignRoles = await clientB
        .from("user_roles")
        .select("role")
        .eq("user_id", created[0]!.id);
      requireSuccess(foreignRoles.error, "Cross-account role query");
      expect(foreignRoles.data).toEqual([]);
    });

    it("uses equivalent provider login errors for invalid and unknown accounts", async () => {
      const invalid = await newUserClient().auth.signInWithPassword({
        email: created[0]!.email,
        password: password(),
      });
      const unknown = await newUserClient().auth.signInWithPassword({
        email: `dvp-unknown-${randomUUID()}@example.invalid`,
        password: password(),
      });
      expect(Boolean(invalid.error)).toBe(true);
      expect(Boolean(unknown.error)).toBe(true);
      expect(invalid.error?.code === unknown.error?.code).toBe(true);
      expect(invalid.error?.message === unknown.error?.message).toBe(true);
    });

    it("accepts a real one-use recovery token and updates the password without sending email", async () => {
      if (!service)
        throw new Error("Synthetic account setup did not complete.");
      const generated = await service.auth.admin.generateLink({
        type: "recovery",
        email: created[1]!.email,
      });
      requireSuccess(generated.error, "Recovery link generation");
      const tokenHash = generated.data.properties?.hashed_token;
      if (!tokenHash)
        throw new Error("Recovery link generation returned no token hash.");
      // A URL parameter cannot change the provider-issued token category.
      const wrongType = await newUserClient().auth.verifyOtp({
        type: "signup",
        token_hash: tokenHash,
      });
      expect(Boolean(wrongType.error)).toBe(true);
      const recoveryClient = newUserClient();
      const verified = await recoveryClient.auth.verifyOtp({
        type: "recovery",
        token_hash: tokenHash,
      });
      requireSuccess(verified.error, "Recovery token verification");
      expect(verified.data.user?.id).toBe(created[1]!.id);
      expect(Boolean(verified.data.session)).toBe(true);
      const replay = await newUserClient().auth.verifyOtp({
        type: "recovery",
        token_hash: tokenHash,
      });
      expect(Boolean(replay.error)).toBe(true);
      const replacement = password();
      const updated = await recoveryClient.auth.updateUser({
        password: replacement,
      });
      requireSuccess(updated.error, "Recovered password update");
      const previousLogin = await newUserClient().auth.signInWithPassword({
        email: created[1]!.email,
        password: created[1]!.password,
      });
      expect(Boolean(previousLogin.error)).toBe(true);
      const replacementLogin = await newUserClient().auth.signInWithPassword({
        email: created[1]!.email,
        password: replacement,
      });
      requireSuccess(replacementLogin.error, "Replacement password sign-in");
      expect(Boolean(replacementLogin.data.session)).toBe(true);
    });

    it("clears the client session and prevents refresh after global sign-out", async () => {
      const signed = await clientA.auth.getSession();
      requireSuccess(signed.error, "Synthetic session read");
      const refreshToken = signed.data.session?.refresh_token;
      if (!refreshToken)
        throw new Error("Synthetic sign-in did not provide a refresh token.");
      const logout = await clientA.auth.signOut({ scope: "global" });
      requireSuccess(logout.error, "Global sign-out");
      const localSession = await clientA.auth.getSession();
      requireSuccess(localSession.error, "Signed-out session read");
      expect(localSession.data.session).toBeNull();
      const refreshed = await newUserClient().auth.refreshSession({
        refresh_token: refreshToken,
      });
      expect(Boolean(refreshed.error)).toBe(true);
    });
  },
);
