import { z } from "zod";

/** S-19 whitelist. Never extend this DTO with private evidence/file fields. */
export const signingPublicMetadataSchema = z.strictObject({
  status: z.literal("approved"),
  approvedAt: z.iso.datetime({ offset: true }),
  signerName: z.string().trim().min(1).max(120),
  documentTitle: z.string().trim().min(1).max(200),
});
export type SigningPublicMetadata = z.infer<typeof signingPublicMetadataSchema>;
export const SIGNING_PUBLIC_METADATA_NOTICE =
  "Setelah disetujui, QR dapat dipindai tanpa login untuk melihat status, waktu persetujuan, nama penandatangan, dan judul dokumen. PDF, email, dan kode akun tetap privat.";
