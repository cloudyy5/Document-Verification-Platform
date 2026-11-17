// Real scanner smoke check only: two in-memory byte streams, no Supabase or PDF writes.
import { clamavScan } from "../src/server/documents/clamav-client.mjs";
const host = process.env.CLAMAV_HOST,
  port = Number(process.env.CLAMAV_PORT ?? 3310),
  timeoutMs = Number(process.env.CLAMAV_TIMEOUT_MS ?? 30000);
if (
  !host ||
  !Number.isInteger(port) ||
  port < 1 ||
  port > 65535 ||
  !Number.isInteger(timeoutMs) ||
  timeoutMs < 100 ||
  timeoutMs > 60000
) {
  console.error("PERIKSA | Konfigurasi ClamAV belum valid.");
  process.exitCode = 1;
} else
  try {
    const options = { host, port, timeoutMs };
    if (
      (await clamavScan(
        Buffer.from("Document Verification Platform scanner connectivity test"),
        options,
      )) !== "clean"
    )
      throw new Error("CLEAN_CHECK");
    // Standard harmless EICAR test string, assembled in memory only.
    const eicar = Buffer.from(
      [
        "X5O!P%@AP[4",
        "\\PZX54(P^)7CC)7}$",
        "EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*",
      ].join(""),
    );
    if ((await clamavScan(eicar, options)) !== "infected")
      throw new Error("DETECTION_CHECK");
    console.log(
      "LULUS | ClamAV menerima stream bersih dan menolak pola uji EICAR; tidak ada file/record disimpan.",
    );
  } catch {
    console.error(
      "PERIKSA | ClamAV belum siap atau pemeriksaan deteksi belum lulus. Upload publik tetap dibatasi.",
    );
    process.exitCode = 1;
  }
