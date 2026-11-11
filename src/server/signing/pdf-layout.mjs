import { PDFName, PDFNumber, PDFArray } from "pdf-lib";
const round = (value) => Math.round(value * 1e6) / 1e6;
// PDF.js displays the CropBox/MediaBox intersection, or MediaBox when that
// intersection is empty. Use the same visible area for inspection and drawing.
export function visiblePageBox(page) {
  const crop = page.getCropBox(),
    media = page.getMediaBox();
  for (const box of [crop, media])
    if (
      !Object.values(box).every(Number.isFinite) ||
      box.width <= 0 ||
      box.height <= 0
    )
      throw new Error("LAYOUT_UNSUPPORTED");
  const x = Math.max(crop.x, media.x),
    y = Math.max(crop.y, media.y),
    right = Math.min(crop.x + crop.width, media.x + media.width),
    top = Math.min(crop.y + crop.height, media.y + media.height);
  return right > x && top > y
    ? { x, y, width: right - x, height: top - y }
    : media;
}
export function inspectPages(pdf) {
  const pages = pdf.getPages();
  if (!pages.length || pages.length > 2000)
    throw new Error("LAYOUT_UNSUPPORTED");
  return pages.map((page, index) => {
    const crop = visiblePageBox(page),
      rotation = ((page.getRotation().angle % 360) + 360) % 360;
    const userUnit =
      page.node.lookupMaybe(PDFName.of("UserUnit"), PDFNumber)?.asNumber() ?? 1;
    const widthPt = round(
        (rotation % 180 === 0 ? crop.width : crop.height) * userUnit,
      ),
      heightPt = round(
        (rotation % 180 === 0 ? crop.height : crop.width) * userUnit,
      );
    if (
      ![0, 90, 180, 270].includes(rotation) ||
      !Object.values(crop).every(Number.isFinite) ||
      !Number.isFinite(userUnit) ||
      userUnit < 0.01 ||
      userUnit > 100 ||
      widthPt < 90 ||
      heightPt < 90 ||
      widthPt > 14400 ||
      heightPt > 14400
    )
      throw new Error("LAYOUT_UNSUPPORTED");
    const blocked = [];
    const annotations = page.node.lookupMaybe(PDFName.of("Annots"), PDFArray);
    if (annotations)
      for (const entry of annotations.asArray()) {
        const item = pdf.context.lookup(entry),
          rect = item?.lookupMaybe?.(PDFName.of("Rect"), PDFArray);
        if (!rect || rect.size() !== 4) throw new Error("LAYOUT_UNSUPPORTED");
        const values = rect
          .asArray()
          .map((value) => pdf.context.lookup(value)?.asNumber?.());
        if (!values.every(Number.isFinite))
          throw new Error("LAYOUT_UNSUPPORTED");
        const corners = [
          [values[0], values[1]],
          [values[2], values[3]],
        ].map(([x, y]) => {
          let u, v;
          if (rotation === 0) {
            u = x - crop.x;
            v = y - crop.y;
          } else if (rotation === 90) {
            u = y - crop.y;
            v = crop.x + crop.width - x;
          } else if (rotation === 180) {
            u = crop.x + crop.width - x;
            v = crop.y + crop.height - y;
          } else {
            u = crop.y + crop.height - y;
            v = x - crop.x;
          }
          return [(u * userUnit) / widthPt, 1 - (v * userUnit) / heightPt];
        });
        blocked.push({
          x: Math.min(corners[0][0], corners[1][0]),
          y: Math.min(corners[0][1], corners[1][1]),
          right: Math.max(corners[0][0], corners[1][0]),
          bottom: Math.max(corners[0][1], corners[1][1]),
        });
      }
    return { page: index + 1, widthPt, heightPt, rotation, userUnit, blocked };
  });
}
export function placementPlan(pages, positions) {
  if (!Array.isArray(positions) || positions.length !== pages.length)
    throw new Error("LAYOUT_PAGE_COUNT");
  return pages.map((page, index) => {
    const input = positions[index];
    if (
      input?.page !== index + 1 ||
      !Number.isFinite(input.x) ||
      !Number.isFinite(input.y) ||
      input.x < 0 ||
      input.y < 0 ||
      input.x + 90 / page.widthPt > 1 + 1e-9 ||
      input.y + 90 / page.heightPt > 1 + 1e-9
    )
      throw new Error("LAYOUT_OUTSIDE_PAGE");
    const x = Math.floor(input.x * 1e6) / 1e6,
      y = Math.floor(input.y * 1e6) / 1e6;
    if (
      page.blocked.some(
        (rect) =>
          x < rect.right &&
          x + 90 / page.widthPt > rect.x &&
          y < rect.bottom &&
          y + 90 / page.heightPt > rect.y,
      )
    )
      throw Object.assign(new Error("LAYOUT_ANNOTATION_OVERLAP"), {
        page: page.page,
      });
    return {
      page: page.page,
      widthPt: page.widthPt,
      heightPt: page.heightPt,
      rotation: page.rotation,
      userUnit: page.userUnit,
      x,
      y,
    };
  });
}
