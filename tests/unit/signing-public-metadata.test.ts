import { createHmac } from "node:crypto";
import { beforeEach, describe, it, expect, vi } from "vitest";
const m = vi.hoisted(() => ({
  config: vi.fn(),
  privileged: vi.fn(),
  rpc: vi.fn(),
  auth: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/config", () => ({
  getAuthConfiguration: () => ({
    flowSecret: "synthetic-public-projection-flow-secret",
  }),
}));
vi.mock("@/lib/supabase/privileged", () => ({
  createPrivilegedSupabaseClient: m.privileged,
}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: m.auth,
}));
vi.mock("@/server/signing/config", () => ({
  getSigningConfiguration: m.config,
}));
import { getSigningPublicMetadata } from "@/server/signing/public-metadata";
const id = "R".repeat(43);
const metadata = () => ({
  status: "approved",
  approvedAt: "2026-11-17T04:30:00.000Z",
  signerName: "Penerima sintetis",
  documentTitle: "UJI DEVELOPMENT",
});
beforeEach(() => {
  vi.resetAllMocks();
  m.config.mockReturnValue({ environment: "development" });
  m.privileged.mockReturnValue({ rpc: m.rpc });
  m.rpc.mockImplementation(async (name: string) => ({
    data: name === "consume_public_signing_metadata_limit" ? true : metadata(),
    error: null,
  }));
});
describe("S-19 public metadata server-only projection", () => {
  it("reads exactly four allowed fields without authenticating a visitor or reading private tables", async () => {
    expect(await getSigningPublicMetadata(id)).toEqual(metadata());
    expect(m.auth).not.toHaveBeenCalled();
    expect(m.rpc.mock.calls.map(([name]) => name)).toEqual([
      "consume_public_signing_metadata_limit",
      "get_signing_public_metadata",
    ]);
    expect(m.rpc).toHaveBeenCalledWith("get_signing_public_metadata", {
      p_receipt_id: id,
    });
  });
  it("uses HMAC digests instead of raw QR tokens in persistent limiter keys", async () => {
    await getSigningPublicMetadata(id);
    const args = m.rpc.mock.calls[0]![1];
    expect(args.p_key_digest).toBe(
      createHmac("sha256", "synthetic-public-projection-flow-secret")
        .update(`public-signing-metadata\0receipt:${id}`)
        .digest("hex"),
    );
    expect(JSON.stringify(args)).not.toContain(id);
  });
  it.each([
    "",
    "x".repeat(42),
    "x".repeat(44),
    "../details",
    "<script>",
    `${id}/details`,
  ])("does not access providers for invalid token %s", async (value) => {
    expect(await getSigningPublicMetadata(value)).toBeNull();
    expect(m.privileged).not.toHaveBeenCalled();
  });
  it("returns no metadata for an unknown/unapproved QR", async () => {
    m.rpc
      .mockResolvedValueOnce({ data: true, error: null })
      .mockResolvedValueOnce({ data: null, error: null });
    expect(await getSigningPublicMetadata(id)).toBeNull();
  });
  it("stops before reading metadata when the persistent limit is exceeded", async () => {
    m.rpc.mockResolvedValue({ data: false, error: null });
    await expect(getSigningPublicMetadata(id)).rejects.toMatchObject({
      status: 429,
    });
    expect(m.rpc).toHaveBeenCalledTimes(1);
  });
  it.each([
    "email",
    "signerCode",
    "ownerName",
    "sourceSha256",
    "storage_path",
    "documentId",
    "placements",
    "pdfUrl",
  ])(
    "fails closed if provider accidentally returns private field %s",
    async (field) => {
      m.rpc
        .mockResolvedValueOnce({ data: true, error: null })
        .mockResolvedValueOnce({
          data: { ...metadata(), [field]: "private-canary" },
          error: null,
        });
      await expect(getSigningPublicMetadata(id)).rejects.toMatchObject({
        status: 503,
        code: "PUBLIC_METADATA_UNAVAILABLE",
      });
    },
  );
  it.each([
    { data: null, error: { message: "private provider canary" } },
    { data: true, error: null },
  ])("fails closed for invalid provider result", async (result) => {
    m.rpc
      .mockResolvedValueOnce({ data: true, error: null })
      .mockResolvedValueOnce(result);
    await expect(getSigningPublicMetadata(id)).rejects.toMatchObject({
      status: 503,
      message: expect.not.stringContaining("canary"),
    });
  });
  it("keeps the deployment development gate and fails closed if it is unavailable", async () => {
    m.config.mockImplementation(() => {
      throw new Error("disabled");
    });
    await expect(getSigningPublicMetadata(id)).rejects.toMatchObject({
      status: 503,
    });
    expect(m.privileged).not.toHaveBeenCalled();
  });
});
