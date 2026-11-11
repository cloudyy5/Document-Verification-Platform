import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Database } from "@/types/database";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  getClaims: vi.fn(),
  getSession: vi.fn(),
  server: vi.fn(),
  rpc: vi.fn(),
  get: vi.fn(),
  set: vi.fn(),
  remove: vi.fn(),
  config: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: mocks.get,
    set: mocks.set,
    delete: mocks.remove,
  }),
}));
vi.mock("@/lib/auth/config", () => ({ getAuthConfiguration: mocks.config }));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: mocks.server,
}));
vi.mock("@/lib/supabase/privileged", () => ({
  createPrivilegedSupabaseClient: () => ({ rpc: mocks.rpc }),
}));

import {
  consumeRecoveryGrant,
  getRecoveryContext,
  issueRecoveryGrant,
} from "@/lib/auth/recovery";
import {
  createRecoveryProof,
  readRecoveryProof,
  RECOVERY_COOKIE,
  RECOVERY_TTL,
} from "@/lib/auth/proof";

const userId = "61000000-0000-4000-8000-000000000001";
const otherUserId = "61000000-0000-4000-8000-000000000002";
const sessionId = "62000000-0000-4000-8000-000000000001";
const otherSessionId = "62000000-0000-4000-8000-000000000002";
const secret = "unit-test-recovery-secret-with-more-than-thirty-two-characters";
const client = {
  auth: {
    getUser: mocks.getUser,
    getClaims: mocks.getClaims,
    getSession: mocks.getSession,
  },
} as unknown as SupabaseClient<Database>;

beforeEach(() => {
  vi.resetAllMocks();
  mocks.config.mockReturnValue({
    appOrigin: "https://app.example.invalid",
    flowSecret: secret,
  });
  mocks.server.mockResolvedValue(client);
  mocks.getUser.mockResolvedValue({
    data: { user: { id: userId } },
    error: null,
  });
  mocks.getClaims.mockResolvedValue({
    data: { claims: { sub: userId, session_id: sessionId } },
    error: null,
  });
  mocks.rpc.mockResolvedValue({ data: true, error: null });
  const signed = createRecoveryProof(userId, sessionId, secret);
  mocks.get.mockReturnValue({ value: signed.value });
});

describe("server recovery session binding", () => {
  it("requires a signed proof, freshly verified user, verified matching claims and an active database grant", async () => {
    const context = await getRecoveryContext();
    expect(context?.client).toBe(client);
    expect(context?.proof).toMatchObject({ userId, sessionId });
    expect(mocks.getUser).toHaveBeenCalledOnce();
    expect(mocks.getClaims).toHaveBeenCalledOnce();
    expect(mocks.getSession).not.toHaveBeenCalled();
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith(
      "is_auth_recovery_grant_valid",
      {
        p_token_digest: createHash("sha256")
          .update(context!.proof.nonce)
          .digest("hex"),
        p_user_id: userId,
        p_session_id: sessionId,
      },
    );
    expect(JSON.stringify(mocks.rpc.mock.calls)).not.toContain(
      context!.proof.nonce,
    );
  });

  it.each(["missing", "expired", "tampered"] as const)(
    "rejects a %s proof before consulting any session or database",
    async (kind) => {
      if (kind === "missing") mocks.get.mockReturnValue(undefined);
      if (kind === "expired")
        mocks.get.mockReturnValue({
          value: createRecoveryProof(
            userId,
            sessionId,
            secret,
            Date.now() - (RECOVERY_TTL + 1) * 1000,
          ).value,
        });
      if (kind === "tampered") {
        const [payload, signature] = createRecoveryProof(
          userId,
          sessionId,
          secret,
        ).value.split(".");
        mocks.get.mockReturnValue({
          value: `${payload}.${signature![0] === "A" ? "B" : "A"}${signature!.slice(1)}`,
        });
      }
      expect(await getRecoveryContext()).toBeNull();
      expect(mocks.server).not.toHaveBeenCalled();
      expect(mocks.rpc).not.toHaveBeenCalled();
    },
  );

  it.each(["user", "session", "claim-subject", "missing-session"] as const)(
    "rejects mismatched %s even with an otherwise valid signed proof",
    async (kind) => {
      if (kind === "user") {
        mocks.getUser.mockResolvedValue({
          data: { user: { id: otherUserId } },
          error: null,
        });
        mocks.getClaims.mockResolvedValue({
          data: { claims: { sub: otherUserId, session_id: sessionId } },
          error: null,
        });
      } else {
        mocks.getClaims.mockResolvedValue({
          data: {
            claims: {
              sub: kind === "claim-subject" ? otherUserId : userId,
              session_id:
                kind === "missing-session"
                  ? undefined
                  : kind === "session"
                    ? otherSessionId
                    : sessionId,
            },
          },
          error: null,
        });
      }
      expect(await getRecoveryContext()).toBeNull();
      expect(mocks.rpc).not.toHaveBeenCalled();
    },
  );

  it.each([
    "user-error",
    "claims-error",
    "database-denial",
    "database-error",
    "client-error",
    "configuration-error",
  ] as const)(
    "fails closed for %s without fallback cookie identity",
    async (kind) => {
      if (kind === "user-error")
        mocks.getUser.mockResolvedValue({
          data: { user: null },
          error: { status: 503 },
        });
      if (kind === "claims-error")
        mocks.getClaims.mockResolvedValue({
          data: null,
          error: { message: "synthetic provider failure" },
        });
      if (kind === "database-denial")
        mocks.rpc.mockResolvedValue({ data: false, error: null });
      if (kind === "database-error")
        mocks.rpc.mockResolvedValue({
          data: null,
          error: { message: "synthetic database failure" },
        });
      if (kind === "client-error")
        mocks.server.mockRejectedValue(new Error("synthetic client failure"));
      if (kind === "configuration-error")
        mocks.config.mockImplementation(() => {
          throw new Error("synthetic configuration failure");
        });
      expect(await getRecoveryContext()).toBeNull();
      expect(mocks.getSession).not.toHaveBeenCalled();
      expect(mocks.set).not.toHaveBeenCalled();
    },
  );

  it("honors database replay denial when consuming the exact proof", async () => {
    const context = await getRecoveryContext();
    expect(context).not.toBeNull();
    mocks.rpc
      .mockResolvedValueOnce({ data: true, error: null })
      .mockResolvedValueOnce({ data: false, error: null });
    expect(await consumeRecoveryGrant(context!)).toBe(true);
    expect(await consumeRecoveryGrant(context!)).toBe(false);
    expect(mocks.rpc.mock.lastCall).toEqual([
      "consume_auth_recovery_grant",
      {
        p_token_digest: createHash("sha256")
          .update(context!.proof.nonce)
          .digest("hex"),
        p_user_id: userId,
        p_session_id: sessionId,
      },
    ]);
  });

  it("does not treat a failed database consume as permission to reset", async () => {
    const context = await getRecoveryContext();
    mocks.rpc.mockResolvedValue({
      data: null,
      error: { message: "synthetic database error" },
    });
    expect(await consumeRecoveryGrant(context!)).toBe(false);
  });
});

describe("recovery grant issuance after provider verification", () => {
  it("stores only a digest and sends a short-lived HttpOnly proof bound to verified identity", async () => {
    await issueRecoveryGrant(client);
    const [cookieName, value, options] = mocks.set.mock.calls[0]!;
    expect(cookieName).toBe(RECOVERY_COOKIE);
    expect(options).toEqual({
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: RECOVERY_TTL,
    });
    const proof = readRecoveryProof(value, secret);
    expect(proof).toMatchObject({ userId, sessionId });
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith(
      "issue_auth_recovery_grant",
      {
        p_token_digest: createHash("sha256").update(proof!.nonce).digest("hex"),
        p_user_id: userId,
        p_session_id: sessionId,
      },
    );
    expect(mocks.getSession).not.toHaveBeenCalled();
  });

  it("never sets a recovery proof when the provider binding or grant write fails", async () => {
    mocks.getClaims.mockResolvedValueOnce({
      data: { claims: { sub: otherUserId, session_id: sessionId } },
      error: null,
    });
    await expect(issueRecoveryGrant(client)).rejects.toThrow(
      "Recovery session unavailable.",
    );
    expect(mocks.rpc).not.toHaveBeenCalled();
    mocks.rpc.mockResolvedValue({
      data: null,
      error: { message: "synthetic private failure" },
    });
    await expect(issueRecoveryGrant(client)).rejects.toThrow(
      "Recovery grant unavailable.",
    );
    expect(mocks.set).not.toHaveBeenCalled();
  });
});
