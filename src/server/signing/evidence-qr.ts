import "server-only";
import { randomBytes } from "node:crypto";
import QRCode from "qrcode";
import { signingReceiptUrl } from "@/lib/signing/receipt-link";

/** Generate only inside a future committed approval workflow, never at signup. */
export function newSigningReceiptId(): string {
  return randomBytes(32).toString("base64url");
}

/** A local encoder: the QR contains only the login-protected receipt URL. */
export function createSigningEvidenceQr(origin: string, receiptId: string) {
  const url = signingReceiptUrl(origin, receiptId);
  if (url.length > 512)
    throw new Error("Internal receipt URL exceeds QR bound.");
  const symbol = QRCode.create(url, { errorCorrectionLevel: "M" });
  return {
    url,
    size: symbol.modules.size,
    quietZone: 4,
    cells: new Uint8Array(symbol.modules.data),
  };
}
