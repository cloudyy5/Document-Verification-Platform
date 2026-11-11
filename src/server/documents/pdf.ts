import "server-only";
import { createHash } from "node:crypto";
import { Worker } from "node:worker_threads";
import { resolve } from "node:path";
import { ApiError } from "@/server/errors";

type PdfInspection = { ok: boolean; pageCount?: number; code?: string };

export async function validatePdf(
  file: File,
  maxBytes: number,
): Promise<{ bytes: Uint8Array; sha256: string; pageCount: number }> {
  if (!(file instanceof File) || !file.size)
    throw new ApiError(
      422,
      "INVALID_FILE",
      "Pilih file PDF yang tidak kosong.",
      [{ field: "file", message: "File PDF wajib dipilih." }],
    );
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1 || file.size > maxBytes)
    throw new ApiError(
      413,
      "FILE_TOO_LARGE",
      "Ukuran PDF melampaui batas pengajuan.",
    );
  if (
    file.type !== "application/pdf" ||
    !/\.pdf$/i.test(file.name) ||
    file.name.length > 255 ||
    [...file.name].some((c) => c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127)
  )
    throw new ApiError(
      415,
      "UNSUPPORTED_FILE_TYPE",
      "Gunakan file PDF dengan nama dan format yang valid.",
    );
  const bytes = new Uint8Array(await file.arrayBuffer());
  const header = Buffer.from(bytes.subarray(0, 16)).toString("latin1");
  let eofEnd = bytes.length;
  while (eofEnd > 0 && [0, 9, 10, 12, 13, 32].includes(bytes[eofEnd - 1]!))
    eofEnd--;
  const footer = Buffer.from(
    bytes.subarray(Math.max(0, eofEnd - 5), eofEnd),
  ).toString("latin1");
  if (!/^%PDF-(?:1\.[0-7]|2\.0)\s/.test(header) || footer !== "%%EOF")
    throw new ApiError(
      422,
      "INVALID_PDF",
      "Struktur file PDF tidak valid atau tidak lengkap.",
    );
  const result = await new Promise<PdfInspection>((resolveResult) => {
    let settled = false;
    const worker = new Worker(
      resolve(process.cwd(), "src/server/documents/pdf-worker.mjs"),
      {
        // Bundlers can spread workerData to forward runtime globals. Nest the
        // typed array so that spread preserves its bytes and type.
        workerData: { bytes },
        env: {},
        // Do not inherit --env-file or application preload/startup flags.
        execArgv: [],
        stdout: true,
        stderr: true,
        resourceLimits: {
          maxOldGenerationSizeMb: 128,
          maxYoungGenerationSizeMb: 16,
          stackSizeMb: 4,
        },
      },
    );
    worker.stdout.resume();
    worker.stderr.resume();
    const finish = (result: PdfInspection) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      void worker.terminate();
      resolveResult(result);
    };
    const timer = setTimeout(
      () => finish({ ok: false, code: "PDF_PROCESSING_LIMIT" }),
      10000,
    );
    worker.once("message", (message: PdfInspection) => finish(message));
    worker.once("error", () =>
      finish({ ok: false, code: "PDF_PROCESSING_LIMIT" }),
    );
    worker.once("exit", () => {
      if (!settled) finish({ ok: false, code: "INVALID_PDF" });
    });
  });
  if (
    !result.ok ||
    !Number.isSafeInteger(result.pageCount) ||
    result.pageCount! < 1
  ) {
    const code = [
      "ENCRYPTED_PDF",
      "ACTIVE_PDF",
      "PDF_PROCESSING_LIMIT",
    ].includes(result.code ?? "")
      ? result.code!
      : "INVALID_PDF";
    const message =
      code === "ENCRYPTED_PDF"
        ? "PDF terenkripsi atau dilindungi password tidak dapat diajukan. Unggah PDF tanpa enkripsi."
        : code === "ACTIVE_PDF"
          ? "PDF mengandung aksi otomatis atau konten tertanam. Unggah salinan PDF statis."
          : code === "PDF_PROCESSING_LIMIT"
            ? "PDF belum dapat diproses dalam batas sumber daya. Sederhanakan file dan coba kembali."
            : "Struktur PDF tidak dapat diproses. Unggah PDF yang valid.";
    throw new ApiError(422, code, message, [{ field: "file", message }]);
  }
  return {
    bytes,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    pageCount: result.pageCount!,
  };
}
