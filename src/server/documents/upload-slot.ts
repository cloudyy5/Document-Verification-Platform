import "server-only";
import { ApiError } from "@/server/errors";

let activeUploads = 0;

/** One process-wide memory budget shared by legacy and signing uploads. */
export function acquireUploadSlot(): () => void {
  if (activeUploads >= 2)
    throw new ApiError(
      503,
      "UPLOAD_BUSY",
      "Layanan sedang memproses file lain. Coba kembali beberapa saat lagi.",
    );
  activeUploads++;
  let released = false;
  return () => {
    if (!released) {
      activeUploads--;
      released = true;
    }
  };
}
