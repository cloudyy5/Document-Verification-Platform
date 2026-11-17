import { createHash } from "node:crypto";
import { PDFDocument, PDFName, PDFNull, PDFString } from "pdf-lib";
import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { validatePdf } from "@/server/documents/pdf";

type Configure = (pdf: PDFDocument) => void | Promise<void>;
async function fixture(configure: Configure) {
  const pdf = await PDFDocument.create();
  pdf.addPage([600, 800]);
  pdf.addPage([600, 800]);
  await configure(pdf);
  return new Uint8Array(await pdf.save({ useObjectStreams: false }));
}
const inspect = (bytes: Uint8Array<ArrayBuffer>) =>
  validatePdf(
    new File([bytes], "synthetic-opening.pdf", { type: "application/pdf" }),
    bytes.length,
  );
const opening = PDFName.of("OpenAction");
const target = (pdf: PDFDocument) =>
  pdf.context.obj([pdf.getPage(1).ref, PDFName.of("Fit")]);

describe("safe PDF initial navigation without rewriting source bytes", () => {
  it.each([
    ["Fit", []],
    ["FitB", []],
    ["XYZ", [PDFNull, PDFNull, 1]],
    ["FitH", [PDFNull]],
    ["FitV", [0]],
    ["FitBH", [800]],
    ["FitBV", [PDFNull]],
    ["FitR", [0, 0, 600, 800]],
  ] as const)(
    "accepts an internal %s destination and preserves the exact bytes/hash",
    async (kind, arguments_) => {
      const bytes = await fixture((pdf) => {
        pdf.catalog.set(
          opening,
          pdf.context.obj([
            pdf.getPage(1).ref,
            PDFName.of(kind),
            ...arguments_,
          ]),
        );
      });
      const result = await inspect(bytes);
      expect(result.pageCount).toBe(2);
      expect(result.bytes).toEqual(bytes);
      expect(result.sha256).toBe(
        createHash("sha256").update(bytes).digest("hex"),
      );
    },
  );
  it("accepts an indirect local GoTo action without extra actions", async () => {
    const bytes = await fixture((pdf) => {
      pdf.catalog.set(
        opening,
        pdf.context.register(
          pdf.context.obj({
            Type: "Action",
            S: pdf.context.register(PDFName.of("GoTo")),
            D: pdf.context.register(target(pdf)),
          }),
        ),
      );
    });
    await expect(inspect(bytes)).resolves.toMatchObject({ pageCount: 2 });
  });
  it("resolves a named destination from the legacy catalog dictionary", async () => {
    const bytes = await fixture((pdf) => {
      pdf.catalog.set(
        PDFName.of("Dests"),
        pdf.context.obj({ start: { D: target(pdf) } }),
      );
      pdf.catalog.set(opening, PDFName.of("start"));
    });
    await expect(inspect(bytes)).resolves.toMatchObject({ pageCount: 2 });
  });
  it("resolves string destinations through an indirect name tree", async () => {
    const bytes = await fixture((pdf) => {
      const leaf = pdf.context.register(
        pdf.context.obj({ Names: [PDFString.of("start"), target(pdf)] }),
      );
      pdf.catalog.set(
        PDFName.of("Names"),
        pdf.context.obj({ Dests: { Kids: [leaf] } }),
      );
      pdf.catalog.set(
        opening,
        pdf.context.obj({ S: "GoTo", D: PDFString.of("start") }),
      );
    });
    await expect(inspect(bytes)).resolves.toMatchObject({ pageCount: 2 });
  });
});

describe("opening-view allowance does not admit active content", () => {
  it.each([
    "JavaScript",
    "Launch",
    "SubmitForm",
    "ImportData",
    "URI",
    "GoToR",
    "GoToE",
  ])("rejects opening action %s", async (action) => {
    const bytes = await fixture((pdf) => {
      pdf.catalog.set(
        opening,
        pdf.context.obj({
          S: action,
          D: target(pdf),
          F: PDFString.of("synthetic.invalid"),
        }),
      );
    });
    await expect(inspect(bytes)).rejects.toMatchObject({ code: "ACTIVE_PDF" });
  });
  it("rejects chained actions even when the first action is a local GoTo", async () => {
    const bytes = await fixture((pdf) => {
      pdf.catalog.set(
        opening,
        pdf.context.obj({
          S: "GoTo",
          D: target(pdf),
          Next: { S: "JavaScript", JS: PDFString.of("void 0;") },
        }),
      );
    });
    await expect(inspect(bytes)).rejects.toMatchObject({ code: "ACTIVE_PDF" });
  });
  it.each([
    "missing-name",
    "foreign-page",
    "numeric-page",
    "invalid-argument",
    "unknown-mode",
    "wrong-count",
    "negative-zoom",
  ])("rejects unresolved or malformed local destination %s", async (kind) => {
    const bytes = await fixture((pdf) => {
      const ref =
        kind === "foreign-page"
          ? pdf.context.register(pdf.context.obj({ Type: "Page" }))
          : pdf.getPage(0).ref;
      const dest =
        kind === "missing-name"
          ? PDFString.of("missing")
          : kind === "numeric-page"
            ? pdf.context.obj([0, PDFName.of("Fit")])
            : kind === "invalid-argument"
              ? pdf.context.obj([
                  ref,
                  PDFName.of("FitH"),
                  PDFString.of("invalid"),
                ])
              : kind === "unknown-mode"
                ? pdf.context.obj([ref, PDFName.of("Execute")])
                : kind === "wrong-count"
                  ? pdf.context.obj([ref, PDFName.of("XYZ")])
                  : kind === "negative-zoom"
                    ? pdf.context.obj([
                        ref,
                        PDFName.of("XYZ"),
                        PDFNull,
                        PDFNull,
                        -1,
                      ])
                    : pdf.context.obj([ref, PDFName.of("Fit")]);
      pdf.catalog.set(opening, dest);
    });
    await expect(inspect(bytes)).rejects.toMatchObject({ code: "ACTIVE_PDF" });
  });
  it("rejects a cyclic destination name tree", async () => {
    const bytes = await fixture((pdf) => {
      const tree = pdf.context.obj({});
      const ref = pdf.context.register(tree);
      tree.set(PDFName.of("Kids"), pdf.context.obj([ref]));
      pdf.catalog.set(PDFName.of("Names"), pdf.context.obj({ Dests: ref }));
      pdf.catalog.set(opening, PDFString.of("missing"));
    });
    await expect(inspect(bytes)).rejects.toMatchObject({ code: "ACTIVE_PDF" });
  });
  it("does not allow an OpenAction key on a page instead of the catalog", async () => {
    const bytes = await fixture((pdf) => {
      pdf.getPage(0).node.set(opening, target(pdf));
    });
    await expect(inspect(bytes)).rejects.toMatchObject({ code: "ACTIVE_PDF" });
  });
  it("still rejects scripts elsewhere beside a safe initial destination", async () => {
    const bytes = await fixture((pdf) => {
      pdf.catalog.set(opening, target(pdf));
      pdf.addJavaScript("synthetic", "void 0;");
    });
    await expect(inspect(bytes)).rejects.toMatchObject({ code: "ACTIVE_PDF" });
  });
  it("still rejects attachments beside a safe initial destination", async () => {
    const bytes = await fixture(async (pdf) => {
      pdf.catalog.set(opening, target(pdf));
      await pdf.attach(new Uint8Array([1, 2, 3]), "synthetic.txt");
    });
    await expect(inspect(bytes)).rejects.toMatchObject({ code: "ACTIVE_PDF" });
  });
  it("checks stream dictionaries instead of mistaking them for inert data", async () => {
    const bytes = await fixture((pdf) => {
      pdf.context.register(
        pdf.context.flateStream(new Uint8Array([1, 2, 3]), {
          Type: "EmbeddedFile",
        }),
      );
    });
    await expect(inspect(bytes)).rejects.toMatchObject({ code: "ACTIVE_PDF" });
  });
});
