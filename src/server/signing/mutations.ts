import "server-only";
import { createHmac } from "node:crypto";
import { z } from "zod";
import { getAuthConfiguration } from "@/lib/auth/config";
import {
  recipientLookupSchema,
  sendSigningRequestSchema,
} from "@/lib/signing/validation";
import { SIGNING_USER_CODE_PATTERN } from "@/lib/signing/policy";
import { createPrivilegedSupabaseClient } from "@/lib/supabase/privileged";
import { apiSession } from "@/server/api";
import { derivedUploadId } from "@/server/documents/upload";
import { ApiError } from "@/server/errors";
import { getSigningConfiguration } from "./config";
import { mapSigningDatabaseError, signingUnavailable } from "./errors";
import type {
  SendSigningRequestInput,
  SigningRecipient,
  SigningRequestReceipt,
} from "./types";

type Client = ReturnType<typeof createPrivilegedSupabaseClient>;
type SigningAction = "lookup" | "send" | "cancel";
const timestamp = z.iso.datetime({ offset: true }).max(40);
const receiptSchema = z.object({
  requestId: z.uuid(),
  documentId: z.uuid(),
  sourceVersionId: z.uuid(),
  status: z.enum([
    "pending",
    "cancelled",
    "rejected",
    "consented",
    "completed",
  ]),
  sentAt: timestamp,
  expiresAt: timestamp,
  cancelledAt: timestamp.nullable(),
});
const recipientSchema = z.object({
  id: z.uuid(),
  code: z.string().regex(SIGNING_USER_CODE_PATTERN),
  displayName: z.string().min(1).max(120),
});

async function requireActor() {
  const session = await apiSession("user");
  if (!session.user.emailConfirmed)
    throw new ApiError(
      403,
      "EMAIL_VERIFICATION_REQUIRED",
      "Verifikasi email sebelum menggunakan permintaan persetujuan internal.",
    );
  if (!session.roles.includes("user"))
    throw new ApiError(
      403,
      "SIGNING_NOT_ALLOWED",
      "Akun belum dapat menggunakan permintaan persetujuan internal.",
    );
  getSigningConfiguration();
  return session;
}

async function safeOperation<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw signingUnavailable();
  }
}

function invalidInput(): ApiError {
  return new ApiError(
    422,
    "VALIDATION_ERROR",
    "Periksa kembali data permintaan.",
  );
}

async function allowOperation(
  client: Client,
  actorId: string,
  action: SigningAction,
) {
  const { flowSecret } = getAuthConfiguration();
  const digest = (value: string) =>
    createHmac("sha256", flowSecret).update(value).digest("hex");
  const { data, error } = await client.rpc("consume_signing_operation_limit", {
    p_action: action,
    p_key_digest: digest(`signing\0${action}\0${actorId}`),
    p_global_digest: digest(`signing\0${action}\0application`),
  });
  if (error || typeof data !== "boolean") throw signingUnavailable();
  if (!data)
    throw new ApiError(
      429,
      "RATE_LIMITED",
      "Terlalu banyak permintaan. Tunggu beberapa saat sebelum mencoba kembali.",
    );
}

/** POST-only at the API layer; this exact lookup never returns email or phone. */
export async function lookupSigningRecipient(
  code: string,
): Promise<SigningRecipient> {
  return safeOperation(async () => {
    const session = await requireActor();
    const parsed = recipientLookupSchema.safeParse({ code });
    if (!parsed.success) throw invalidInput();
    const client = createPrivilegedSupabaseClient();
    await allowOperation(client, session.user.id, "lookup");
    const { data, error } = await client.rpc("lookup_signing_recipient", {
      p_actor_id: session.user.id,
      p_code: parsed.data.code,
    });
    if (error) throw mapSigningDatabaseError(error);
    const recipient = recipientSchema.parse(data);
    if (recipient.id === session.user.id || recipient.code !== parsed.data.code)
      throw mapSigningDatabaseError({
        code: "P0001",
        message: "SIGNING_RECIPIENT_UNAVAILABLE",
      });
    return recipient;
  });
}

/** Actor and deterministic request ID are derived on the server, never supplied by the body. */
export async function sendSigningRequest(
  input: SendSigningRequestInput,
  key: string,
): Promise<SigningRequestReceipt> {
  return safeOperation(async () => {
    const session = await requireActor();
    const parsed = sendSigningRequestSchema.safeParse(input);
    if (!parsed.success) throw invalidInput();
    if (!z.uuid().safeParse(key).success)
      throw new ApiError(
        400,
        "INVALID_IDEMPOTENCY_KEY",
        "Referensi permintaan tidak valid. Muat ulang formulir.",
      );
    const sourceVersionId = parsed.data.sourceVersionId.toLowerCase();
    const requestId = derivedUploadId(
      session.user.id,
      key,
      `signing-request:${sourceVersionId}`,
    );
    const client = createPrivilegedSupabaseClient();
    await allowOperation(client, session.user.id, "send");
    const { data, error } = await client.rpc("send_signing_request", {
      p_actor_id: session.user.id,
      p_request_id: requestId,
      p_source_version_id: sourceVersionId,
      p_recipient_code: parsed.data.recipientCode,
      p_recipient_id: parsed.data.recipientId.toLowerCase(),
      p_sharing_policy_version: parsed.data.sharingPolicyVersion,
      p_sharing_consent: true,
    });
    if (error) throw mapSigningDatabaseError(error);
    const receipt = receiptSchema.parse(data);
    if (
      receipt.requestId !== requestId ||
      receipt.sourceVersionId !== sourceVersionId
    )
      throw signingUnavailable();
    return receipt;
  });
}

export async function cancelSigningRequest(
  requestId: string,
): Promise<SigningRequestReceipt> {
  return safeOperation(async () => {
    const session = await requireActor();
    if (!z.uuid().safeParse(requestId).success)
      throw new ApiError(404, "NOT_FOUND", "Permintaan tidak ditemukan.");
    const id = requestId.toLowerCase();
    const client = createPrivilegedSupabaseClient();
    await allowOperation(client, session.user.id, "cancel");
    const { data, error } = await client.rpc("cancel_signing_request", {
      p_actor_id: session.user.id,
      p_request_id: id,
    });
    if (error) throw mapSigningDatabaseError(error);
    const receipt = receiptSchema.parse(data);
    if (receipt.requestId !== id || receipt.status !== "cancelled")
      throw signingUnavailable();
    return receipt;
  });
}
