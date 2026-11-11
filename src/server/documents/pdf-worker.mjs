import { parentPort, workerData } from "node:worker_threads";
import {
  PDFDocument,
  PDFDict,
  PDFArray,
  PDFName,
  EncryptedPDFError,
} from "pdf-lib";

// This worker has no app credentials and never evaluates PDF scripts.
try {
  const document = await PDFDocument.load(workerData.bytes, {
    ignoreEncryption: false,
    throwOnInvalidObject: true,
    updateMetadata: false,
  });
  if (document.isEncrypted) throw new Error("ENCRYPTED_PDF");
  const pages = document.getPages();
  if (!pages.length) throw new Error("INVALID_PDF");
  const blockedKeys = [
    "JS",
    "JavaScript",
    "AA",
    "OpenAction",
    "EmbeddedFiles",
    "EF",
    "RichMedia",
    "XFA",
  ];
  const blockedSubtypes = new Set([
    "FileAttachment",
    "RichMedia",
    "Movie",
    "Sound",
    "3D",
  ]);
  const blockedActions = new Set([
    "JavaScript",
    "Launch",
    "SubmitForm",
    "ImportData",
  ]);
  const visited = new Set();
  const pending = document.context
    .enumerateIndirectObjects()
    .map(([, object]) => object);
  while (pending.length) {
    const object = pending.pop();
    if (!object || visited.has(object)) continue;
    visited.add(object);
    if (object instanceof PDFDict) {
      if (blockedKeys.some((key) => object.has(PDFName.of(key))))
        throw new Error("ACTIVE_PDF");
      const action = object.get(PDFName.of("S"));
      if (action instanceof PDFName && blockedActions.has(action.decodeText()))
        throw new Error("ACTIVE_PDF");
      const subtype = object.get(PDFName.of("Subtype"));
      if (
        subtype instanceof PDFName &&
        blockedSubtypes.has(subtype.decodeText())
      )
        throw new Error("ACTIVE_PDF");
      for (const [, value] of object.entries()) pending.push(value);
    } else if (object instanceof PDFArray) {
      for (const value of object.asArray()) pending.push(value);
    }
  }
  parentPort.postMessage({ ok: true, pageCount: pages.length });
} catch (error) {
  const encrypted =
    error?.message === new EncryptedPDFError().message ||
    error?.name === "EncryptedPDFError" ||
    error?.message === "ENCRYPTED_PDF";
  parentPort.postMessage({
    ok: false,
    code: encrypted
      ? "ENCRYPTED_PDF"
      : error?.message === "ACTIVE_PDF"
        ? "ACTIVE_PDF"
        : "INVALID_PDF",
  });
}
