import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { syntheticPdf } from "../fixtures/pdf";
vi.mock("server-only", () => ({}));
const workerBoundary = vi.hoisted(() => ({ spreadPayload: false }));
vi.mock("node:worker_threads", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:worker_threads")>();
  return {
    ...actual,
    Worker: class extends actual.Worker {
      constructor(
        ...[filename, options]: ConstructorParameters<typeof actual.Worker>
      ) {
        // Reproduce the emitted Turbopack wrapper; keep the worker/parser real.
        super(
          filename,
          workerBoundary.spreadPayload
            ? {
                ...options,
                workerData: {
                  ...options?.workerData,
                  __turbopack_globals__: {},
                },
              }
            : options,
        );
      }
    },
  };
});
import { validatePdf } from "@/server/documents/pdf";

let bytes: Uint8Array<ArrayBuffer>;
beforeAll(async () => {
  bytes = await syntheticPdf({ pages: 2 });
});

describe("actual PDF parser worker and byte validation (no cloud)", () => {
  it("parses genuine pages and computes SHA-256 over unchanged source bytes", async () => {
    const result = await validatePdf(
      new File([bytes], "synthetic.PDF", { type: "application/pdf" }),
      bytes.length,
    );
    expect(result.pageCount).toBe(2);
    expect(result.bytes).toEqual(bytes);
    expect(result.sha256).toBe(
      createHash("sha256").update(bytes).digest("hex"),
    );
  }, 15_000);

  it("preserves PDF bytes when a bundler spreads workerData to add globals", async () => {
    workerBoundary.spreadPayload = true;
    try {
      const result = await validatePdf(
        new File([bytes], "synthetic.pdf", { type: "application/pdf" }),
        bytes.length,
      );
      expect(result.pageCount).toBe(2);
      expect(result.bytes).toEqual(bytes);
      expect(result.sha256).toBe(
        createHash("sha256").update(bytes).digest("hex"),
      );
    } finally {
      workerBoundary.spreadPayload = false;
    }
  }, 15_000);

  it("validates actual PDF bytes without inheriting parent Node startup flags", async () => {
    // Native Worker defaults inherit startup flags, not later JS edits to
    // process.execArgv. Start a real parent with --input-type=module instead.
    // Transform the actual TS modules in memory; only the server-only marker
    // and TS alias are adapted, like the unit runner's existing module setup.
    const script = `
      import { readFileSync } from "node:fs";
      import { stripTypeScriptTypes } from "node:module";
      const moduleUrl = source => "data:text/javascript;base64," + Buffer.from(source).toString("base64");
      const compile = path => stripTypeScriptTypes(
        readFileSync(path, "utf8").replace('import "server-only";', ""),
        { mode: "transform" }
      );
      try {
        const errorsUrl = moduleUrl(compile("src/server/errors.ts"));
        const pdfSource = compile("src/server/documents/pdf.ts").replace(
          'from "@/server/errors"', 'from "' + errorsUrl + '"'
        );
        const { validatePdf } = await import(moduleUrl(pdfSource));
        const bytes = Buffer.from("${Buffer.from(bytes).toString("base64")}", "base64");
        const result = await validatePdf(new File([bytes], "synthetic.pdf", { type: "application/pdf" }), bytes.length);
        console.log(JSON.stringify({
          inheritedFlag: process.execArgv.includes("--input-type=module"),
          pageCount: result.pageCount, sha256: result.sha256
        }));
      } catch (error) {
        console.error(error.code ?? "PDF_SUBPROCESS_FAILED");
        process.exitCode = 1;
      }
    `;
    let stdout: string;
    try {
      ({ stdout } = await promisify(execFile)(
        process.execPath,
        ["--input-type=module", "--eval", script],
        {
          cwd: process.cwd(),
          env: { NODE_ENV: "test" },
          encoding: "utf8",
          timeout: 12_000,
        },
      ));
    } catch {
      throw new Error(
        "PDF validation failed under inherited Node startup flags.",
      );
    }
    expect(JSON.parse(stdout)).toEqual({
      inheritedFlag: true,
      pageCount: 2,
      sha256: createHash("sha256").update(bytes).digest("hex"),
    });
  }, 15_000);

  it("rejects a zero-byte file", async () => {
    await expect(
      validatePdf(
        new File([], "synthetic.pdf", { type: "application/pdf" }),
        1024,
      ),
    ).rejects.toMatchObject({ status: 422, code: "INVALID_FILE" });
  });

  it("rejects a file beyond the configured maximum before parsing", async () => {
    await expect(
      validatePdf(
        new File([bytes], "synthetic.pdf", { type: "application/pdf" }),
        bytes.length - 1,
      ),
    ).rejects.toMatchObject({ status: 413, code: "FILE_TOO_LARGE" });
  });

  it.each([
    ["synthetic.txt", "application/pdf"],
    ["synthetic.pdf", "text/plain"],
    ["synthetic.pdf", ""],
    ["synthetic\n.pdf", "application/pdf"],
    [`${"x".repeat(252)}.pdf`, "application/pdf"],
  ])("rejects an invalid filename or MIME claim", async (name, type) => {
    await expect(
      validatePdf(new File([bytes], name, { type }), bytes.length),
    ).rejects.toMatchObject({ status: 415, code: "UNSUPPORTED_FILE_TYPE" });
  });

  it.each([
    "not-a-pdf",
    "%PDF-1.7\nmissing footer",
    "%PDF-1.7\nnot a valid object tree\n%%EOF",
  ])(
    "rejects malformed bytes rather than trusting the extension",
    async (text) => {
      await expect(
        validatePdf(
          new File([text], "synthetic.pdf", { type: "application/pdf" }),
          1024,
        ),
      ).rejects.toMatchObject({ status: 422, code: "INVALID_PDF" });
    },
    15_000,
  );

  it("rejects trailing executable data after the PDF footer", async () => {
    await expect(
      validatePdf(
        new File([bytes, "untrusted-tail"], "synthetic.pdf", {
          type: "application/pdf",
        }),
        bytes.length + 100,
      ),
    ).rejects.toMatchObject({ status: 422, code: "INVALID_PDF" });
  });

  it("rejects a PDF declaring encryption", async () => {
    const encrypted = await syntheticPdf({ declaredEncryption: true });
    await expect(
      validatePdf(
        new File([encrypted], "synthetic.pdf", { type: "application/pdf" }),
        encrypted.length,
      ),
    ).rejects.toMatchObject({ status: 422, code: "ENCRYPTED_PDF" });
  }, 15_000);

  it.each([{ javascript: true }, { attachment: true }])(
    "rejects active content or embedded attachments without executing them",
    async (options) => {
      const active = await syntheticPdf(options);
      await expect(
        validatePdf(
          new File([active], "synthetic.pdf", { type: "application/pdf" }),
          active.length,
        ),
      ).rejects.toMatchObject({ status: 422, code: "ACTIVE_PDF" });
    },
    15_000,
  );

  it("rejects a structurally parseable PDF with no pages", async () => {
    const empty = await syntheticPdf({ pages: 0 });
    await expect(
      validatePdf(
        new File([empty], "synthetic.pdf", { type: "application/pdf" }),
        empty.length,
      ),
    ).rejects.toMatchObject({ status: 422, code: "INVALID_PDF" });
  }, 15_000);

  it("rejects an EF-associated attachment without an EmbeddedFiles name tree", async () => {
    const attached = await syntheticPdf({ associatedFile: true });
    const serialized = Buffer.from(attached).toString("latin1");
    expect(serialized).toContain("/EF");
    expect(serialized).not.toContain("/EmbeddedFiles");
    await expect(
      validatePdf(
        new File([attached], "synthetic.pdf", { type: "application/pdf" }),
        attached.length,
      ),
    ).rejects.toMatchObject({ status: 422, code: "ACTIVE_PDF" });
  }, 15_000);

  it("rejects a RichMedia subtype even without a RichMedia dictionary key", async () => {
    const richMedia = await syntheticPdf({ richMediaSubtype: true });
    await expect(
      validatePdf(
        new File([richMedia], "synthetic.pdf", { type: "application/pdf" }),
        richMedia.length,
      ),
    ).rejects.toMatchObject({ status: 422, code: "ACTIVE_PDF" });
  }, 15_000);
});
