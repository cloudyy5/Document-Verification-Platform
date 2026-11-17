import "server-only";
import { getAppOrigin } from "@/lib/auth/config";
import { ApiError } from "@/server/errors";
import { SUBMISSION_POLICY_VERSION } from "@/lib/documents/policy";

export function getSubmissionConfiguration() {
  const origin = new URL(getAppOrigin());
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname);
  const environment =
    process.env.DOCUMENT_ENVIRONMENT ?? (local ? "development" : "production");
  const maxBytes = Number(
    process.env.DOCUMENT_MAX_FILE_BYTES ?? 10 * 1024 * 1024,
  );
  if (
    !["development", "production"].includes(environment) ||
    (!local &&
      (environment !== "production" || origin.protocol !== "https:")) ||
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
    policyVersion: SUBMISSION_POLICY_VERSION,
    environment: environment as "development" | "production",
  };
}
