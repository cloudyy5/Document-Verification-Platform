import "server-only";
import { ApiError } from "@/server/errors";

export async function readLimitedFormData(
  request: Request,
  maxFileBytes: number,
  timeoutMs = 30000,
): Promise<FormData> {
  const maximum = maxFileBytes + 64 * 1024;
  if (!Number.isSafeInteger(maxFileBytes) || maxFileBytes <= 0)
    throw new ApiError(
      503,
      "UPLOAD_UNAVAILABLE",
      "Pengajuan belum dikonfigurasi.",
    );
  if (
    !/^multipart\/form-data\s*;/i.test(
      request.headers.get("content-type") ?? "",
    )
  )
    throw new ApiError(
      415,
      "UNSUPPORTED_MEDIA_TYPE",
      "Gunakan formulir upload PDF.",
    );
  const length = request.headers.get("content-length");
  if (
    length !== null &&
    (!/^\d+$/.test(length) || !Number.isSafeInteger(Number(length)))
  )
    throw new ApiError(
      400,
      "INVALID_REQUEST",
      "Ukuran permintaan tidak valid.",
    );
  if (length !== null && Number(length) > maximum)
    throw new ApiError(
      413,
      "FILE_TOO_LARGE",
      "File melampaui batas ukuran yang diperbolehkan.",
    );
  if (!request.body)
    throw new ApiError(
      400,
      "INVALID_REQUEST",
      "Formulir pengajuan tidak tersedia.",
    );
  const reader = request.body.getReader();
  let timedOut = false;
  const deadline = setTimeout(() => {
    timedOut = true;
    void reader.cancel().catch(() => {});
  }, timeoutMs);
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (timedOut)
        throw new ApiError(
          408,
          "UPLOAD_TIMEOUT",
          "Pengiriman file terlalu lama. Periksa koneksi dan coba kembali.",
        );
      if (done) break;
      total += value.byteLength;
      if (total > maximum) {
        await reader.cancel();
        throw new ApiError(
          413,
          "FILE_TOO_LARGE",
          "File melampaui batas ukuran yang diperbolehkan.",
        );
      }
      chunks.push(value);
    }
  } finally {
    clearTimeout(deadline);
    reader.releaseLock();
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return await new Request(request.url, {
      method: "POST",
      headers: { "Content-Type": request.headers.get("content-type")! },
      body: bytes,
    }).formData();
  } catch {
    throw new ApiError(
      400,
      "INVALID_REQUEST",
      "Formulir pengajuan tidak dapat dibaca.",
    );
  }
}
