import "server-only";
import { getAppOrigin } from "@/lib/auth/config";
import { ApiError } from "@/server/errors";

export const DEVELOPMENT_POLICY_VERSION = "development-2026-11-04";
export function getSubmissionConfiguration() {
  const origin = new URL(getAppOrigin());
  const development =
    ["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname) &&
    (process.env.DOCUMENT_ENVIRONMENT ?? "development") === "development";
  const maxBytes = Number(
    process.env.DOCUMENT_MAX_FILE_BYTES ?? 10 * 1024 * 1024,
  );
  if (
    !development ||
    !Number.isSafeInteger(maxBytes) ||
    maxBytes < 1 ||
    maxBytes > 10 * 1024 * 1024
  )
    throw new ApiError(
      503,
      "UPLOAD_UNAVAILABLE",
      "Pengajuan belum tersedia pada lingkungan ini.",
    );
  return {
    maxBytes,
    policyVersion: DEVELOPMENT_POLICY_VERSION,
    environment: "development" as const,
  };
}
