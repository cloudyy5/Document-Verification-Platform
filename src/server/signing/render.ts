import "server-only";
import { Worker } from "node:worker_threads";
import { resolve } from "node:path";
import { signingReceiptUrl } from "@/lib/signing/receipt-link";
import { getAppOrigin } from "@/lib/auth/config";
import { ApiError } from "@/server/errors";
import type { SigningEvidence } from "./evidence";

export async function renderSigningPdf(
  bytes: Uint8Array,
  evidence: SigningEvidence,
): Promise<{ bytes: Uint8Array; pageCount: number }> {
  const url = signingReceiptUrl(getAppOrigin(), evidence.id);
  return new Promise((resolveResult, reject) => {
    let settled = false;
    const worker = new Worker(
      resolve(process.cwd(), "src/server/signing/render-worker.mjs"),
      {
        workerData: { bytes, evidence, url },
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
    const finish = (result?: {
      ok: boolean;
      bytes?: Uint8Array;
      pageCount?: number;
      code?: string;
    }) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      void worker.terminate();
      if (
        result?.ok &&
        result.bytes instanceof Uint8Array &&
        result.bytes.length <= 20 * 1024 * 1024 &&
        Number.isInteger(result.pageCount) &&
        result.pageCount! >= 1
      )
        resolveResult({ bytes: result.bytes, pageCount: result.pageCount! });
      else
        reject(
          new ApiError(
            503,
            result?.code === "RENDER_LIMIT" ? "RENDER_LIMIT" : "RENDER_FAILED",
            "PDF hasil belum dapat disiapkan. Persetujuan tetap tercatat.",
          ),
        );
    };
    const timer = setTimeout(
      () => finish({ ok: false, code: "RENDER_LIMIT" }),
      20_000,
    );
    worker.once("message", finish);
    worker.once("error", () => finish());
    worker.once("exit", () => finish());
  });
}
