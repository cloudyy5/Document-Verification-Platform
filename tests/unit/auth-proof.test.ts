import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  createRecoveryProof,
  readRecoveryProof,
  RECOVERY_COOKIE,
  RECOVERY_TTL,
} from "../../src/lib/auth/proof";

const userId = "10000000-0000-4000-8000-000000000001";
const sessionId = "20000000-0000-4000-8000-000000000001";
const otherId = "30000000-0000-4000-8000-000000000001";
const secret = "test-only-recovery-secret-".repeat(3);
const now = Date.UTC(2026, 10, 3, 12);

function signed(data: unknown, key = secret, domain = "recovery") {
  const payload = Buffer.from(JSON.stringify(data)).toString("base64url");
  return `${payload}.${createHmac("sha256", key).update(`${domain}:${payload}`).digest("base64url")}`;
}

describe("signed recovery proof", () => {
  it("round-trips an expiring user/session-bound proof", () => {
    const { value, proof } = createRecoveryProof(
      userId,
      sessionId,
      secret,
      now,
    );
    expect(readRecoveryProof(value, secret, now)).toEqual(proof);
    expect(proof).toMatchObject({
      version: 1,
      userId,
      sessionId,
      expiresAt: now / 1000 + 600,
    });
    expect(RECOVERY_TTL).toBe(600);
    expect(RECOVERY_COOKIE).toBe("dvp-password-recovery");
    expect(proof.nonce).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(value).not.toContain(secret);
  });

  it("creates independent nonces for identical user/session inputs", () => {
    const values = Array.from({ length: 32 }, () =>
      createRecoveryProof(userId, sessionId, secret, now),
    );
    expect(new Set(values.map(({ value }) => value)).size).toBe(values.length);
    expect(new Set(values.map(({ proof }) => proof.nonce)).size).toBe(
      values.length,
    );
  });

  it("rejects altered payloads, signatures, signing keys, and signing domains", () => {
    const { value, proof } = createRecoveryProof(
      userId,
      sessionId,
      secret,
      now,
    );
    const [payload, signature] = value.split(".");
    const replacement = `${signature![0] === "A" ? "B" : "A"}${signature!.slice(1)}`;
    expect(
      readRecoveryProof(`${payload}.${replacement}`, secret, now),
    ).toBeNull();
    const alteredPayload = Buffer.from(
      JSON.stringify({ ...proof, userId: otherId }),
    ).toString("base64url");
    expect(
      readRecoveryProof(`${alteredPayload}.${signature}`, secret, now),
    ).toBeNull();
    const alteredSession = Buffer.from(
      JSON.stringify({ ...proof, sessionId: otherId }),
    ).toString("base64url");
    expect(
      readRecoveryProof(`${alteredSession}.${signature}`, secret, now),
    ).toBeNull();
    expect(
      readRecoveryProof(value, "different-test-signing-key-".repeat(3), now),
    ).toBeNull();
    expect(
      readRecoveryProof(signed(proof, secret, "session"), secret, now),
    ).toBeNull();
  });

  it("accepts only the ten-minute validity window", () => {
    const { value, proof } = createRecoveryProof(
      userId,
      sessionId,
      secret,
      now,
    );
    expect(readRecoveryProof(value, secret, now + 599_999)).toEqual(proof);
    expect(readRecoveryProof(value, secret, now + 600_000)).toBeNull();
    expect(readRecoveryProof(value, secret, now + 3_600_000)).toBeNull();
    expect(
      readRecoveryProof(
        signed({ ...proof, expiresAt: now / 1000 + RECOVERY_TTL + 1 }),
        secret,
        now,
      ),
    ).toBeNull();
  });

  it.each([
    undefined,
    "",
    "not-a-proof",
    "a.b.c",
    ".",
    "a.",
    ".a",
    "abc=.abc",
    "a b.c",
    "a".repeat(2049),
  ])("rejects malformed proof input", (value) => {
    expect(readRecoveryProof(value, secret, now)).toBeNull();
  });

  it.each([
    null,
    [],
    "text",
    { version: 2 },
    { userId: "not-a-uuid" },
    { sessionId: "not-a-uuid" },
    { nonce: "short" },
    { nonce: "a".repeat(44) },
    { expiresAt: "123" },
    { expiresAt: null },
    { expiresAt: 1.5 },
  ])("rejects malformed signed proof metadata", (change) => {
    const { proof } = createRecoveryProof(userId, sessionId, secret, now);
    const data =
      change && typeof change === "object" && !Array.isArray(change)
        ? { ...proof, ...change }
        : change;
    expect(readRecoveryProof(signed(data), secret, now)).toBeNull();
  });

  it.each([
    ["bad-user", sessionId, secret],
    [userId, "bad-session", secret],
    [userId, sessionId, "short"],
  ])("refuses invalid issuer configuration", (owner, session, key) => {
    expect(() => createRecoveryProof(owner!, session!, key!, now)).toThrow(
      "Invalid recovery proof configuration.",
    );
  });

  it("fails closed when the verifier key is too short", () => {
    const { value } = createRecoveryProof(userId, sessionId, secret, now);
    expect(readRecoveryProof(value, "short", now)).toBeNull();
  });
});
