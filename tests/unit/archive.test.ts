import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  config: vi.fn(),
  client: vi.fn(),
  from: vi.fn(),
  requests: vi.fn(),
  counts: [] as (number | null)[],
  queries: [] as Record<string, ReturnType<typeof vi.fn>>[],
}));
vi.mock("server-only", () => ({}));
vi.mock("@/server/api", () => ({ apiSession: mocks.session }));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: mocks.client,
}));
vi.mock("@/server/signing/config", () => ({
  getSigningConfiguration: mocks.config,
}));
vi.mock("@/server/signing/queries", () => ({
  getSigningRequests: mocks.requests,
}));
import { getArchiveOverview } from "@/server/archive";
import { ApiError } from "@/server/errors";
import { archiveFiltersSchema } from "@/lib/archive/schema";
import {
  parseEvidenceInput,
  compareEvidenceHash,
  hashComparisonPdf,
  verificationEvidenceSchema,
} from "@/lib/archive/verification";

const owner = "97000000-0000-4000-8000-000000000001",
  id = "A".repeat(43),
  origin = "https://dvp.ilkomith.cloud";
beforeEach(() => {
  vi.clearAllMocks();
  mocks.queries = [];
  mocks.counts = [4, 3, 2, 1, 1, 0, 0, 0, 1];
  mocks.session.mockResolvedValue({ user: { id: owner }, roles: ["user"] });
  mocks.client.mockResolvedValue({ from: mocks.from });
  mocks.requests.mockResolvedValue({ items: [], hasMore: false, cursor: null });
  mocks.from.mockImplementation(() => {
    const count = mocks.counts.shift();
    const query: Record<string, ReturnType<typeof vi.fn>> = {};
    for (const name of ["select", "eq", "gt", "lte"])
      query[name] = vi.fn(() => query);
    query.then = vi.fn((resolve, reject) =>
      Promise.resolve({ count, error: null }).then(resolve, reject),
    );
    mocks.queries.push(query);
    return query;
  });
});
describe("private archive summary", () => {
  it("counts only current actor's documents and participant request scopes without fetching global rows", async () => {
    const data = await getArchiveOverview();
    expect(data.metrics).toMatchObject({
      ownedDocuments: 4,
      sentRequests: 3,
      receivedRequests: 2,
      completed: 1,
      expired: 1,
    });
    expect(mocks.session).toHaveBeenCalledWith("user");
    expect(mocks.queries).toHaveLength(9);
    mocks.queries.forEach((query, index) => {
      expect(query.eq).toHaveBeenCalledWith(
        index === 2 ? "recipient_id" : "owner_id",
        owner,
      );
      expect(query.select).toHaveBeenCalledWith("id", {
        count: "exact",
        head: true,
      });
    });
    expect(mocks.queries[3]!.gt).toHaveBeenCalledWith("expires_at", data.asOf);
    expect(mocks.queries[8]!.lte).toHaveBeenCalledWith("expires_at", data.asOf);
  });
  it("authenticates before any configuration or count client", async () => {
    mocks.session.mockRejectedValue(
      new ApiError(401, "UNAUTHENTICATED", "Login required"),
    );
    await expect(getArchiveOverview()).rejects.toMatchObject({ status: 401 });
    expect(mocks.config).not.toHaveBeenCalled();
    expect(mocks.client).not.toHaveBeenCalled();
  });
  it("never converts missing counts to a misleading zero", async () => {
    mocks.counts[3] = null;
    await expect(getArchiveOverview()).rejects.toMatchObject({
      status: 503,
      code: "ARCHIVE_UNAVAILABLE",
    });
    expect(mocks.requests).not.toHaveBeenCalled();
  });
});
describe("archive filters", () => {
  it("defaults to owned current documents", () => {
    expect(archiveFiltersSchema.parse({}).scope).toBe("owned");
  });
  it.each([
    { scope: "sent", q: "hidden title" },
    { scope: "owned", status: "completed" },
    { user_id: owner },
    { scope: "global" },
  ])("rejects misleading or foreign-authority filters %j", (value) => {
    expect(archiveFiltersSchema.safeParse(value).success).toBe(false);
  });
});
describe("opaque, private evidence identifiers", () => {
  it.each([id, `/receipts/${id}`, `${origin}/receipts/${id}`])(
    "accepts a receipt ID or canonical URL %s",
    (value) => {
      expect(parseEvidenceInput(value, origin)).toBe(id);
    },
  );
  it.each([
    `https://evil.example/receipts/${id}`,
    `//evil.example/receipts/${id}`,
    `${origin}/receipts/${id}?token=secret`,
    `${origin}/receipts/${id}#hash`,
    `${origin}/a/../receipts/${id}`,
    `${origin}/receipts/%41${id.slice(1)}`,
    `${origin}/receipts/${id}/`,
    `https://user:password@dvp.ilkomith.cloud/receipts/${id}`,
    "DVP-0123456789ABCDEF0123",
    owner,
    "javascript:alert(1)",
    `/receipts/${id}\\anything`,
    "x".repeat(2049),
  ])(
    "rejects cross-origin, bearer/redirect input or nonreceipt identifiers %j",
    (value) => {
      expect(parseEvidenceInput(value, origin)).toBeNull();
    },
  );
  it("compares exact bytes with source versus final artifact without issuing a new approval", async () => {
    const bytes = new TextEncoder().encode("%PDF-1.7\nSYNTHETIC COMPARISON\n");
    const hash = createHash("sha256").update(bytes).digest("hex");
    expect(await hashComparisonPdf(new File([bytes], "synthetic.pdf"))).toBe(
      hash,
    );
    const evidence = verificationEvidenceSchema.parse({
      id,
      requestId: owner,
      documentTitle: "Uji",
      ownerName: "A",
      signerName: "B",
      sourceSha256: hash,
      decidedAt: "2026-11-16T01:00:00Z",
      artifact: { state: "ready", sha256: "b".repeat(64) },
    });
    expect(compareEvidenceHash(hash, evidence)).toBe("source");
    expect(compareEvidenceHash("b".repeat(64), evidence)).toBe("result");
    expect(compareEvidenceHash("c".repeat(64), evidence)).toBe("different");
    expect(
      compareEvidenceHash("b".repeat(64), {
        ...evidence,
        artifact: { state: "processing", sha256: null },
      }),
    ).toBe("different");
  });
  it("rejects non-PDF and overlimit comparison inputs locally", async () => {
    await expect(
      hashComparisonPdf(new File(["not pdf"], "fake.pdf")),
    ).rejects.toThrow("bukan PDF");
    const file = new File(["%PDF-"], "synthetic.pdf");
    Object.defineProperty(file, "size", { value: 20971521 });
    await expect(hashComparisonPdf(file)).rejects.toThrow("20 MiB");
  });
});
