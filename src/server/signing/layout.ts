import "server-only";
import { Worker } from "node:worker_threads";
import { resolve } from "node:path";
import {
  qrPlanSchema,
  selectedQrManifestSchema,
  type SelectedQrManifest,
  type QrPlan,
  type QrPosition,
} from "@/lib/signing/placement";
import { ApiError } from "@/server/errors";
export async function inspectSigningPlacement(
  bytes: Uint8Array,
  sha256: string,
  positions: QrPosition[],
): Promise<QrPlan> {
  return (await inspectPlacement(bytes, sha256, positions, false)).placements;
}
export async function inspectSelectedSigningPlacement(
  bytes: Uint8Array,
  sha256: string,
  positions: QrPosition[],
): Promise<SelectedQrManifest> {
  return inspectPlacement(bytes, sha256, positions, true);
}
async function inspectPlacement(
  bytes: Uint8Array,
  sha256: string,
  positions: QrPosition[],
  selectedPages: boolean,
): Promise<SelectedQrManifest> {
  return new Promise((done, reject) => {
    const worker = new Worker(
      resolve(process.cwd(), "src/server/signing/layout-worker.mjs"),
      {
        workerData: { bytes, sha256, positions, selectedPages },
        env: {},
        execArgv: [],
        stdout: true,
        stderr: true,
        resourceLimits: {
          maxOldGenerationSizeMb: 256,
          maxYoungGenerationSizeMb: 32,
          stackSizeMb: 4,
        },
      },
    );
    worker.stdout.resume();
    worker.stderr.resume();
    let settled = false;
    const finish = (message?: {
      ok: boolean;
      plan?: unknown;
      sourcePageCount?: unknown;
      code?: string;
      page?: number;
    }) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      void worker.terminate();
      const manifest = selectedQrManifestSchema.safeParse({
        sourcePageCount: message?.sourcePageCount,
        placements: message?.plan,
      });
      if (
        message?.ok &&
        manifest.success &&
        (selectedPages ||
          qrPlanSchema.safeParse(manifest.data.placements).success)
      )
        done(manifest.data);
      else
        reject(
          new ApiError(
            422,
            "INVALID_QR_PLACEMENT",
            message?.code === "LAYOUT_ANNOTATION_OVERLAP"
              ? `Posisi QR pada halaman ${message.page ?? "yang dipilih"} bertumpuk dengan anotasi PDF. Pilih area kosong lain.`
              : "Letakkan minimal satu QR pada halaman yang tersedia. Periksa kembali posisi QR di dalam halaman pilihan Anda.",
          ),
        );
    };
    const timer = setTimeout(() => finish(), 20000);
    worker.once("message", finish);
    worker.once("error", () => finish());
    worker.once("exit", () => finish());
  });
}
