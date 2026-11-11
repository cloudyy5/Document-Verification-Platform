import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({
  session: vi.fn(),
  client: vi.fn(),
  from: vi.fn(),
  replies: {} as Record<string, unknown[]>,
}));
vi.mock("server-only", () => ({}));
vi.mock("@/server/api", () => ({ apiSession: m.session }));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: m.client,
}));
vi.mock("@/server/signing/config", () => ({
  getSigningConfiguration: () => ({ environment: "development" }),
}));
import { ApiError } from "@/server/errors";
import {
  getSigningEvidence,
  getSigningOutcome,
} from "@/server/signing/evidence";
const owner = "61000000-0000-4000-8000-000000000001",
  recipient = "61000000-0000-4000-8000-000000000002",
  outsider = "61000000-0000-4000-8000-000000000003";
const request = "62000000-0000-4000-8000-000000000001",
  version = "63000000-0000-4000-8000-000000000001",
  decision = "64000000-0000-4000-8000-000000000001",
  doc = "65000000-0000-4000-8000-000000000001",
  id = "R".repeat(43),
  stamp = "2026-11-10T01:00:00.000Z";
const receipt = () => ({
  id,
  decision_id: decision,
  request_id: request,
  source_version_id: version,
  owner_id: owner,
  recipient_id: recipient,
  signer_name: "Uji Penerima",
  signer_code: `DVP-${"A".repeat(20)}`,
  owner_name: "Uji Pemilik",
  document_title: "UJI DEVELOPMENT",
  source_sha256: "a".repeat(64),
  policy_version: "internal-action-development-2026-11-05",
  layout_version: "all-pages-bottom-left-and-evidence-v1",
  decided_at: stamp,
});
beforeEach(() => {
  vi.resetAllMocks();
  m.session.mockResolvedValue({ user: { id: recipient }, roles: ["user"] });
  m.replies = {
    signing_receipts: [receipt()],
    signing_requests: [
      {
        id: request,
        document_id: doc,
        source_version_id: version,
        owner_id: owner,
        recipient_id: recipient,
        status: "completed",
      },
    ],
    signing_artifacts: [
      {
        receipt_id: id,
        state: "ready",
        file_size_bytes: 4096,
        artifact_sha256: "b".repeat(64),
        page_count: 2,
        failure_code: null,
        ready_at: stamp,
      },
    ],
    signing_decisions: [],
  };
  m.from.mockImplementation((table: string) => {
    const q = {
      select: vi.fn(),
      eq: vi.fn(),
      or: vi.fn(),
      maybeSingle: vi.fn().mockImplementation(async () => ({
        data: m.replies[table]?.shift() ?? null,
        error: null,
      })),
    };
    for (const f of [q.select, q.eq, q.or]) f.mockReturnValue(q);
    return q;
  });
  m.client.mockResolvedValue({ from: m.from });
});
describe("R3 evidence reads use participant RLS only (provider mocked)", () => {
  it("reads a new one-page result with its participant-scoped locked positions", async () => {
    m.replies.signing_receipts = [
      { ...receipt(), layout_version: "per-page-draggable-web-evidence-v2" },
    ];
    m.replies.signing_artifacts = [
      { ...(m.replies.signing_artifacts[0] as object), page_count: 1 },
    ];
    m.replies.signing_receipt_layouts = [
      {
        placement_plan: [
          {
            page: 1,
            x: 0.1,
            y: 0.2,
            widthPt: 600,
            heightPt: 800,
            rotation: 0,
            userUnit: 1,
          },
        ],
      },
    ];
    const value = await getSigningEvidence(id);
    expect(value?.artifact.pageCount).toBe(1);
    expect(value?.placements?.[0]).toMatchObject({ x: 0.1, y: 0.2 });
    expect(JSON.stringify(value)).not.toMatch(
      /storage_path|claim_token|confirmation_digest/,
    );
  });
  it("fails closed if new receipt layout metadata is missing", async () => {
    m.replies.signing_receipts = [
      { ...receipt(), layout_version: "per-page-draggable-web-evidence-v2" },
    ];
    await expect(getSigningEvidence(id)).rejects.toMatchObject({ status: 503 });
  });
  it("maps only public evidence metadata and separate hashes without exposing storage paths or job claims", async () => {
    m.replies.signing_artifacts[0] = {
      ...(m.replies.signing_artifacts[0] as object),
      storage_path: "private.pdf",
      claim_token: "not-for-browser",
    };
    const value = await getSigningEvidence(id);
    expect(value?.sourceSha256).toBe("a".repeat(64));
    expect(value?.artifact.sha256).toBe("b".repeat(64));
    expect(JSON.stringify(value)).not.toMatch(
      /storage|claim|token|cookie|digest/,
    );
  });
  it("authenticates before querying a receipt", async () => {
    m.session.mockRejectedValue(
      new ApiError(401, "UNAUTHENTICATED", "Masuk dahulu"),
    );
    await expect(getSigningEvidence(id)).rejects.toMatchObject({ status: 401 });
    expect(m.client).not.toHaveBeenCalled();
  });
  it("returns no evidence when RLS hides it", async () => {
    m.replies.signing_receipts = [];
    expect(await getSigningEvidence(id)).toBeNull();
    expect(m.from).not.toHaveBeenCalledWith("signing_artifacts");
  });
  it("does not use an out-of-scope row even if the provider erroneously returns one", async () => {
    m.session.mockResolvedValue({
      user: { id: outsider },
      roles: ["user", "platform_admin"],
    });
    expect(await getSigningEvidence(id)).toBeNull();
    expect(m.from).not.toHaveBeenCalledWith("signing_requests");
  });
  it("fails closed on a stale receipt whose request does not grant approved access", async () => {
    m.replies.signing_requests = [
      {
        id: request,
        document_id: doc,
        source_version_id: version,
        owner_id: owner,
        recipient_id: recipient,
        status: "rejected",
      },
    ];
    await expect(getSigningEvidence(id)).rejects.toMatchObject({ status: 503 });
  });
  it("does not show a ready result with incomplete integrity metadata", async () => {
    m.replies.signing_artifacts = [
      {
        receipt_id: id,
        state: "ready",
        file_size_bytes: null,
        artifact_sha256: null,
        page_count: null,
        failure_code: null,
        ready_at: null,
      },
    ];
    await expect(getSigningEvidence(id)).rejects.toMatchObject({ status: 503 });
  });
  it("shows a rejection reason to participants without querying source metadata or receipt", async () => {
    m.replies.signing_decisions = [
      {
        id: decision,
        request_id: request,
        source_version_id: version,
        actor_id: recipient,
        action: "reject",
        reason: "Tidak sesuai",
        policy_version: "internal-action-development-2026-11-05",
        consent: false,
        authentication_method: "session_explicit_confirmation-v1",
        decided_at: stamp,
      },
    ];
    const value = await getSigningOutcome(request);
    expect(value.decision?.reason).toBe("Tidak sesuai");
    expect(value.evidence).toBeNull();
    expect(m.from).not.toHaveBeenCalledWith("signing_receipts");
    expect(m.from).not.toHaveBeenCalledWith("signing_document_versions");
  });
  it("returns an actual pending outcome rather than inventing approval", async () => {
    const value = await getSigningOutcome(request);
    expect(value).toEqual({ decision: null, evidence: null });
  });
});
