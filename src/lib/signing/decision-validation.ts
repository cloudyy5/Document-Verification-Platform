import { z } from "zod";
import { SIGNING_ACTION_POLICY_VERSION } from "./policy";
import { QR_PLACEMENT_VERSION, qrPositionsSchema } from "./placement";

const binding = {
  sourceVersionId: z.uuid(),
  sourceSha256: z.string().regex(/^[a-f0-9]{64}$/),
  policyVersion: z.literal(SIGNING_ACTION_POLICY_VERSION),
  confirmed: z.literal(true),
};
export const signingDecisionSchema = z.discriminatedUnion("action", [
  z.strictObject({
    ...binding,
    action: z.literal("approve"),
    consent: z.literal(true),
    placementVersion: z.literal(QR_PLACEMENT_VERSION),
    placements: qrPositionsSchema,
  }),
  z.strictObject({
    ...binding,
    action: z.literal("reject"),
    consent: z.literal(false),
    reason: z
      .string()
      .trim()
      .min(1, "Alasan penolakan wajib diisi.")
      .max(1000, "Alasan maksimal 1.000 karakter."),
  }),
]);
export type SigningDecisionInput = z.infer<typeof signingDecisionSchema>;
