/** Approved only for synthetic development use, 5 November 2026. */
export const SIGNING_UPLOAD_POLICY_VERSION =
  "internal-upload-development-2026-11-05";
export const SIGNING_SHARING_POLICY_VERSION =
  "internal-sharing-development-2026-11-05";
export const SIGNING_ACTION_POLICY_VERSION =
  "internal-action-development-2026-11-05";

export const SIGNING_UPLOAD_CONSENT_TEXT =
  "Saya berhak mengunggah dokumen ini dan menyetujui penyimpanan PDF serta metadatanya secara privat untuk pengujian prototipe persetujuan dokumen internal. Saya menggunakan dokumen sintetis tanpa data pribadi nyata.";
export const SIGNING_SHARING_CONSENT_TEXT =
  "Saya mengizinkan penerima yang ditampilkan untuk membaca dan mengunduh versi dokumen ini guna menanggapi permintaan persetujuan melalui platform internal.";
export const SIGNING_ACTION_CONSENT_TEXT =
  "Saya telah membaca versi dokumen yang ditampilkan dan menyetujuinya melalui akun saya. Saya memahami bahwa catatan dan QR persetujuan ini merupakan bukti internal platform, bukan sertifikat tanda tangan elektronik.";

export const SIGNING_USER_CODE_PATTERN = /^DVP-[0-9A-F]{20}$/;

/** Accept the display grouping without turning lookup into a prefix search. */
export function normalizeSigningUserCode(input: string): string {
  const value = input.trim().toUpperCase();
  if (!value.startsWith("DVP-")) return value;
  return `DVP-${value.slice(4).replace(/[\s-]/g, "")}`;
}
