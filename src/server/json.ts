import "server-only";
import { ApiError } from "./errors";

/** Bound bytes and elapsed time before parsing authenticated mutation bodies. */
export async function readSmallJson(
  request: Request,
  maxBytes = 4096,
  timeoutMs = 15_000,
): Promise<unknown> {
  if (
    !request.headers
      .get("content-type")
      ?.toLowerCase()
      .split(";", 1)[0]
      .trim()
      .match(/^application\/json$/)
  )
    throw new ApiError(415, "UNSUPPORTED_MEDIA_TYPE", "Gunakan data JSON.");
  const declared = request.headers.get("content-length");
  if (declared && (!/^\d+$/.test(declared) || Number(declared) > maxBytes))
    throw new ApiError(
      413,
      "REQUEST_TOO_LARGE",
      "Data permintaan melebihi batas.",
    );
  const reader = request.body?.getReader();
  if (!reader)
    throw new ApiError(
      400,
      "INVALID_REQUEST",
      "Data permintaan tidak tersedia.",
    );
  const decoder = new TextDecoder("utf-8", { fatal: true });
  const deadline = Date.now() + timeoutMs;
  let text = "";
  let size = 0;
  try {
    while (true) {
      const remaining = deadline - Date.now();
      if (remaining <= 0)
        throw new ApiError(
          408,
          "REQUEST_TIMEOUT",
          "Pembacaan permintaan melewati batas waktu.",
        );
      let timer: ReturnType<typeof setTimeout> | undefined;
      const pending = new Promise<never>((_, reject) => {
        timer = setTimeout(
          () =>
            reject(
              new ApiError(
                408,
                "REQUEST_TIMEOUT",
                "Pembacaan permintaan melewati batas waktu.",
              ),
            ),
          remaining,
        );
      });
      try {
        const { done, value } = await Promise.race([reader.read(), pending]);
        if (done) break;
        size += value.byteLength;
        if (size > maxBytes)
          throw new ApiError(
            413,
            "REQUEST_TOO_LARGE",
            "Data permintaan melebihi batas.",
          );
        text += decoder.decode(value, { stream: true });
      } finally {
        clearTimeout(timer);
      }
    }
    text += decoder.decode();
    try {
      return JSON.parse(text) as unknown;
    } catch {
      throw new ApiError(400, "INVALID_REQUEST", "Data JSON tidak valid.");
    }
  } catch (error) {
    void reader.cancel().catch(() => {});
    if (error instanceof ApiError) throw error;
    throw new ApiError(
      400,
      "INVALID_REQUEST",
      "Data permintaan tidak dapat dibaca.",
    );
  } finally {
    reader.releaseLock();
  }
}
