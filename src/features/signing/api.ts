export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const isUuid = (value: unknown): value is string =>
  typeof value === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

export class SigningClientError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly fields: Record<string, string> = {},
  ) {
    super(message);
  }
}

export async function signingFetch(path: string, init?: RequestInit) {
  const response = await fetch(path, {
    credentials: "same-origin",
    cache: "no-store",
    signal: AbortSignal.timeout(120_000),
    ...init,
  });
  let result: unknown;
  try {
    result = await response.json();
  } catch {
    throw new SigningClientError(
      "Konfirmasi server belum diterima. Periksa daftar Anda sebelum mencoba kembali.",
      response.status,
    );
  }
  if (!response.ok) {
    const error =
      isRecord(result) && isRecord(result.error) ? result.error : null;
    const fields: Record<string, string> = {};
    if (error && Array.isArray(error.fields)) {
      for (const item of error.fields) {
        if (
          isRecord(item) &&
          typeof item.field === "string" &&
          typeof item.message === "string"
        )
          fields[item.field] = item.message;
      }
    }
    throw new SigningClientError(
      error && typeof error.message === "string"
        ? error.message
        : "Permintaan belum dapat diproses. Silakan coba kembali.",
      response.status,
      fields,
    );
  }
  if (!isRecord(result) || !isRecord(result.data))
    throw new SigningClientError(
      "Server belum memberikan konfirmasi yang dapat ditampilkan.",
      response.status,
    );
  return result.data;
}

export function signingFileHref(
  documentId: string,
  versionId: string,
  download = false,
) {
  const query = new URLSearchParams({ versionId });
  if (download) query.set("download", "1");
  return `/api/v2/signing-documents/${encodeURIComponent(documentId)}/file?${query}`;
}

export function requestReceipt(value: Record<string, unknown>) {
  return (
    isUuid(value.requestId) &&
    isUuid(value.documentId) &&
    isUuid(value.sourceVersionId) &&
    [
      "pending",
      "cancelled",
      "rejected",
      "consented",
      "completed",
      "expired",
    ].includes(String(value.status)) &&
    typeof value.sentAt === "string" &&
    Number.isFinite(Date.parse(value.sentAt)) &&
    typeof value.expiresAt === "string" &&
    Number.isFinite(Date.parse(value.expiresAt))
  );
}
