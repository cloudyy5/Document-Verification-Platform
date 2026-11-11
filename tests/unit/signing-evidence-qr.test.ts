import { describe, expect, it, vi } from "vitest";
import jsQR from "jsqr";
vi.mock("server-only", () => ({}));
import {
  signingReceiptHref,
  signingReceiptUrl,
} from "@/lib/signing/receipt-link";
import {
  createSigningEvidenceQr,
  newSigningReceiptId,
} from "@/server/signing/evidence-qr";

describe("private evidence QR foundation (synthetic identifiers, no issued evidence)", () => {
  it("can be decoded independently and carries only a canonical receipt link", () => {
    const id = "R".repeat(43);
    const qr = createSigningEvidenceQr("https://internal.example", id);
    const scale = 6;
    const dimension = (qr.size + 2 * qr.quietZone) * scale;
    const pixels = new Uint8ClampedArray(dimension * dimension * 4).fill(255);
    for (let row = 0; row < qr.size; row++) {
      for (let column = 0; column < qr.size; column++) {
        if (!qr.cells[row * qr.size + column]) continue;
        for (let y = 0; y < scale; y++) {
          for (let x = 0; x < scale; x++) {
            const index =
              (((row + qr.quietZone) * scale + y) * dimension +
                (column + qr.quietZone) * scale +
                x) *
              4;
            pixels[index] = pixels[index + 1] = pixels[index + 2] = 0;
          }
        }
      }
    }
    const decoded = jsQR(pixels, dimension, dimension, {
      inversionAttempts: "dontInvert",
    });
    expect(decoded?.data).toBe(`https://internal.example/receipts/${id}`);
    const link = new URL(decoded!.data);
    expect(link.search).toBe("");
    expect(link.hash).toBe("");
    expect(link.username).toBe("");
    expect(link.password).toBe("");
    expect(qr.quietZone).toBe(4);
  });

  it("generates separate random 256-bit identifiers without embedding user data", () => {
    const ids = Array.from({ length: 20 }, () => newSigningReceiptId());
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it.each([
    "https://user:password@internal.example",
    "http://internal.example",
    "https://internal.example/path",
    "https://internal.example?token=x",
    "https://internal.example#token",
    "file:///receipts",
    "javascript:alert(1)",
  ])("rejects a noncanonical origin before QR encoding: %s", (origin) => {
    expect(() => createSigningEvidenceQr(origin, "R".repeat(43))).toThrow();
  });

  it.each([
    "",
    "../private",
    "R".repeat(42),
    "R".repeat(44),
    `${"R".repeat(42)}/`,
  ])("rejects malformed receipt paths: %s", (id) => {
    expect(() => signingReceiptHref(id)).toThrow();
  });

  it("allows the local development origin without query or token", () => {
    expect(signingReceiptUrl("http://127.0.0.1:3000", "R".repeat(43))).toBe(
      `http://127.0.0.1:3000/receipts/${"R".repeat(43)}`,
    );
  });
});
