/** Current service policies; historical versions remain readable. */
export const SIGNING_UPLOAD_POLICY_VERSION = "internal-upload-2026-11-17";
export const SIGNING_SHARING_POLICY_VERSION = "internal-sharing-2026-11-17";
export const SIGNING_ACTION_POLICY_VERSION = "internal-action-2026-11-17";
export const SIGNING_ACTION_POLICY_VERSIONS = [
  SIGNING_ACTION_POLICY_VERSION,
  "internal-action-development-2026-11-05",
] as const;

export const SIGNING_UPLOAD_CONSENT_TEXT =
  "Saya berhak mengunggah dokumen ini dan menyetujui penyimpanan PDF serta metadatanya untuk permintaan persetujuan dokumen. PDF hanya dapat diakses pihak yang berhak. Setelah disetujui, status, waktu persetujuan, nama penandatangan, dan judul dokumen dapat dilihat melalui QR tanpa login. Dokumen dan riwayat disimpan tanpa penghapusan otomatis; permintaan penghapusan ditangani melalui prosedur pengelola.";
export const SIGNING_SHARING_CONSENT_TEXT =
  "Saya mengizinkan penerima yang ditampilkan membaca dan mengunduh versi dokumen ini untuk menanggapi permintaan persetujuan. Saya memahami bahwa status, waktu persetujuan, nama penandatangan, dan judul dokumen yang disetujui dapat dibaca melalui QR tanpa login.";
export const SIGNING_ACTION_CONSENT_TEXT =
  "Saya telah membaca versi dokumen yang ditampilkan dan menyetujuinya melalui akun saya. Saya memahami bahwa status, waktu persetujuan, nama saya sebagai penandatangan, dan judul dokumen dapat dibaca melalui QR tanpa login. Catatan ini merupakan bukti persetujuan pada platform, bukan sertifikat tanda tangan elektronik.";
export function signingActionConsentText(version: string) {
  return version === SIGNING_ACTION_POLICY_VERSION
    ? SIGNING_ACTION_CONSENT_TEXT
    : "Saya telah membaca versi dokumen yang ditampilkan dan menyetujuinya melalui akun saya. Saya memahami bahwa catatan dan QR persetujuan ini merupakan bukti internal platform, bukan sertifikat tanda tangan elektronik.";
}

export const SIGNING_USER_CODE_PATTERN = /^DVP-[0-9A-F]{20}$/;

/** Accept the display grouping without turning lookup into a prefix search. */
export function normalizeSigningUserCode(input: string): string {
  const value = input.trim().toUpperCase();
  if (!value.startsWith("DVP-")) return value;
  return `DVP-${value.slice(4).replace(/[\s-]/g, "")}`;
}
