import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export type RecoveryProof = {
  version: 1;
  userId: string;
  sessionId: string;
  nonce: string;
  expiresAt: number;
};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const RECOVERY_COOKIE = "dvp-password-recovery";
export const RECOVERY_TTL = 600;

function signature(payload: string, secret: string) {
  return createHmac("sha256", secret).update(`recovery:${payload}`).digest();
}

export function createRecoveryProof(
  userId: string,
  sessionId: string,
  secret: string,
  now = Date.now(),
): { value: string; proof: RecoveryProof } {
  if (!uuid.test(userId) || !uuid.test(sessionId) || secret.length < 32)
    throw new Error("Invalid recovery proof configuration.");
  const proof: RecoveryProof = {
    version: 1,
    userId,
    sessionId,
    nonce: randomBytes(32).toString("base64url"),
    expiresAt: Math.floor(now / 1000) + RECOVERY_TTL,
  };
  const payload = Buffer.from(JSON.stringify(proof)).toString("base64url");
  return {
    value: `${payload}.${signature(payload, secret).toString("base64url")}`,
    proof,
  };
}

export function readRecoveryProof(
  value: string | undefined,
  secret: string,
  now = Date.now(),
): RecoveryProof | null {
  if (!value || value.length > 2048 || secret.length < 32) return null;
  const parts = value.split(".");
  if (
    parts.length !== 2 ||
    !parts.every((part) => /^[A-Za-z0-9_-]+$/.test(part))
  )
    return null;
  try {
    const actual = Buffer.from(parts[1]!, "base64url");
    const expected = signature(parts[0]!, secret);
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected))
      return null;
    const data: unknown = JSON.parse(
      Buffer.from(parts[0]!, "base64url").toString("utf8"),
    );
    if (!data || typeof data !== "object") return null;
    const proof = data as Partial<RecoveryProof>;
    const nowSeconds = Math.floor(now / 1000);
    if (
      proof.version !== 1 ||
      typeof proof.userId !== "string" ||
      !uuid.test(proof.userId) ||
      typeof proof.sessionId !== "string" ||
      !uuid.test(proof.sessionId) ||
      typeof proof.nonce !== "string" ||
      !/^[A-Za-z0-9_-]{43}$/.test(proof.nonce) ||
      !Number.isInteger(proof.expiresAt) ||
      proof.expiresAt! <= nowSeconds ||
      proof.expiresAt! > nowSeconds + RECOVERY_TTL
    )
      return null;
    return proof as RecoveryProof;
  } catch {
    return null;
  }
}
