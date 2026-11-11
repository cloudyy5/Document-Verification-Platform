import { readFile, mkdir, copyFile, cp } from "node:fs/promises";
import { resolve } from "node:path";
const pkg = JSON.parse(
  await readFile(resolve("node_modules/pdfjs-dist/package.json"), "utf8"),
);
if (!/^\d+\.\d+\.\d+$/.test(pkg.version))
  throw new Error("Invalid PDF.js asset version");
const target = resolve("public/pdfjs", pkg.version);
await mkdir(target, { recursive: true });
await copyFile(
  resolve("node_modules/pdfjs-dist/LICENSE"),
  resolve(target, "LICENSE"),
);
await copyFile(
  resolve("node_modules/pdfjs-dist/build/pdf.worker.min.mjs"),
  resolve(target, "pdf.worker.min.mjs"),
);
for (const name of ["cmaps", "standard_fonts", "wasm", "iccs"])
  await cp(resolve("node_modules/pdfjs-dist", name), resolve(target, name), {
    recursive: true,
  });
console.log(`Prepared same-origin PDF.js ${pkg.version} worker/font assets.`);
