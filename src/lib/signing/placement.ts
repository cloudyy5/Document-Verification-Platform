import { z } from "zod";

export const QR_PLACEMENT_VERSION =
  "per-page-draggable-web-evidence-v2" as const;
export const LEGACY_SIGNING_LAYOUT =
  "all-pages-bottom-left-and-evidence-v1" as const;
export const QR_SIDE_PT = 90;
export const MAX_SIGNING_PAGES = 2000;
export const qrPositionSchema = z.strictObject({
  page: z.number().int().min(1).max(MAX_SIGNING_PAGES),
  x: z.number().finite().min(0).max(1),
  y: z.number().finite().min(0).max(1),
});
export const qrPositionsSchema = z
  .array(qrPositionSchema)
  .min(1)
  .max(MAX_SIGNING_PAGES)
  .refine(
    (items) => items.every((item, index) => item.page === index + 1),
    "Atur satu posisi QR pada setiap halaman secara berurutan.",
  );
export type QrPosition = z.infer<typeof qrPositionSchema>;
export const qrPageSchema = z.object({
  page: z.number().int().min(1).max(MAX_SIGNING_PAGES),
  widthPt: z.number().finite().min(QR_SIDE_PT).max(14400),
  heightPt: z.number().finite().min(QR_SIDE_PT).max(14400),
  rotation: z.union([
    z.literal(0),
    z.literal(90),
    z.literal(180),
    z.literal(270),
  ]),
  userUnit: z.number().finite().min(0.01).max(100),
});
export const qrPlanSchema = z
  .array(qrPageSchema.extend(qrPositionSchema.shape))
  .min(1)
  .max(MAX_SIGNING_PAGES)
  .refine(
    (items) =>
      items.every(
        (item, index) => item.page === index + 1 && positionFits(item, item),
      ),
    "Posisi QR harus berada di dalam setiap halaman.",
  );
export type QrPage = z.infer<typeof qrPageSchema>;
export type QrPlan = z.infer<typeof qrPlanSchema>;
export function positionFits(
  page: Pick<QrPage, "widthPt" | "heightPt">,
  position: Pick<QrPosition, "x" | "y">,
) {
  return (
    Number.isFinite(position.x) &&
    Number.isFinite(position.y) &&
    position.x >= 0 &&
    position.y >= 0 &&
    position.x + QR_SIDE_PT / page.widthPt <= 1 + 1e-9 &&
    position.y + QR_SIDE_PT / page.heightPt <= 1 + 1e-9
  );
}
export function clampPosition(page: QrPage, x: number, y: number): QrPosition {
  return {
    page: page.page,
    x: Math.max(0, Math.min(1 - QR_SIDE_PT / page.widthPt, x)),
    y: Math.max(0, Math.min(1 - QR_SIDE_PT / page.heightPt, y)),
  };
}
