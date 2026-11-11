// Actual PDF workers + independent raster decoding. No .env, network or cloud.
import assert from "node:assert/strict";
import { Worker } from "node:worker_threads";
import { createHash } from "node:crypto";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { PDFDocument, degrees, PDFName, PDFNumber } from "pdf-lib";
import { createCanvas } from "@napi-rs/canvas";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import jsQR from "jsqr";
async function worker(file, data) {
  return new Promise((done, reject) => {
    const instance = new Worker(resolve("src/server/signing", file), {
      workerData: data,
      env: {},
      execArgv: [],
      stdout: true,
      stderr: true,
      resourceLimits: { maxOldGenerationSizeMb: 256 },
    });
    instance.stdout.resume();
    instance.stderr.resume();
    const timer = setTimeout(() => {
      void instance.terminate();
      reject(new Error("Local PDF worker timeout"));
    }, 20000);
    instance.once("message", (value) => {
      clearTimeout(timer);
      void instance.terminate();
      if (value.ok) done(value);
      else reject(new Error("Local PDF worker rejected fixture"));
    });
    instance.once("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
}
const original = await PDFDocument.create();
for (const angle of [0, 90, 180, 270]) {
  const page = original.addPage([400, 600]);
  page.setCropBox(12, 20, 360, 540);
  page.setRotation(degrees(angle));
  if (angle === 270) page.node.set(PDFName.of("UserUnit"), PDFNumber.of(2));
  page.drawText(`UJI DEVELOPMENT - HALAMAN ${angle}`, {
    x: 40,
    y: 300,
    size: 12,
  });
}
const folder = resolve("test-results/movable-qr-pdf");
await mkdir(folder, { recursive: true });
const reports = [];
const clipped = await PDFDocument.create();
clipped.addPage([400, 600]).setCropBox(-20, 40, 360, 600);
for (const scenario of [
  "rotated-four-pages",
  "single-source-page",
  "clipped-crop-page",
]) {
  const bytes =
    scenario === "rotated-four-pages"
      ? await original.save()
      : scenario === "clipped-crop-page"
        ? await clipped.save()
        : new Uint8Array(
            await readFile(resolve("tests/fixtures/phase-3-development.pdf")),
          );
  const source = await PDFDocument.load(bytes),
    sha256 = createHash("sha256").update(bytes).digest("hex"),
    positions = source.getPages().map((_, index) => ({
      page: index + 1,
      x: [0.05, 0.65, 0.1, 0.65][index] ?? 0.1,
      y: [0.05, 0.1, 0.65, 0.65][index] ?? 0.1,
    }));
  const inspected = await worker("layout-worker.mjs", {
      bytes,
      sha256,
      positions,
    }),
    id = (scenario === "rotated-four-pages" ? "M" : "S").repeat(43),
    url = `http://127.0.0.1:3000/receipts/${id}`;
  const evidence = {
    id,
    sourceSha256: sha256,
    layoutVersion: "per-page-draggable-web-evidence-v2",
    placements: inspected.plan,
    decidedAt: "2026-11-10T08:00:00.000Z",
  };
  const rendered = await worker("render-worker.mjs", { bytes, evidence, url }),
    result = await PDFDocument.load(rendered.bytes);
  assert.equal(result.getPageCount(), source.getPageCount());
  assert.equal(rendered.pageCount, source.getPageCount());
  assert.equal(createHash("sha256").update(bytes).digest("hex"), sha256);
  const rasterTask = getDocument({
      data: new Uint8Array(rendered.bytes),
      standardFontDataUrl:
        resolve("node_modules/pdfjs-dist/standard_fonts") + "/",
      verbosity: 0,
    }),
    raster = await rasterTask.promise;
  const decoded = [];
  for (let index = 0; index < rendered.pageCount; index++) {
    assert.deepEqual(
      result.getPage(index).getCropBox(),
      source.getPage(index).getCropBox(),
    );
    assert.deepEqual(
      result.getPage(index).getMediaBox(),
      source.getPage(index).getMediaBox(),
    );
    assert.equal(
      result.getPage(index).getRotation().angle,
      source.getPage(index).getRotation().angle,
    );
    const page = await raster.getPage(index + 1),
      viewport = page.getViewport({ scale: 1.5 }),
      canvas = createCanvas(
        Math.ceil(viewport.width),
        Math.ceil(viewport.height),
      );
    await page.render({ canvas, viewport }).promise;
    const pixels = canvas
        .getContext("2d")
        .getImageData(0, 0, canvas.width, canvas.height),
      scan = jsQR(pixels.data, canvas.width, canvas.height, {
        inversionAttempts: "dontInvert",
      });
    assert.equal(scan?.data, url);
    // Use the four explicit outer corners, not finder-pattern location entries.
    const outer = [
        scan.location.topLeftCorner,
        scan.location.topRightCorner,
        scan.location.bottomLeftCorner,
        scan.location.bottomRightCorner,
      ],
      center = {
        x: outer.reduce((sum, item) => sum + item.x, 0) / 4,
        y: outer.reduce((sum, item) => sum + item.y, 0) / 4,
      };
    assert.ok(
      Math.abs(center.x - (inspected.plan[index].x * viewport.width + 67.5)) <
        3,
    );
    assert.ok(
      Math.abs(center.y - (inspected.plan[index].y * viewport.height + 67.5)) <
        3,
    );
    await writeFile(
      resolve(folder, `${scenario}-${index + 1}.png`),
      canvas.toBuffer("image/png"),
    );
    decoded.push(index + 1);
  }
  await rasterTask.destroy();
  await writeFile(resolve(folder, `${scenario}.pdf`), rendered.bytes);
  reports.push({
    scenario,
    sourcePages: source.getPageCount(),
    resultPages: rendered.pageCount,
    decodedPages: decoded,
    qrCentersMatchSelectedPositions: true,
    canvasUnchanged: true,
  });
}
const proof = { reports, cloudRequests: 0 };
await writeFile(
  resolve(folder, "report.json"),
  JSON.stringify(proof, null, 2) + "\n",
);
console.log(JSON.stringify(proof));
