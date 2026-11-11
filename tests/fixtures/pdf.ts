import { PDFDocument, PDFHexString, PDFName, PDFString } from "pdf-lib";

/** Synthetic bytes only. No uploaded or personal documents are test fixtures. */
export async function syntheticPdf(
  options: {
    pages?: number;
    javascript?: boolean;
    attachment?: boolean;
    associatedFile?: boolean;
    richMediaSubtype?: boolean;
    declaredEncryption?: boolean;
  } = {},
): Promise<Uint8Array<ArrayBuffer>> {
  const document = await PDFDocument.create();
  document.setTitle("Synthetic PDF test fixture");
  for (let index = 0; index < (options.pages ?? 1); index++) {
    document.addPage([200, 200]);
  }
  if (options.javascript) document.addJavaScript("synthetic", "void 0;");
  if (options.attachment) {
    await document.attach(new Uint8Array([1, 2, 3]), "synthetic.txt", {
      mimeType: "text/plain",
    });
  }
  if (options.associatedFile) {
    // Associated files can use /EF without an /EmbeddedFiles name tree.
    const embedded = document.context.register(
      document.context.flateStream(new Uint8Array([1, 2, 3]), {
        Type: "EmbeddedFile",
      }),
    );
    const specification = document.context.register(
      document.context.obj({
        Type: "Filespec",
        F: PDFString.of("synthetic.txt"),
        EF: { F: embedded },
      }),
    );
    document.catalog.set(
      PDFName.of("AF"),
      document.context.obj([specification]),
    );
  }
  if (options.richMediaSubtype) {
    const annotation = document.context.register(
      document.context.obj({
        Type: "Annot",
        Subtype: "RichMedia",
        Rect: [0, 0, 100, 100],
      }),
    );
    document
      .getPage(0)
      .node.set(PDFName.of("Annots"), document.context.obj([annotation]));
  }
  if (options.declaredEncryption) {
    // Deliberately declares encryption for rejection testing. This fixture does
    // not implement password cryptography or establish decryption support.
    document.context.trailerInfo.Encrypt = document.context.register(
      document.context.obj({
        Filter: PDFName.of("Standard"),
        V: 1,
        R: 2,
        Length: 40,
        O: PDFHexString.of("00".repeat(32)),
        U: PDFHexString.of("00".repeat(32)),
        P: -4,
      }),
    );
  }
  return new Uint8Array(
    await document.save({
      useObjectStreams: false,
      addDefaultPage: false,
    }),
  );
}
