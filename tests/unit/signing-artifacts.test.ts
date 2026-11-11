import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({
  actor: vi.fn(),
  limit: vi.fn(),
  evidence: vi.fn(),
  user: vi.fn(),
  privileged: vi.fn(),
  rpc: vi.fn(),
  bucket: vi.fn(),
  upload: vi.fn(),
  download: vi.fn(),
  remove: vi.fn(),
  source: vi.fn(),
  render: vi.fn(),
  signedUrl: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/config", () => ({
  getAppOrigin: () => "http://127.0.0.1:3000",
}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: m.user,
}));
vi.mock("@/lib/supabase/privileged", () => ({
  createPrivilegedSupabaseClient: m.privileged,
}));
vi.mock("@/server/signing/evidence", () => ({
  getSigningEvidence: m.evidence,
}));
vi.mock("@/server/signing/r3-context", () => ({
  signingActor: m.actor,
  signingR3Limit: m.limit,
}));
vi.mock("@/server/signing/file", () => ({ serveSigningFile: m.source }));
vi.mock("@/server/signing/render", () => ({ renderSigningPdf: m.render }));
import {
  renderSigningEvidence,
  serveSigningResult,
} from "@/server/signing/artifacts";
import { ApiError } from "@/server/errors";
const owner = "71000000-0000-4000-8000-000000000001",
  actor = "71000000-0000-4000-8000-000000000002",
  token = "72000000-0000-4000-8000-000000000001",
  id = "R".repeat(43);
const source = new TextEncoder().encode(
    "synthetic original PDF bytes, parser separately tested",
  ),
  output = new TextEncoder().encode(
    "synthetic derived PDF bytes with QR, renderer separately tested",
  );
const hash = (bytes: Uint8Array) =>
  createHash("sha256").update(bytes).digest("hex");
const path = `${owner}/signing-results/${id}/${token}.pdf`;
const pending = () => ({
  id,
  documentId: "73000000-0000-4000-8000-000000000001",
  sourceVersionId: "74000000-0000-4000-8000-000000000001",
  sourceSha256: hash(source),
  artifact: { state: "pending", bytes: null, sha256: null },
});
const ready = () => ({
  ...pending(),
  artifact: { state: "ready", bytes: output.length, sha256: hash(output) },
});
function query(data: unknown) {
  const q = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn().mockResolvedValue({ data, error: null }),
  };
  q.select.mockReturnValue(q);
  q.eq.mockReturnValue(q);
  return q;
}
beforeEach(() => {
  vi.resetAllMocks();
  m.actor.mockResolvedValue({
    user: { id: actor, emailConfirmed: true },
    roles: ["user"],
  });
  m.limit.mockResolvedValue(undefined);
  m.evidence.mockResolvedValue(pending());
  m.user.mockResolvedValue({
    from: (table: string) =>
      query(
        table === "signing_receipts"
          ? { owner_id: owner }
          : {
              state: "ready",
              storage_path: path,
              file_size_bytes: output.length,
              artifact_sha256: hash(output),
            },
      ),
  });
  m.privileged.mockReturnValue({ rpc: m.rpc, storage: { from: m.bucket } });
  m.bucket.mockReturnValue({
    upload: m.upload,
    download: m.download,
    remove: m.remove,
    createSignedUrl: m.signedUrl,
  });
  m.rpc.mockImplementation(async (name) => ({
    data:
      name === "claim_signing_render"
        ? { state: "processing", claimToken: token }
        : true,
    error: null,
  }));
  m.source.mockImplementation(async () => new Response(source));
  m.render.mockResolvedValue({ bytes: output, pageCount: 2 });
  m.upload.mockResolvedValue({ data: { path }, error: null });
  m.download.mockResolvedValue({ data: new Blob([output]), error: null });
});
describe("R3 artifact I/O (mocked provider/renderer, real orchestration and HTTP response)", () => {
  it("claims before processing, writes a new private result, checks stored bytes, then completes", async () => {
    expect(await renderSigningEvidence(id)).toBe("ready");
    expect(m.bucket).toHaveBeenCalledWith("signing-results");
    expect(m.upload).toHaveBeenCalledWith(path, output, {
      contentType: "application/pdf",
      cacheControl: "0",
      upsert: false,
    });
    expect(m.rpc).toHaveBeenCalledWith(
      "complete_signing_render",
      expect.objectContaining({
        p_actor_id: actor,
        p_receipt_id: id,
        p_claim_token: token,
        p_storage_path: path,
        p_artifact_sha256: hash(output),
        p_file_size_bytes: output.length,
        p_page_count: 2,
      }),
    );
    expect(m.rpc.mock.invocationCallOrder.at(-1)).toBeGreaterThan(
      m.download.mock.invocationCallOrder[0]!,
    );
    expect(m.remove).not.toHaveBeenCalled();
    expect(m.signedUrl).not.toHaveBeenCalled();
  });
  it("does no work for a ready result", async () => {
    m.evidence.mockResolvedValue(ready());
    expect(await renderSigningEvidence(id)).toBe("ready");
    expect(m.rpc).not.toHaveBeenCalled();
    expect(m.render).not.toHaveBeenCalled();
  });
  it("does no duplicate work while another render owns the lease", async () => {
    m.rpc.mockResolvedValue({ data: { state: "processing" }, error: null });
    expect(await renderSigningEvidence(id)).toBe("processing");
    expect(m.source).not.toHaveBeenCalled();
    expect(m.upload).not.toHaveBeenCalled();
  });
  it("does not mark a result ready when source integrity fails", async () => {
    m.source.mockImplementation(async () => new Response("wrong source"));
    expect(await renderSigningEvidence(id)).toBe("failed");
    expect(m.render).not.toHaveBeenCalled();
    expect(m.upload).not.toHaveBeenCalled();
    expect(m.rpc).toHaveBeenCalledWith(
      "fail_signing_render",
      expect.objectContaining({ p_failure_code: "SOURCE_UNAVAILABLE" }),
    );
  });
  it("does not publish altered stored bytes", async () => {
    m.download.mockResolvedValue({
      data: new Blob(["wrong artifact"]),
      error: null,
    });
    expect(await renderSigningEvidence(id)).toBe("failed");
    expect(m.rpc).not.toHaveBeenCalledWith(
      "complete_signing_render",
      expect.anything(),
    );
    expect(m.remove).not.toHaveBeenCalled();
  });
  it("does not delete an uncertain upload or replace the committed approval", async () => {
    m.upload.mockRejectedValue(new Error("Synthetic network timeout"));
    expect(await renderSigningEvidence(id)).toBe("failed");
    expect(m.remove).not.toHaveBeenCalled();
    expect(m.rpc).not.toHaveBeenCalledWith(
      "decide_signing_request",
      expect.anything(),
    );
  });
  it("recovers a committed ready result after a lost completion response", async () => {
    m.rpc.mockImplementation(async (name) => {
      if (name === "complete_signing_render")
        throw new Error("Synthetic response lost");
      return { data: { state: "processing", claimToken: token }, error: null };
    });
    m.evidence.mockResolvedValueOnce(pending()).mockResolvedValue(ready());
    expect(await renderSigningEvidence(id)).toBe("ready");
    expect(m.rpc).not.toHaveBeenCalledWith(
      "fail_signing_render",
      expect.anything(),
    );
    expect(m.remove).not.toHaveBeenCalled();
  });
  it("authenticates before provider work", async () => {
    m.actor.mockRejectedValue(new ApiError(401, "UNAUTHENTICATED", "Masuk"));
    await expect(renderSigningEvidence(id)).rejects.toMatchObject({
      status: 401,
    });
    expect(m.evidence).not.toHaveBeenCalled();
    expect(m.rpc).not.toHaveBeenCalled();
  });
  it("reports recovered ready state when a competing completion wins while failure is recorded", async () => {
    m.upload.mockRejectedValue(new Error("Synthetic timeout"));
    m.evidence
      .mockResolvedValueOnce(pending())
      .mockResolvedValueOnce(pending())
      .mockResolvedValue(ready());
    m.rpc.mockImplementation(async (name) => ({
      data:
        name === "claim_signing_render"
          ? { state: "processing", claimToken: token }
          : false,
      error: null,
    }));
    expect(await renderSigningEvidence(id)).toBe("ready");
    expect(m.remove).not.toHaveBeenCalled();
  });
  it("does not claim failure was saved when neither acknowledgement nor state can be recovered", async () => {
    m.upload.mockRejectedValue(new Error("Synthetic timeout"));
    m.evidence
      .mockResolvedValueOnce(pending())
      .mockRejectedValue(new Error("Synthetic provider outage"));
    m.rpc.mockImplementation(async (name) => ({
      data:
        name === "claim_signing_render"
          ? { state: "processing", claimToken: token }
          : null,
      error: name === "fail_signing_render" ? { code: "network" } : null,
    }));
    await expect(renderSigningEvidence(id)).rejects.toMatchObject({
      status: 503,
    });
    expect(m.remove).not.toHaveBeenCalled();
  });
  it.each([null, "pending"])(
    "never downloads an unavailable or nonready result (%s)",
    async (state) => {
      m.evidence.mockResolvedValue(state ? pending() : null);
      await expect(
        serveSigningResult(new Request("http://127.0.0.1:3000/api/file"), id),
      ).rejects.toMatchObject({ status: state ? 409 : 404 });
      expect(m.download).not.toHaveBeenCalled();
    },
  );
  it("serves an authorized exact range privately with no bearer URL", async () => {
    m.evidence.mockResolvedValue(ready());
    const response = await serveSigningResult(
      new Request("http://127.0.0.1:3000/file?download=1", {
        headers: { Range: "bytes=2-6" },
      }),
      id,
    );
    expect(response.status).toBe(206);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("x-frame-options")).toBe("SAMEORIGIN");
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(
      output.slice(2, 7),
    );
    expect(m.signedUrl).not.toHaveBeenCalled();
  });
  it("discards buffered result bytes after access is lost", async () => {
    m.evidence.mockResolvedValueOnce(ready()).mockResolvedValue(null);
    await expect(
      serveSigningResult(new Request("http://127.0.0.1:3000/file"), id),
    ).rejects.toMatchObject({ status: 404 });
    expect(m.download).toHaveBeenCalled();
  });
  it("does not serve a result with mismatched content hash", async () => {
    m.evidence.mockResolvedValue(ready());
    m.download.mockResolvedValue({
      data: new Blob(["x".repeat(output.length)]),
      error: null,
    });
    await expect(
      serveSigningResult(new Request("http://127.0.0.1:3000/file"), id),
    ).rejects.toMatchObject({ status: 503 });
  });
});
