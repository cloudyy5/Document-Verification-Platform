import { createHash } from "node:crypto";
import { PDFDocument, PDFName, PDFString, degrees } from "pdf-lib";
import { describe, it, expect, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { inspectSigningPlacement } from "@/server/signing/layout";
import {
  qrPositionsSchema,
  qrPlanSchema,
  positionFits,
  clampPosition,
} from "@/lib/signing/placement";
const hash = (value: Uint8Array) =>
  createHash("sha256").update(value).digest("hex");
describe("recipient QR positions and actual geometry worker", () => {
  it("requires exactly ordered page positions without injected geometry or authority", () => {
    expect(
      qrPositionsSchema.safeParse([{ page: 2, x: 0.1, y: 0.1 }]).success,
    ).toBe(false);
    expect(
      qrPositionsSchema.safeParse([
        { page: 1, x: 0.1, y: 0.1, owner_id: "fake" },
      ]).success,
    ).toBe(false);
    expect(
      qrPositionsSchema.safeParse([{ page: 1, x: Infinity, y: 0 }]).success,
    ).toBe(false);
  });
  it("clamps keyboard/touch movement to page bounds and rejects an overflowing stored plan", () => {
    const page = {
      page: 1,
      widthPt: 600,
      heightPt: 800,
      rotation: 0 as const,
      userUnit: 1,
    };
    expect(clampPosition(page, -4, 9)).toEqual({
      page: 1,
      x: 0,
      y: 1 - 90 / 800,
    });
    expect(positionFits(page, { x: 0.9, y: 0.1 })).toBe(false);
    expect(qrPlanSchema.safeParse([{ ...page, x: 0.9, y: 0.1 }]).success).toBe(
      false,
    );
  });
  it("binds each page's actual crop/rotation and position before approval", async () => {
    const pdf = await PDFDocument.create();
    for (const angle of [0, 90, 180, 270]) {
      const page = pdf.addPage([400, 600]);
      page.setCropBox(12, 20, 360, 540);
      page.setRotation(degrees(angle));
    }
    const bytes = await pdf.save(),
      plan = await inspectSigningPlacement(
        bytes,
        hash(bytes),
        [0, 1, 2, 3].map((index) => ({ page: index + 1, x: 0.1, y: 0.2 })),
      );
    expect(
      plan.map((item) => [item.widthPt, item.heightPt, item.rotation]),
    ).toEqual([
      [360, 540, 0],
      [540, 360, 90],
      [360, 540, 180],
      [540, 360, 270],
    ]);
  }, 30000);
  it("rejects missing pages and positions outside the PDF instead of silently relocating them", async () => {
    const pdf = await PDFDocument.create();
    pdf.addPage([400, 600]);
    const bytes = await pdf.save();
    await expect(
      inspectSigningPlacement(bytes, hash(bytes), []),
    ).rejects.toMatchObject({ code: "INVALID_QR_PLACEMENT" });
    await expect(
      inspectSigningPlacement(bytes, hash(bytes), [
        { page: 1, x: 0.9, y: 0.2 },
      ]),
    ).rejects.toMatchObject({ code: "INVALID_QR_PLACEMENT" });
  }, 30000);
  it("uses the visible intersection with MediaBox and the viewer fallback for disjoint CropBox", async () => {
    const pdf = await PDFDocument.create();
    pdf.addPage([400, 600]).setCropBox(-20, 40, 360, 600);
    pdf.addPage([400, 600]).setCropBox(500, 700, 400, 600);
    const bytes = await pdf.save();
    const plan = await inspectSigningPlacement(bytes, hash(bytes), [
      { page: 1, x: 0.1, y: 0.1 },
      { page: 2, x: 0.1, y: 0.1 },
    ]);
    expect(plan.map((item) => [item.widthPt, item.heightPt])).toEqual([
      [340, 560],
      [400, 600],
    ]);
  }, 30000);
  it("rejects a position covered by an annotation but accepts another blank location", async () => {
    const pdf = await PDFDocument.create(),
      page = pdf.addPage([400, 600]);
    const ref = pdf.context.register(
      pdf.context.obj({
        Type: "Annot",
        Subtype: "Text",
        Rect: [0, 480, 120, 600],
        Contents: PDFString.of("Synthetic note"),
      }),
    );
    page.node.set(PDFName.of("Annots"), pdf.context.obj([ref]));
    const bytes = await pdf.save();
    await expect(
      inspectSigningPlacement(bytes, hash(bytes), [
        { page: 1, x: 0.05, y: 0.05 },
      ]),
    ).rejects.toMatchObject({
      code: "INVALID_QR_PLACEMENT",
      message: expect.stringContaining("halaman 1"),
    });
    expect(
      await inspectSigningPlacement(bytes, hash(bytes), [
        { page: 1, x: 0.5, y: 0.5 },
      ]),
    ).toHaveLength(1);
  }, 30000);
  it("rejects source/hash mismatch before producing a layout", async () => {
    const pdf = await PDFDocument.create();
    pdf.addPage();
    const bytes = await pdf.save();
    await expect(
      inspectSigningPlacement(bytes, "f".repeat(64), [
        { page: 1, x: 0.1, y: 0.1 },
      ]),
    ).rejects.toMatchObject({ code: "INVALID_QR_PLACEMENT" });
  }, 30000);
});
