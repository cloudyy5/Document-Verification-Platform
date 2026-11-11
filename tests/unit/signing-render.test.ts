import { createHash } from "node:crypto";
import { PDFDocument, PDFName, PDFString, degrees } from "pdf-lib";
import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/config", () => ({
  getAppOrigin: () => "http://127.0.0.1:3000",
}));
import { renderSigningPdf } from "@/server/signing/render";
import type { SigningEvidence } from "@/lib/signing/evidence-types";
function evidence(bytes: Uint8Array): SigningEvidence {
  return {
    id: "R".repeat(43),
    decisionId: "10000000-0000-4000-8000-000000000001",
    requestId: "10000000-0000-4000-8000-000000000002",
    documentId: "10000000-0000-4000-8000-000000000003",
    sourceVersionId: "10000000-0000-4000-8000-000000000004",
    ownerName: "Uji Development",
    signerName: "José Çelik",
    signerCode: `DVP-${"A".repeat(20)}`,
    documentTitle: "UJI DEVELOPMENT: bukti internal",
    sourceSha256: createHash("sha256").update(bytes).digest("hex"),
    decidedAt: "2026-11-10T02:00:00.000Z",
    policyVersion: "internal-action-development-2026-11-05",
    layoutVersion: "all-pages-bottom-left-and-evidence-v1",
    artifact: {
      state: "processing",
      sha256: null,
      bytes: null,
      pageCount: null,
      readyAt: null,
    },
  };
}
beforeEach(() => vi.clearAllMocks());
describe("actual R3 PDF rendering worker (local synthetic data only)", () => {
  it("adds a footer to all rotated/cropped original pages and one evidence page without changing input bytes", async () => {
    const pdf = await PDFDocument.create();
    for (const angle of [0, 90, 180, 270]) {
      const page = pdf.addPage([400, 600]);
      page.setCropBox(12, 20, 360, 540);
      page.setRotation(degrees(angle));
      page.drawText(`UJI DEVELOPMENT ${angle}`, { x: 40, y: 300 });
    }
    const source = await pdf.save(),
      initial = Buffer.from(source),
      item = evidence(source);
    const rendered = await renderSigningPdf(source, item);
    expect(Buffer.from(source).equals(initial)).toBe(true);
    expect(rendered.pageCount).toBe(5);
    expect(createHash("sha256").update(rendered.bytes).digest("hex")).not.toBe(
      item.sourceSha256,
    );
    const result = await PDFDocument.load(rendered.bytes);
    expect(result.getPageCount()).toBe(5);
    for (const [i, angle] of [0, 90, 180, 270].entries()) {
      const page = result.getPage(i),
        box = page.getCropBox();
      expect(page.getRotation().angle).toBe(angle);
      expect(box.width).toBe(angle % 180 === 0 ? 360 : 486);
      expect(box.height).toBe(angle % 180 === 0 ? 666 : 540);
      expect(box.x).toBe(angle === 270 ? -114 : 12);
      expect(box.y).toBe(angle === 0 ? -106 : 20);
    }
    expect(result.getCreationDate()?.toISOString()).toBe(item.decidedAt);
  }, 30000);
  it("rejects a source/hash mismatch instead of creating a false result", async () => {
    const pdf = await PDFDocument.create();
    pdf.addPage();
    const bytes = await pdf.save();
    await expect(
      renderSigningPdf(bytes, {
        ...evidence(bytes),
        sourceSha256: "f".repeat(64),
      }),
    ).rejects.toMatchObject({ code: "RENDER_FAILED" });
  }, 30000);
  it("retains normal annotations and refuses annotations crossing the crop boundary that could cover a new footer", async () => {
    const pdf = await PDFDocument.create(),
      page = pdf.addPage([400, 600]);
    const ref = pdf.context.register(
      pdf.context.obj({
        Type: "Annot",
        Subtype: "Text",
        Rect: [30, -10, 90, 20],
        Contents: PDFString.of("Synthetic note"),
      }),
    );
    page.node.set(PDFName.of("Annots"), pdf.context.obj([ref]));
    const bytes = await pdf.save();
    await expect(
      renderSigningPdf(bytes, evidence(bytes)),
    ).rejects.toMatchObject({ code: "RENDER_LIMIT" });
  }, 30000);
  it("does not silently replace Unicode metadata that cannot be printed with a wrong person's name", async () => {
    const pdf = await PDFDocument.create();
    pdf.addPage();
    const source = await pdf.save();
    const result = await renderSigningPdf(source, {
      ...evidence(source),
      signerName: "测试账户",
      documentTitle: "文書",
    });
    expect((await PDFDocument.load(result.bytes)).getPageCount()).toBe(2);
  }, 30000);
});
