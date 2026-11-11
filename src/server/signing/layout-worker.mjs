import { parentPort, workerData } from "node:worker_threads";
import { createHash } from "node:crypto";
import { PDFDocument } from "pdf-lib";
import { inspectPages, placementPlan } from "./pdf-layout.mjs";
try {
  const { bytes, sha256, positions } = workerData;
  if (
    !(bytes instanceof Uint8Array) ||
    bytes.length > 10485760 ||
    createHash("sha256").update(bytes).digest("hex") !== sha256
  )
    throw new Error("LAYOUT_SOURCE_MISMATCH");
  const pdf = await PDFDocument.load(bytes, {
    ignoreEncryption: false,
    throwOnInvalidObject: true,
    updateMetadata: false,
  });
  parentPort.postMessage({
    ok: true,
    plan: placementPlan(inspectPages(pdf), positions),
  });
} catch (error) {
  parentPort.postMessage({
    ok: false,
    page:
      Number.isInteger(error.page) && error.page >= 1 && error.page <= 2000
        ? error.page
        : undefined,
    code: /^LAYOUT_[A-Z_]+$/.test(error.message)
      ? error.message
      : "LAYOUT_UNSUPPORTED",
  });
}
