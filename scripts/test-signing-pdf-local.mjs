// Synthetic local renderer/decoder probe. No environment file or cloud client.
import { createServer } from "node:http";
import { Worker } from "node:worker_threads";
import { resolve } from "node:path";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { PDFDocument, degrees } from "pdf-lib";
import { chromium } from "@playwright/test";
import { PNG } from "pngjs";
import jsQR from "jsqr";

let server, browser;
try {
  const input = await PDFDocument.create();
  for (const angle of [0, 90, 180, 270]) {
    const page = input.addPage([400, 600]);
    page.setCropBox(12, 20, 360, 540);
    page.setRotation(degrees(angle));
    page.drawText(`UJI DEVELOPMENT - SOURCE ${angle}`, {
      x: 35,
      y: 300,
      size: 13,
    });
  }
  const fixtureMode = process.argv.includes("--fixture");
  const bytes = fixtureMode
      ? new Uint8Array(
          await readFile(resolve("tests/fixtures/phase-3-development.pdf")),
        )
      : await input.save(),
    id = "R".repeat(43),
    url = `http://127.0.0.1:3000/receipts/${id}`;
  if (
    fixtureMode &&
    (bytes.length !== 2831 ||
      createHash("sha256").update(bytes).digest("hex") !==
        "6cc3a629004962b6b8df8755a1ca56c5e41cdee0dc991ea3af44617a79e8c0cc")
  )
    throw new Error("Reviewed synthetic source fixture changed");
  const expectedPages = fixtureMode ? 2 : 5;
  const outputDirectory = resolve(
    fixtureMode
      ? "test-results/r3-pdf-fixture-local"
      : "test-results/r3-pdf-local",
  );
  const evidence = {
    id,
    sourceSha256: createHash("sha256").update(bytes).digest("hex"),
    signerName: "Uji Development",
    signerCode: `DVP-${"A".repeat(20)}`,
    documentTitle: "UJI DEVELOPMENT - QR pada semua halaman",
    decidedAt: "2026-11-10T02:00:00.000Z",
  };
  const result = await new Promise((resolveResult, reject) => {
    const worker = new Worker(resolve("src/server/signing/render-worker.mjs"), {
      workerData: { bytes, evidence, url },
      env: {},
      execArgv: [],
      resourceLimits: { maxOldGenerationSizeMb: 256 },
      stdout: true,
      stderr: true,
    });
    worker.stdout.resume();
    worker.stderr.resume();
    const timer = setTimeout(() => {
      void worker.terminate();
      reject(new Error("Local render timeout"));
    }, 20000);
    worker.once("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    worker.once("message", (message) => {
      clearTimeout(timer);
      void worker.terminate();
      if (message.ok) resolveResult(message);
      else reject(new Error("Local render rejected fixture"));
    });
  });
  await mkdir(outputDirectory, { recursive: true });
  await writeFile(
    resolve(outputDirectory, "synthetic-result.pdf"),
    result.bytes,
  );
  server = createServer((request, response) => {
    if (new URL(request.url, "http://localhost").pathname !== "/r3.pdf") {
      response.writeHead(404);
      response.end();
      return;
    }
    response.writeHead(200, {
      "Content-Type": "application/pdf",
      "Content-Length": result.bytes.length,
      "Cache-Control": "private, no-store",
      "X-Frame-Options": "SAMEORIGIN",
      "Content-Security-Policy":
        "default-src 'none'; frame-ancestors 'self'; sandbox",
    });
    response.end(result.bytes);
  });
  await new Promise((resolveListen, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolveListen);
  });
  const address = server.address();
  if (typeof address !== "object" || !address)
    throw new Error("Local PDF listener unavailable");
  const env = {};
  for (const [name, value] of Object.entries(process.env))
    if (value && !/secret|password|token|cookie|key|database|^DVP_/i.test(name))
      env[name] = value;
  browser = await chromium.launch({ channel: "chromium", headless: true, env });
  const context = await browser.newContext({
    viewport: { width: 1200, height: 1050 },
    deviceScaleFactor: 2,
  });
  const checked = [];
  for (let number = 1; number <= expectedPages; number++) {
    const page = await context.newPage();
    await page.goto(
      `http://127.0.0.1:${address.port}/r3.pdf#page=${number}&zoom=75`,
    );
    let decoded = false;
    for (let attempt = 0; attempt < 20; attempt++) {
      const screenshot = await page.screenshot();
      const png = PNG.sync.read(screenshot);
      // Exclude sidebar thumbnails. The last-page view also contains the prior
      // page's footer above it, so read the proof-page QR in the lower half.
      const left = Math.floor(png.width * 0.27),
        top = number === expectedPages ? Math.floor(png.height / 2) : 0;
      const width = png.width - left,
        height = png.height - top,
        pixels = new Uint8ClampedArray(width * height * 4);
      for (let row = 0; row < height; row++)
        pixels.set(
          png.data.subarray(
            ((row + top) * png.width + left) * 4,
            ((row + top) * png.width + png.width) * 4,
          ),
          row * width * 4,
        );
      const scan = jsQR(pixels, width, height, {
        inversionAttempts: "dontInvert",
      });
      if (scan?.data === url) {
        await writeFile(
          resolve(outputDirectory, `page-${number}.png`),
          screenshot,
        );
        decoded = true;
        break;
      }
      await new Promise((resolveWait) => setTimeout(resolveWait, 250));
    }
    if (!decoded) {
      await page.screenshot({
        path: resolve(outputDirectory, `failed-page-${number}.png`),
      });
      throw new Error(`Independent QR decoding failed on PDF page ${number}`);
    }
    checked.push(number);
    await page.close();
  }
  console.log(
    JSON.stringify({
      originalRotations: fixtureMode ? [0] : [0, 90, 180, 270],
      resultPages: result.pageCount,
      independentlyDecodedPages: checked,
      allReceiptLinksEqual: true,
      cloudRequests: 0,
    }),
  );
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await browser?.close();
  if (server) await new Promise((resolveClose) => server.close(resolveClose));
}
