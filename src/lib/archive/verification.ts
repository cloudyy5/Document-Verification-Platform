import { z } from "zod";
import { SIGNING_RECEIPT_ID_PATTERN } from "@/lib/signing/receipt-link";

export function parseEvidenceInput(
  value: string,
  origin: string,
): string | null {
  const text = value.trim();
  if (
    text.length > 2048 ||
    text.includes("\\") ||
    [...text].some(
      (character) =>
        character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127,
    )
  )
    return null;
  if (SIGNING_RECEIPT_ID_PATTERN.test(text)) return text;
  if (!/^(?:https?:\/\/[^/?#]+)?\/receipts\/[A-Za-z0-9_-]{43}$/.test(text))
    return null;
  try {
    if (!text.startsWith("/receipts/") && !/^https?:\/\//.test(text))
      return null;
    const url = new URL(text, origin);
    if (
      url.origin !== new URL(origin).origin ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      text.includes("%")
    )
      return null;
    const match = /^\/receipts\/([A-Za-z0-9_-]{43})$/.exec(url.pathname);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}
const sha256 = z.string().regex(/^[a-f0-9]{64}$/);
export const verificationEvidenceSchema = z
  .object({
    id: z.string().regex(SIGNING_RECEIPT_ID_PATTERN),
    requestId: z.uuid(),
    documentTitle: z.string().min(1).max(200),
    ownerName: z.string().min(1).max(120),
    signerName: z.string().min(1).max(120),
    sourceSha256: sha256,
    decidedAt: z.iso.datetime({ offset: true }).max(40),
    artifact: z.object({
      state: z.enum(["pending", "processing", "failed", "ready"]),
      sha256: sha256.nullable(),
    }),
  })
  .refine(
    (value) =>
      value.artifact.state !== "ready" || value.artifact.sha256 !== null,
  );
export type VerificationEvidence = z.infer<typeof verificationEvidenceSchema>;

export function compareEvidenceHash(
  hash: string,
  evidence: VerificationEvidence,
): "source" | "result" | "different" {
  if (!/^[a-f0-9]{64}$/.test(hash)) throw new Error("Invalid file digest");
  if (evidence.artifact.state === "ready" && hash === evidence.artifact.sha256)
    return "result";
  return hash === evidence.sourceSha256 ? "source" : "different";
}
export async function hashComparisonPdf(file: File): Promise<string> {
  if (!file.size || file.size > 20 * 1024 * 1024)
    throw new Error("Pilih PDF berukuran maksimal 20 MiB.");
  const buffer = await file.arrayBuffer();
  if (new TextDecoder("ascii").decode(buffer.slice(0, 5)) !== "%PDF-")
    throw new Error("File yang dipilih bukan PDF.");
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", buffer));
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}
