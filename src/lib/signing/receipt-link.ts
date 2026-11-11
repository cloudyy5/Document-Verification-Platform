/** An opaque receipt identifies evidence; it never grants access by itself. */
export const SIGNING_RECEIPT_ID_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export function signingReceiptHref(id: string): string {
  if (!SIGNING_RECEIPT_ID_PATTERN.test(id))
    throw new Error("Invalid internal receipt identifier.");
  return `/receipts/${id}`;
}

/** Accept only the canonical application origin, without credentials or query. */
export function signingReceiptUrl(origin: string, id: string): string {
  const target = new URL(origin);
  const loopback = ["127.0.0.1", "localhost", "[::1]"].includes(
    target.hostname,
  );
  if (
    !(
      target.protocol === "https:" ||
      (target.protocol === "http:" && loopback)
    ) ||
    target.username ||
    target.password ||
    target.search ||
    target.hash ||
    target.pathname !== "/"
  )
    throw new Error("Invalid internal receipt origin.");
  return new URL(signingReceiptHref(id), target.origin).href;
}
