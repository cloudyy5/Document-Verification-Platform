import "server-only";
import { ApiError } from "@/server/errors";

export function signingUnavailable(): ApiError {
  return new ApiError(
    503,
    "SIGNING_UNAVAILABLE",
    "Layanan persetujuan internal sementara tidak tersedia. Silakan coba kembali.",
  );
}

/** Map only the narrow RPC's static errors; never expose database details. */
export function mapSigningDatabaseError(
  error: { code?: string; message?: string } | null,
): ApiError {
  if (error?.code === "42501" && error.message === "SIGNING_ACTOR_REQUIRED")
    return new ApiError(
      403,
      "SIGNING_NOT_ALLOWED",
      "Akun atau verifikasi email belum memenuhi syarat persetujuan internal.",
    );
  if (error?.code === "22023" && error.message === "INVALID_SIGNING_INPUT")
    return new ApiError(
      422,
      "VALIDATION_ERROR",
      "Data atau kebijakan telah berubah. Muat ulang formulir.",
    );
  if (error?.code === "P0002" && error.message === "SIGNING_NOT_FOUND")
    return new ApiError(404, "NOT_FOUND", "Permintaan tidak ditemukan.");
  if (error?.code !== "P0001") return signingUnavailable();
  switch (error.message) {
    case "SIGNING_VERSION_CONFLICT":
      return new ApiError(
        409,
        "VERSION_CONFLICT",
        "Versi dokumen tidak cocok. Muat ulang sebelum mengambil tindakan.",
      );
    case "SIGNING_RENDER_CLAIM_EXPIRED":
      return new ApiError(
        409,
        "RENDER_CLAIM_EXPIRED",
        "Pekerjaan PDF telah berubah. Muat ulang bukti untuk mencoba lagi.",
      );
    case "SIGNING_RECIPIENT_UNAVAILABLE":
      return new ApiError(
        404,
        "RECIPIENT_UNAVAILABLE",
        "Penerima tidak tersedia. Periksa kode akun yang diberikan.",
      );
    case "SIGNING_IDEMPOTENCY_CONFLICT":
      return new ApiError(
        409,
        "IDEMPOTENCY_CONFLICT",
        "Referensi permintaan telah digunakan untuk data berbeda. Periksa permintaan keluar.",
      );
    case "SIGNING_DOCUMENT_NOT_ELIGIBLE":
      return new ApiError(
        409,
        "DOCUMENT_NOT_ELIGIBLE",
        "Dokumen sudah memiliki permintaan. Gunakan draft baru untuk permintaan baru.",
      );
    case "SIGNING_REQUEST_EXPIRED":
      return new ApiError(
        409,
        "REQUEST_EXPIRED",
        "Permintaan telah kedaluwarsa dan tidak dapat diubah.",
      );
    case "SIGNING_REQUEST_NOT_ELIGIBLE":
      return new ApiError(
        409,
        "REQUEST_NOT_ELIGIBLE",
        "Status permintaan telah berubah. Muat ulang detail permintaan.",
      );
    default:
      return signingUnavailable();
  }
}
