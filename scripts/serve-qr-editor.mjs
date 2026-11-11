// Isolated component test host. No environment file, Auth client or cloud I/O.
import { createServer } from "vite";
import { PDFDocument, degrees, PDFName, PDFNumber } from "pdf-lib";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
const pdf = await PDFDocument.create();
for (const angle of [0, 90, 180, 270]) {
  const page = pdf.addPage([400, 600]);
  page.setCropBox(12, 20, 360, 540);
  if (angle === 180) page.setCropBox(-20, 40, 360, 600);
  page.setRotation(degrees(angle));
  if (angle === 270) page.node.set(PDFName.of("UserUnit"), PDFNumber.of(2));
  page.drawText(`UJI LOKAL - HALAMAN ${angle}`, { x: 40, y: 300, size: 12 });
}
const bytes = await pdf.save(),
  sha256 = createHash("sha256").update(bytes).digest("hex");
const filePath =
  "/api/v2/signing-documents/71000000-0000-4000-8000-000000000001/file";
const server = await createServer({
  configFile: false,
  root: resolve("tests/ui/qr-editor"),
  publicDir: resolve("public"),
  resolve: { alias: { "@": resolve("src") } },
  server: {
    host: "127.0.0.1",
    port: 3201,
    strictPort: true,
    fs: { allow: [process.cwd()] },
  },
  plugins: [
    {
      name: "synthetic-private-file-test",
      configureServer(host) {
        host.middlewares.use((request, response, next) => {
          const path = new URL(request.url, "http://localhost").pathname;
          if (path === filePath) {
            response.writeHead(200, {
              "Content-Type": "application/pdf",
              "Content-Length": bytes.length,
              "Cache-Control": "private, no-store",
            });
            response.end(bytes);
          } else if (path === "/fixture.json") {
            response.setHeader("Content-Type", "application/json");
            response.end(
              JSON.stringify({
                sourceUrl:
                  filePath + "?versionId=72000000-0000-4000-8000-000000000001",
                sha256,
              }),
            );
          } else next();
        });
      },
    },
  ],
});
await server.listen();
console.log(
  "Synthetic QR editor ready on loopback port 3201; zero cloud integration.",
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.once(signal, () => {
    void server.close().then(() => process.exit(0));
  });
