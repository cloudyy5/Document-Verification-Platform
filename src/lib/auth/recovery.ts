import "server-only";
import { createHash } from "node:crypto";
import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createPrivilegedSupabaseClient } from "@/lib/supabase/privileged";
import { getAuthConfiguration } from "./config";
import {
  createRecoveryProof,
  readRecoveryProof,
  RECOVERY_COOKIE,
  RECOVERY_TTL,
} from "./proof";

const digest = (value: string) =>
  createHash("sha256").update(value).digest("hex");

/** Fresh user verification plus signed JWT session_id; getSession is not identity proof. */
async function verifiedBinding(client: SupabaseClient<Database>) {
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) return null;
  const claims = await client.auth.getClaims();
  const sessionId = claims.data?.claims.session_id;
  if (
    claims.error ||
    claims.data?.claims.sub !== data.user.id ||
    typeof sessionId !== "string"
  )
    return null;
  return { userId: data.user.id, sessionId };
}

/** Call only after GoTrue has verified a token_hash with type=recovery. */
export async function issueRecoveryGrant(client: SupabaseClient<Database>) {
  const configuration = getAuthConfiguration();
  const binding = await verifiedBinding(client);
  if (!binding) throw new Error("Recovery session unavailable.");
  const signed = createRecoveryProof(
    binding.userId,
    binding.sessionId,
    configuration.flowSecret,
  );
  const { error } = await createPrivilegedSupabaseClient().rpc(
    "issue_auth_recovery_grant",
    {
      p_token_digest: digest(signed.proof.nonce),
      p_user_id: binding.userId,
      p_session_id: binding.sessionId,
    },
  );
  if (error) throw new Error("Recovery grant unavailable.");
  (await cookies()).set(RECOVERY_COOKIE, signed.value, {
    httpOnly: true,
    secure: configuration.appOrigin.startsWith("https:"),
    sameSite: "lax",
    path: "/",
    maxAge: RECOVERY_TTL,
  });
}

export async function getRecoveryContext() {
  try {
    const { flowSecret } = getAuthConfiguration();
    const proof = readRecoveryProof(
      (await cookies()).get(RECOVERY_COOKIE)?.value,
      flowSecret,
    );
    if (!proof) return null;
    const client = await createSupabaseServerClient();
    const binding = await verifiedBinding(client);
    if (
      !binding ||
      binding.userId !== proof.userId ||
      binding.sessionId !== proof.sessionId
    )
      return null;
    const { data, error } = await createPrivilegedSupabaseClient().rpc(
      "is_auth_recovery_grant_valid",
      {
        p_token_digest: digest(proof.nonce),
        p_user_id: proof.userId,
        p_session_id: proof.sessionId,
      },
    );
    return !error && data === true ? { client, proof } : null;
  } catch {
    return null;
  }
}

export async function consumeRecoveryGrant(
  context: NonNullable<Awaited<ReturnType<typeof getRecoveryContext>>>,
) {
  const { data, error } = await createPrivilegedSupabaseClient().rpc(
    "consume_auth_recovery_grant",
    {
      p_token_digest: digest(context.proof.nonce),
      p_user_id: context.proof.userId,
      p_session_id: context.proof.sessionId,
    },
  );
  return !error && data === true;
}

export async function clearRecoveryProof() {
  (await cookies()).delete(RECOVERY_COOKIE);
}
