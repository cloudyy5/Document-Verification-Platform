import "server-only";
import { privateHeaders } from "@/server/api";

/** Byte-preserving private response shared by the two document models. */
export function privatePdfResponse(
  request: Request,
  bytes: Uint8Array<ArrayBuffer>,
  filename: string,
): Response {
  const url = new URL(request.url);
  let start = 0;
  let end = bytes.length - 1;
  const range = request.headers.get("range");
  const headers = new Headers({
    ...privateHeaders,
    "Content-Type": "application/pdf",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "X-Frame-Options": "SAMEORIGIN",
    "Content-Security-Policy":
      "default-src 'none'; frame-ancestors 'self'; sandbox",
    "Accept-Ranges": "bytes",
  });
  const encodedName = encodeURIComponent(filename).replace(
    /['()*]/g,
    (value) => `%${value.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  headers.set(
    "Content-Disposition",
    `${url.searchParams.get("download") === "1" ? "attachment" : "inline"}; filename="document.pdf"; filename*=UTF-8''${encodedName}`,
  );
  const unsatisfied = () =>
    new Response(null, {
      status: 416,
      headers: {
        ...Object.fromEntries(headers),
        "Content-Range": `bytes */${bytes.length}`,
      },
    });
  if (range) {
    const parsed = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (
      !parsed ||
      (!parsed[1] && !parsed[2]) ||
      parsed
        .slice(1)
        .some((value) => value && !Number.isSafeInteger(Number(value)))
    )
      return unsatisfied();
    if (!parsed[1]) start = Math.max(0, bytes.length - Number(parsed[2]));
    else {
      start = Number(parsed[1]);
      if (parsed[2]) end = Math.min(end, Number(parsed[2]));
    }
    if (
      !Number.isSafeInteger(start) ||
      !Number.isSafeInteger(end) ||
      start < 0 ||
      start > end ||
      start >= bytes.length ||
      (!parsed[1] && Number(parsed[2]) === 0)
    )
      return unsatisfied();
    headers.set("Content-Range", `bytes ${start}-${end}/${bytes.length}`);
  }
  headers.set("Content-Length", String(end - start + 1));
  return new Response(bytes.slice(start, end + 1), {
    status: range ? 206 : 200,
    headers,
  });
}
