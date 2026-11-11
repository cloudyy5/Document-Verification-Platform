import { z } from "zod";
import { parseSubmissionFields } from "@/lib/documents/validation";
import {
  normalizeSigningUserCode,
  SIGNING_SHARING_POLICY_VERSION,
  SIGNING_UPLOAD_POLICY_VERSION,
  SIGNING_USER_CODE_PATTERN,
} from "./policy";

export const signingCodeSchema = z
  .string()
  .max(64)
  .transform(normalizeSigningUserCode)
  .refine(
    (code) => SIGNING_USER_CODE_PATTERN.test(code),
    "Periksa format kode akun.",
  );
export const recipientLookupSchema = z.strictObject({
  code: signingCodeSchema,
});
export const sendSigningRequestSchema = z.strictObject({
  sourceVersionId: z.uuid(),
  recipientCode: signingCodeSchema,
  recipientId: z.uuid(),
  sharingPolicyVersion: z.literal(SIGNING_SHARING_POLICY_VERSION),
  sharingConsent: z.literal(
    true,
    "Konfirmasikan izin berbagi versi dokumen ini.",
  ),
});
export type SendSigningRequestInput = z.infer<typeof sendSigningRequestSchema>;

export function parseSigningDraftForm(
  form: FormData,
  categoryIsOther: boolean,
) {
  return parseSubmissionFields(
    form,
    SIGNING_UPLOAD_POLICY_VERSION,
    categoryIsOther,
  );
}
