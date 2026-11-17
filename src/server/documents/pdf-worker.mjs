import { parentPort, workerData } from "node:worker_threads";
import {
  PDFDocument,
  PDFDict,
  PDFArray,
  PDFName,
  PDFRef,
  PDFNumber,
  PDFNull,
  PDFString,
  PDFHexString,
  PDFStream,
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
  const resolve = (value) => document.context.lookup(value);
  const pageRefs = new Set(pages.map((page) => page.ref.toString()));
  // Only document-local initial navigation is allowed. Do not remove or
  // rewrite anything: the stored source and its hash must remain identical.
  function namedDestination(name) {
    const direct = resolve(document.catalog.get(PDFName.of("Dests")));
    let found =
      direct instanceof PDFDict ? direct.get(PDFName.of(name)) : undefined;
    const names = resolve(document.catalog.get(PDFName.of("Names")));
    const root =
      names instanceof PDFDict
        ? resolve(names.get(PDFName.of("Dests")))
        : undefined;
    const queue = root ? [root] : [],
      seen = new Set();
    let examined = 0;
    while (queue.length) {
      const node = resolve(queue.pop());
      if (!(node instanceof PDFDict) || seen.has(node) || ++examined > 10000)
        return undefined;
      seen.add(node);
      const entries = resolve(node.get(PDFName.of("Names")));
      if (entries !== undefined) {
        if (!(entries instanceof PDFArray) || entries.size() % 2)
          return undefined;
        for (let index = 0; index < entries.size(); index += 2) {
          if (++examined > 10000) return undefined;
          const key = resolve(entries.get(index));
          if (!(key instanceof PDFString || key instanceof PDFHexString))
            return undefined;
          if (key.decodeText() === name) {
            if (found !== undefined) return undefined;
            found = entries.get(index + 1);
          }
        }
      }
      const children = resolve(node.get(PDFName.of("Kids")));
      if (children !== undefined) {
        if (
          !(children instanceof PDFArray) ||
          children.size() + queue.length + examined > 10000
        )
          return undefined;
        queue.push(...children.asArray());
      }
    }
    return resolve(found);
  }
  function localDestination(value) {
    let target = resolve(value);
    if (
      target instanceof PDFName ||
      target instanceof PDFString ||
      target instanceof PDFHexString
    )
      target = namedDestination(target.decodeText());
    if (target instanceof PDFDict) {
      if (target.keys().length !== 1 || !target.has(PDFName.of("D")))
        return false;
      target = resolve(target.get(PDFName.of("D")));
    }
    if (!(target instanceof PDFArray) || target.size() < 2) return false;
    const page = target.get(0),
      mode = resolve(target.get(1));
    if (
      !(page instanceof PDFRef) ||
      !pageRefs.has(page.toString()) ||
      !(mode instanceof PDFName)
    )
      return false;
    const kind = mode.decodeText(),
      lengths = {
        XYZ: 5,
        Fit: 2,
        FitH: 3,
        FitV: 3,
        FitR: 6,
        FitB: 2,
        FitBH: 3,
        FitBV: 3,
      };
    if (!Object.hasOwn(lengths, kind) || target.size() !== lengths[kind])
      return false;
    const values = target.asArray().slice(2).map(resolve);
    if (
      !values.every(
        (item) =>
          (item === PDFNull && kind !== "FitR") ||
          (item instanceof PDFNumber && Number.isFinite(item.asNumber())),
      )
    )
      return false;
    if (kind === "XYZ" && values[2] !== PDFNull && values[2].asNumber() < 0)
      return false;
    if (
      kind === "FitR" &&
      (values[0].asNumber() >= values[2].asNumber() ||
        values[1].asNumber() >= values[3].asNumber())
    )
      return false;
    return true;
  }
  function safeOpeningView(value) {
    const action = resolve(value);
    if (!(action instanceof PDFDict)) return localDestination(action);
    const keys = action.keys().map((key) => key.decodeText());
    const kind = resolve(action.get(PDFName.of("S"))),
      type = resolve(action.get(PDFName.of("Type")));
    return (
      keys.every((key) => ["Type", "S", "D"].includes(key)) &&
      kind instanceof PDFName &&
      kind.decodeText() === "GoTo" &&
      (type === undefined ||
        (type instanceof PDFName && type.decodeText() === "Action")) &&
      localDestination(action.get(PDFName.of("D")))
    );
  }
  const blockedKeys = [
    "JS",
    "JavaScript",
    "AA",
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
      if (
        object.has(PDFName.of("OpenAction")) &&
        (object !== document.catalog ||
          !safeOpeningView(object.get(PDFName.of("OpenAction"))))
      )
        throw new Error("ACTIVE_PDF");
      const type = resolve(object.get(PDFName.of("Type")));
      if (type instanceof PDFName && type.decodeText() === "EmbeddedFile")
        throw new Error("ACTIVE_PDF");
      const action = resolve(object.get(PDFName.of("S")));
      if (action instanceof PDFName && blockedActions.has(action.decodeText()))
        throw new Error("ACTIVE_PDF");
      const subtype = resolve(object.get(PDFName.of("Subtype")));
      if (
        subtype instanceof PDFName &&
        blockedSubtypes.has(subtype.decodeText())
      )
        throw new Error("ACTIVE_PDF");
      for (const [, value] of object.entries()) pending.push(value);
    } else if (object instanceof PDFArray) {
      for (const value of object.asArray()) pending.push(value);
    } else if (object instanceof PDFStream) {
      pending.push(object.dict);
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
