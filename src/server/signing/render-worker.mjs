import { parentPort, workerData } from "node:worker_threads";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import fontkit from "@pdf-lib/fontkit";
import QRCode from "qrcode";
import { inspectPages, placementPlan, visiblePageBox } from "./pdf-layout.mjs";
import {
  PDFDocument,
  PDFName,
  PDFArray,
  rgb,
  pushGraphicsState,
  popGraphicsState,
  concatTransformationMatrix,
  rectangle,
  fill,
  setFillingRgbColor,
} from "pdf-lib";

// Fixed local dependencies only; no app environment, cookies, network or secrets.
try {
  const { bytes, evidence, url } = workerData;
  if (
    !(bytes instanceof Uint8Array) ||
    bytes.length > 10485760 ||
    createHash("sha256").update(bytes).digest("hex") !==
      evidence.sourceSha256 ||
    typeof url !== "string" ||
    url.length > 512 ||
    new URL(url).pathname !== `/receipts/${evidence.id}` ||
    new URL(url).search ||
    new URL(url).hash
  )
    throw new Error("INVALID_RENDER_INPUT");
  const pdf = await PDFDocument.load(bytes, {
    ignoreEncryption: false,
    throwOnInvalidObject: true,
    updateMetadata: false,
  });
  const originalPages = pdf.getPages();
  if (!originalPages.length || originalPages.length > 2000)
    throw new Error("RENDER_LIMIT");
  const movable =
    evidence.layoutVersion === "per-page-draggable-web-evidence-v2";
  pdf.registerFontkit(fontkit);
  const font = movable
    ? null
    : await pdf.embedFont(
        await readFile(
          resolve(
            process.cwd(),
            "node_modules/geist/dist/fonts/geist-sans/Geist-Regular.ttf",
          ),
        ),
        { subset: true },
      );
  const supported = new Set(font?.getCharacterSet() ?? []);
  const display = (text, fallback) =>
    Array.from(text).every((c) => supported.has(c.codePointAt(0)) || c === "\n")
      ? text
      : fallback;
  const dark = rgb(0.15, 0.18, 0.22),
    blue = rgb(0.12, 0.32, 0.78),
    gray = rgb(0.45, 0.48, 0.52);
  const symbol = QRCode.create(url, { errorCorrectionLevel: "M" });
  function qr(page, x, y, side) {
    const step = side / (symbol.modules.size + 8);
    page.drawRectangle({
      x,
      y,
      width: side,
      height: side,
      color: rgb(1, 1, 1),
    });
    const modules = [pushGraphicsState(), setFillingRgbColor(0, 0, 0)];
    for (let row = 0; row < symbol.modules.size; row++)
      for (let col = 0; col < symbol.modules.size; col++)
        if (symbol.modules.get(row, col))
          modules.push(
            rectangle(
              x + (col + 4) * step,
              y + side - (row + 5) * step,
              step + 0.01,
              step + 0.01,
            ),
          );
    // One paint operation avoids antialias seams breaking finder patterns at
    // non-integer zoom levels in real PDF readers.
    page.pushOperators(...modules, fill(), popGraphicsState());
  }
  function text(page, value, x, y, size = 10, color = dark) {
    page.drawText(value, { x, y, size, font, color });
  }
  if (movable) {
    const pages = inspectPages(pdf),
      plan = placementPlan(pages, evidence.placements);
    for (const [index, item] of plan.entries()) {
      const supplied = evidence.placements[index];
      if (
        ["widthPt", "heightPt", "rotation", "userUnit"].some(
          (key) => item[key] !== supplied[key],
        )
      )
        throw new Error("RENDER_LIMIT");
      const page = originalPages[index],
        crop = visiblePageBox(page);
      let matrix;
      if (item.rotation === 0) matrix = [1, 0, 0, 1, crop.x, crop.y];
      else if (item.rotation === 90)
        matrix = [0, 1, -1, 0, crop.x + crop.width, crop.y];
      else if (item.rotation === 180)
        matrix = [-1, 0, 0, -1, crop.x + crop.width, crop.y + crop.height];
      else matrix = [0, -1, 1, 0, crop.x, crop.y + crop.height];
      page.pushOperators(
        pushGraphicsState(),
        concatTransformationMatrix(...matrix),
      );
      qr(
        page,
        (item.x * item.widthPt) / item.userUnit,
        (item.heightPt * (1 - item.y) - 90) / item.userUnit,
        90 / item.userUnit,
      );
      page.pushOperators(popGraphicsState());
    }
  } else {
    // Enlarge the visible canvas in its visual bottom direction. Existing page
    // contents, annotations and rotation remain at their original coordinates.
    for (const page of originalPages) {
      const crop = page.getCropBox(),
        media = page.getMediaBox();
      const rotation = ((page.getRotation().angle % 360) + 360) % 360;
      if (
        ![0, 90, 180, 270].includes(rotation) ||
        !Object.values(crop).every(Number.isFinite) ||
        crop.width < 140 ||
        crop.height < 140 ||
        crop.width > 14400 ||
        crop.height > 14400
      )
        throw new Error("RENDER_LIMIT");
      const annots = page.node.lookupMaybe(PDFName.of("Annots"), PDFArray);
      if (annots)
        for (const item of annots.asArray()) {
          const annotation = pdf.context.lookup(item);
          const rect = annotation?.lookupMaybe?.(PDFName.of("Rect"), PDFArray);
          if (!rect || rect.size() !== 4) continue;
          const [x1, y1, x2, y2] = rect
            .asArray()
            .map((value) => pdf.context.lookup(value)?.asNumber?.());
          if (
            ![x1, y1, x2, y2].every(Number.isFinite) ||
            Math.min(x1, x2) < crop.x ||
            Math.max(x1, x2) > crop.x + crop.width ||
            Math.min(y1, y2) < crop.y ||
            Math.max(y1, y2) > crop.y + crop.height
          )
            throw new Error("RENDER_LIMIT");
        }
      const h = 126;
      let box, matrix;
      if (rotation === 0) {
        box = { ...crop, y: crop.y - h, height: crop.height + h };
        matrix = [1, 0, 0, 1, crop.x, crop.y - h];
      } else if (rotation === 90) {
        box = { ...crop, width: crop.width + h };
        matrix = [0, 1, -1, 0, crop.x + crop.width + h, crop.y];
      } else if (rotation === 180) {
        box = { ...crop, height: crop.height + h };
        matrix = [-1, 0, 0, -1, crop.x + crop.width, crop.y + crop.height + h];
      } else {
        box = { ...crop, x: crop.x - h, width: crop.width + h };
        matrix = [0, -1, 1, 0, crop.x - h, crop.y + crop.height];
      }
      const left = Math.min(media.x, box.x),
        bottom = Math.min(media.y, box.y);
      page.setMediaBox(
        left,
        bottom,
        Math.max(media.x + media.width, box.x + box.width) - left,
        Math.max(media.y + media.height, box.y + box.height) - bottom,
      );
      page.setCropBox(box.x, box.y, box.width, box.height);
      const width = rotation % 180 === 0 ? box.width : box.height;
      page.pushOperators(
        pushGraphicsState(),
        concatTransformationMatrix(...matrix),
      );
      page.drawRectangle({ x: 0, y: 0, width, height: h, color: rgb(1, 1, 1) });
      page.drawLine({
        start: { x: 0, y: h },
        end: { x: width, y: h },
        thickness: 0.5,
        color: rgb(0.8, 0.82, 0.85),
      });
      qr(page, 18, 18, 90);
      if (width > 300) {
        text(page, "Bukti persetujuan internal", 126, 88, 11, blue);
        text(
          page,
          "Masuk ke platform untuk membuka bukti privat.",
          126,
          68,
          8,
          gray,
        );
        text(
          page,
          `Kode bukti: ${evidence.id.slice(0, 16)}...`,
          126,
          49,
          7,
          gray,
        );
        text(
          page,
          "PDF sumber tetap tersimpan secara terpisah.",
          126,
          31,
          7,
          gray,
        );
      }
      page.pushOperators(popGraphicsState());
    }
    const proof = pdf.addPage([595.28, 841.89]);
    proof.drawRectangle({
      x: 0,
      y: 752,
      width: 595.28,
      height: 89,
      color: rgb(0.95, 0.96, 0.98),
    });
    text(proof, "DOCUMENT VERIFICATION PLATFORM", 44, 799, 10, gray);
    text(proof, "Bukti persetujuan internal", 44, 768, 23, blue);
    let y = 707;
    function field(label, value) {
      text(proof, label, 44, y, 8, gray);
      y -= 18;
      const words = value.replace(/[\r\n\t]/g, " ").split(/\s+/);
      let line = "";
      for (const word of words) {
        if (line && font.widthOfTextAtSize(`${line} ${word}`, 10) > 505) {
          text(proof, line, 44, y, 10);
          y -= 15;
          line = word;
        } else line = line ? `${line} ${word}` : word;
      }
      // Hash/IDs are bounded; longer unbroken labels wrap by code point.
      while (font.widthOfTextAtSize(line, 10) > 505) {
        let cut = line.length - 1;
        while (cut > 1 && font.widthOfTextAtSize(line.slice(0, cut), 10) > 505)
          cut--;
        text(proof, line.slice(0, cut), 44, y, 10);
        y -= 15;
        line = line.slice(cut);
      }
      text(proof, line, 44, y, 10);
      y -= 34;
    }
    field(
      "Dokumen",
      display(
        evidence.documentTitle,
        "Judul lengkap tersedia pada bukti privat.",
      ),
    );
    field(
      "Penandatangan",
      display(evidence.signerName, "Nama lengkap tersedia pada bukti privat."),
    );
    field("Kode akun penandatangan", evidence.signerCode);
    field(
      "Waktu persetujuan (UTC)",
      new Date(evidence.decidedAt).toISOString(),
    );
    field("SHA-256 PDF sumber", evidence.sourceSha256);
    field("ID bukti", evidence.id);
    if (y < 225) throw new Error("RENDER_LIMIT");
    qr(proof, 44, 98, 105);
    text(proof, "Persetujuan melalui akun yang login", 168, 177, 11, blue);
    text(proof, "Kode QR membuka bukti privat di platform.", 168, 156, 9, gray);
    text(
      proof,
      "Catatan ini bukan sertifikat TTE atau verifikasi penerbit.",
      44,
      69,
      8,
      gray,
    );
    text(
      proof,
      "Hash PDF hasil tersimpan pada bukti privat; berbeda dari hash sumber.",
      44,
      53,
      8,
      gray,
    );
  }
  const date = new Date(evidence.decidedAt);
  pdf.setCreationDate(date);
  pdf.setModificationDate(date);
  pdf.setProducer("Document Verification Platform / internal consent");
  const result = await pdf.save({
    useObjectStreams: true,
    updateFieldAppearances: false,
  });
  if (result.length > 20971520) throw new Error("RENDER_LIMIT");
  parentPort.postMessage({
    ok: true,
    bytes: result,
    pageCount: originalPages.length + (movable ? 0 : 1),
  });
} catch (error) {
  parentPort.postMessage({
    ok: false,
    code: error?.message === "RENDER_LIMIT" ? "RENDER_LIMIT" : "RENDER_FAILED",
  });
}
