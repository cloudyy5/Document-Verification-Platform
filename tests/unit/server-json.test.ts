import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { readSmallJson } from "@/server/json";

function request(chunks: Uint8Array[], headers: Record<string, string> = {}) {
  const cancel = vi.fn();
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      const chunk = chunks.shift();
      if (chunk) controller.enqueue(chunk);
      else controller.close();
    },
    cancel,
  });
  return {
    cancel,
    value: new Request("https://dvp.example/api/v2/recipients/lookup", {
      method: "POST",
      body,
      duplex: "half",
      headers: { "content-type": "application/json", ...headers },
    } as RequestInit & { duplex: "half" }),
  };
}
const encode = (value: string) => new TextEncoder().encode(value);

describe("bounded JSON mutation reader using actual streams", () => {
  it("decodes split multibyte UTF-8 at the exact byte bound", async () => {
    const bytes = encode('{"title":"Persetujuan β"}');
    const split = bytes.indexOf(0xce) + 1;
    const { value } = request([bytes.slice(0, split), bytes.slice(split)], {
      "content-type": "Application/JSON; charset=utf-8",
    });
    expect(await readSmallJson(value, bytes.byteLength)).toEqual({
      title: "Persetujuan β",
    });
  });

  it.each([undefined, "1"])(
    "caps actual bytes with an absent or false length (%s)",
    async (length) => {
      const { value, cancel } = request(
        [encode('"'), encode("x".repeat(100)), encode('"')],
        length ? { "content-length": length } : {},
      );
      await expect(readSmallJson(value, 32)).rejects.toMatchObject({
        status: 413,
        code: "REQUEST_TOO_LARGE",
      });
      expect(cancel).toHaveBeenCalledOnce();
    },
  );

  it.each(["999999", "-1", "1.5", "NaN"])(
    "rejects declared length %s before reading",
    async (length) => {
      const { value } = request([encode("{}")], { "content-length": length });
      const read = vi.spyOn(value.body!, "getReader");
      await expect(readSmallJson(value)).rejects.toMatchObject({ status: 413 });
      expect(read).not.toHaveBeenCalled();
    },
  );

  it.each(["text/plain", "application/jsonp", "application/json-malformed"])(
    "rejects unsupported media type %s before reading",
    async (type) => {
      const { value } = request([encode("{}")], { "content-type": type });
      const read = vi.spyOn(value.body!, "getReader");
      await expect(readSmallJson(value)).rejects.toMatchObject({ status: 415 });
      expect(read).not.toHaveBeenCalled();
    },
  );

  it.each([
    encode("{"),
    new Uint8Array([0x22, 0xc3, 0x28, 0x22]),
    new Uint8Array([0x22, 0xc3]),
  ])("redacts malformed JSON or UTF-8", async (bytes) => {
    const { value } = request([bytes]);
    await expect(readSmallJson(value)).rejects.toMatchObject({
      status: 400,
      code: "INVALID_REQUEST",
    });
  });

  it("cancels a stalled stream at the elapsed deadline", async () => {
    const cancel = vi.fn();
    const value = new Request("https://dvp.example/api/v2/signing-requests", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: new ReadableStream<Uint8Array>({ cancel }),
      duplex: "half",
    } as RequestInit & { duplex: "half" });
    await expect(readSmallJson(value, 4096, 10)).rejects.toMatchObject({
      status: 408,
      code: "REQUEST_TIMEOUT",
    });
    expect(cancel).toHaveBeenCalledOnce();
  });

  it("rejects a missing body without exposing parser details", async () => {
    const value = new Request("https://dvp.example/api/v2/signing-requests", {
      method: "POST",
      headers: { "content-type": "application/json" },
    });
    await expect(readSmallJson(value)).rejects.toMatchObject({
      status: 400,
      code: "INVALID_REQUEST",
    });
  });
});
