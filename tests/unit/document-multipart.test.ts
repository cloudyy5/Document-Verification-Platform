import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { readLimitedFormData } from "@/server/documents/multipart";

function streamedRequest(
  chunks: Uint8Array[],
  headers: Record<string, string> = {},
) {
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
    request: new Request("https://dvp.example/api/v1/documents", {
      method: "POST",
      body,
      duplex: "half",
      headers: {
        "content-type": "multipart/form-data; boundary=synthetic",
        ...headers,
      },
    } as RequestInit & { duplex: "half" }),
    cancel,
  };
}

describe("bounded multipart body reader (actual request streams)", () => {
  it("cancels a stalled multipart stream when its deadline expires", async () => {
    const cancel = vi.fn();
    const body = new ReadableStream<Uint8Array>({ cancel });
    const request = new Request("https://dvp.example/api/v1/documents", {
      method: "POST",
      body,
      duplex: "half",
      headers: { "content-type": "multipart/form-data; boundary=synthetic" },
    } as RequestInit & { duplex: "half" });
    await expect(readLimitedFormData(request, 1024, 10)).rejects.toMatchObject({
      status: 408,
      code: "UPLOAD_TIMEOUT",
    });
    expect(cancel).toHaveBeenCalledOnce();
  });

  it("parses a genuine multipart body within the configured bound", async () => {
    const values = new FormData();
    values.set("title", "Synthetic document");
    values.set(
      "file",
      new File(["synthetic"], "synthetic.pdf", { type: "application/pdf" }),
    );
    const request = new Request("https://dvp.example/api/v1/documents", {
      method: "POST",
      body: values,
    });
    const parsed = await readLimitedFormData(request, 1024);
    expect(parsed.get("title")).toBe("Synthetic document");
    expect(parsed.get("file")).toBeInstanceOf(File);
  });

  it.each([undefined, "1"])(
    "enforces actual streamed bytes even without a truthful Content-Length",
    async (length) => {
      const { request, cancel } = streamedRequest(
        [new Uint8Array(40_000), new Uint8Array(40_000), new Uint8Array(1)],
        length ? { "content-length": length } : {},
      );
      await expect(readLimitedFormData(request, 1024)).rejects.toMatchObject({
        status: 413,
        code: "FILE_TOO_LARGE",
      });
      expect(cancel).toHaveBeenCalledOnce();
    },
  );

  it("rejects a declared excessive request before consuming its stream", async () => {
    const { request } = streamedRequest([new Uint8Array(1)], {
      "content-length": "99999999",
    });
    const reader = vi.spyOn(request.body!, "getReader");
    await expect(readLimitedFormData(request, 1024)).rejects.toMatchObject({
      status: 413,
    });
    expect(reader).not.toHaveBeenCalled();
  });

  it.each(["-1", "1.5", "NaN", "9007199254740992"])(
    "rejects malformed Content-Length %s",
    async (length) => {
      const { request } = streamedRequest([new Uint8Array(1)], {
        "content-length": length,
      });
      await expect(readLimitedFormData(request, 1024)).rejects.toMatchObject({
        status: 400,
        code: "INVALID_REQUEST",
      });
    },
  );

  it("rejects malformed multipart instead of forwarding parser details", async () => {
    const { request } = streamedRequest([
      new TextEncoder().encode("not-a-multipart-body"),
    ]);
    await expect(readLimitedFormData(request, 1024)).rejects.toMatchObject({
      status: 400,
      code: "INVALID_REQUEST",
    });
  });

  it("rejects JSON and invalid upload configuration", async () => {
    const { request } = streamedRequest([], {
      "content-type": "application/json",
    });
    await expect(readLimitedFormData(request, 1024)).rejects.toMatchObject({
      status: 415,
    });
    await expect(readLimitedFormData(request, 0)).rejects.toMatchObject({
      status: 503,
    });
  });
});
