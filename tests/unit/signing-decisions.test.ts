import { createHash, createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({
  session: vi.fn(),
  user: vi.fn(),
  privileged: vi.fn(),
  claims: vi.fn(),
  rpc: vi.fn(),
  from: vi.fn(),
  source: vi.fn(),
  render: vi.fn(),
  configuration: vi.fn(),
  inspect: vi.fn(),
  outcome: vi.fn(),
  replies: {} as Record<string, unknown>,
}));
vi.mock("server-only", () => ({}));
vi.mock("@/server/api", () => ({ apiSession: m.session }));
vi.mock("@/lib/auth/config", () => ({
  getAppOrigin: () => "http://127.0.0.1:3000",
  getAuthConfiguration: () => ({
    flowSecret: "synthetic-r3-session-digest-test-secret",
  }),
}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: m.user,
}));
vi.mock("@/lib/supabase/privileged", () => ({
  createPrivilegedSupabaseClient: m.privileged,
}));
vi.mock("@/server/signing/config", () => ({
  getSigningConfiguration: m.configuration,
}));
vi.mock("@/server/signing/file", () => ({ serveSigningFile: m.source }));
vi.mock("@/server/signing/layout", () => ({
  inspectSigningPlacement: m.inspect,
}));
vi.mock("@/server/signing/evidence", () => ({ getSigningOutcome: m.outcome }));
vi.mock("@/server/signing/artifacts", () => ({
  renderSigningEvidence: m.render,
}));
import { ApiError } from "@/server/errors";
import { decideSigningRequest } from "@/server/signing/decisions";
import { derivedUploadId } from "@/server/documents/upload";
const actor = "51000000-0000-4000-8000-000000000001",
  owner = "51000000-0000-4000-8000-000000000002";
const sid = "51000000-0000-4000-8000-000000000003",
  request = "52000000-0000-4000-8000-000000000001",
  version = "53000000-0000-4000-8000-000000000001",
  doc = "54000000-0000-4000-8000-000000000001",
  key = "55000000-0000-4000-8000-000000000001";
const receipt = "R".repeat(43),
  bytes = new TextEncoder().encode(
    "synthetic source; actual PDF parser is tested separately",
  ),
  hash = createHash("sha256").update(bytes).digest("hex");
const body = () => ({
  sourceVersionId: version,
  sourceSha256: hash,
  action: "approve",
  consent: true,
  confirmed: true,
  policyVersion: "internal-action-development-2026-11-05",
  placementVersion: "per-page-draggable-web-evidence-v2",
  placements: [{ page: 1, x: 0.1, y: 0.2 }],
});
const plan = [
  {
    page: 1,
    x: 0.1,
    y: 0.2,
    widthPt: 595,
    heightPt: 842,
    rotation: 0,
    userUnit: 1,
  },
];
function rejectionBody(reason: string) {
  return {
    sourceVersionId: version,
    sourceSha256: hash,
    action: "reject",
    consent: false,
    confirmed: true,
    policyVersion: body().policyVersion,
    reason,
  };
}
const decisionId = derivedUploadId(actor, key, `signing-decision:${request}`);
beforeEach(() => {
  vi.resetAllMocks();
  m.session.mockResolvedValue({
    user: { id: actor, emailConfirmed: true },
    roles: ["user"],
  });
  m.configuration.mockReturnValue({ environment: "development" });
  m.claims.mockResolvedValue({
    data: { claims: { sub: actor, session_id: sid } },
    error: null,
  });
  m.replies = {
    signing_requests: {
      id: request,
      document_id: doc,
      source_version_id: version,
      recipient_id: actor,
    },
    signing_decisions: null,
  };
  m.from.mockImplementation((table: string) => {
    const query = {
      select: vi.fn(),
      eq: vi.fn(),
      maybeSingle: vi
        .fn()
        .mockResolvedValue({ data: m.replies[table], error: null }),
    };
    query.select.mockReturnValue(query);
    query.eq.mockReturnValue(query);
    return query;
  });
  m.user.mockResolvedValue({ auth: { getClaims: m.claims }, from: m.from });
  m.privileged.mockReturnValue({ rpc: m.rpc });
  m.rpc.mockImplementation(async (name: string) =>
    name === "consume_signing_r3_limit"
      ? { data: true, error: null }
      : {
          data: {
            decisionId,
            requestId: request,
            sourceVersionId: version,
            action: "approve",
            reason: null,
            receiptId: receipt,
            decidedAt: "2026-11-10T01:00:00.000Z",
          },
          error: null,
        },
  );
  m.source.mockImplementation(async () => new Response(bytes));
  m.render.mockResolvedValue("ready");
  m.inspect.mockResolvedValue(plan);
});
describe("R3 decision orchestration (mocked Auth/Storage, real validation and binding)", () => {
  it("uses verified actor/session and immutable source, then renders only after successful RPC commit", async () => {
    const result = await decideSigningRequest(request, body(), key);
    expect(result.artifactState).toBe("ready");
    const args = m.rpc.mock.calls.find(
      ([name]) => name === "approve_signing_request_with_placement",
    )![1];
    expect(args.p_actor_id).toBe(actor);
    expect(args.p_decision_id).toBe(decisionId);
    expect(args.p_source_sha256).toBe(hash);
    const expected = createHmac(
      "sha256",
      "synthetic-r3-session-digest-test-secret",
    )
      .update(
        JSON.stringify([
          sid,
          actor,
          request,
          version,
          hash,
          "approve",
          null,
          body().policyVersion,
          key,
          plan,
        ]),
      )
      .digest("hex");
    expect(args.p_confirmation_digest).toBe(expected);
    expect(JSON.stringify(result)).not.toMatch(
      /session|token|digest|storage_path/,
    );
    expect(m.render.mock.invocationCallOrder[0]).toBeGreaterThan(
      m.rpc.mock.invocationCallOrder.at(-1)!,
    );
    expect(m.source.mock.invocationCallOrder[0]).toBeLessThan(
      m.rpc.mock.invocationCallOrder.at(-1)!,
    );
  });
  it("authenticates before using any provider or file", async () => {
    m.session.mockRejectedValue(
      new ApiError(401, "UNAUTHENTICATED", "Masuk dahulu"),
    );
    await expect(
      decideSigningRequest(request, body(), key),
    ).rejects.toMatchObject({ status: 401 });
    expect(m.user).not.toHaveBeenCalled();
    expect(m.rpc).not.toHaveBeenCalled();
  });
  it.each([
    { emailConfirmed: false, roles: ["user"] },
    { emailConfirmed: true, roles: ["platform_admin"] },
  ])("requires confirmed user eligibility (%j)", async (extra) => {
    m.session.mockResolvedValue({
      user: { id: actor, emailConfirmed: extra.emailConfirmed },
      roles: extra.roles,
    });
    await expect(
      decideSigningRequest(request, body(), key),
    ).rejects.toMatchObject({ status: 403 });
    expect(m.user).not.toHaveBeenCalled();
  });
  it.each([
    {},
    { sub: owner, session_id: sid },
    { sub: actor, session_id: "not-a-session" },
  ])("rejects missing or mismatched signed session binding", async (claims) => {
    m.claims.mockResolvedValue({ data: { claims }, error: null });
    await expect(
      decideSigningRequest(request, body(), key),
    ).rejects.toMatchObject({ status: 503 });
    expect(m.rpc).not.toHaveBeenCalled();
  });
  it.each([
    { actor_id: owner },
    { owner_id: owner },
    { status: "completed" },
    { receiptId: receipt },
    { storage_path: "arbitrary.pdf" },
    { confirmed: false },
    { consent: false },
  ])(
    "rejects authority/confirmation injection before source access",
    async (extra) => {
      await expect(
        decideSigningRequest(request, { ...body(), ...extra }, key),
      ).rejects.toThrow();
      expect(m.source).not.toHaveBeenCalled();
      expect(m.rpc).not.toHaveBeenCalled();
    },
  );
  it.each([null, "invalid"])(
    "requires a valid idempotency key: %s",
    async (invalid) => {
      await expect(
        decideSigningRequest(request, body(), invalid),
      ).rejects.toMatchObject({ status: 400 });
      expect(m.rpc).not.toHaveBeenCalled();
    },
  );
  it("does not record consent when source bytes differ from the displayed hash", async () => {
    await expect(
      decideSigningRequest(
        request,
        { ...body(), sourceSha256: "f".repeat(64) },
        key,
      ),
    ).rejects.toMatchObject({ status: 409 });
    expect(m.rpc).not.toHaveBeenCalledWith(
      "approve_signing_request_with_placement",
      expect.anything(),
    );
    expect(m.render).not.toHaveBeenCalled();
  });
  it("does not download a source for a user without the invitation", async () => {
    m.replies.signing_requests = null;
    await expect(
      decideSigningRequest(request, body(), key),
    ).rejects.toMatchObject({ status: 404 });
    expect(m.source).not.toHaveBeenCalled();
    expect(m.rpc).not.toHaveBeenCalled();
  });
  it("does not render or issue UI evidence when database rejects a racing decision", async () => {
    m.rpc.mockImplementation(async (name) =>
      name === "consume_signing_r3_limit"
        ? { data: true, error: null }
        : {
            data: null,
            error: { code: "P0001", message: "SIGNING_REQUEST_NOT_ELIGIBLE" },
          },
    );
    await expect(
      decideSigningRequest(request, body(), key),
    ).rejects.toMatchObject({ status: 409 });
    expect(m.render).not.toHaveBeenCalled();
  });
  it("keeps a committed approval receipt when render preparation fails", async () => {
    m.render.mockRejectedValue(new Error("Synthetic render interruption"));
    const result = await decideSigningRequest(request, body(), key);
    expect(result.receiptId).toBe(receipt);
    expect(result.artifactState).toBe("pending");
  });
  it("replays a committed rejection without restoring source access or creating QR", async () => {
    m.replies.signing_decisions = { id: decisionId };
    m.rpc.mockImplementation(async (name) =>
      name === "consume_signing_r3_limit"
        ? { data: true, error: null }
        : {
            data: {
              decisionId,
              requestId: request,
              sourceVersionId: version,
              action: "reject",
              reason: "Tidak sesuai",
              receiptId: null,
              decidedAt: "2026-11-10T01:00:00.000Z",
            },
            error: null,
          },
    );
    const result = await decideSigningRequest(
      request,
      rejectionBody(" Tidak sesuai "),
      key,
    );
    expect(result.receiptId).toBeNull();
    expect(m.source).not.toHaveBeenCalled();
    expect(m.render).not.toHaveBeenCalled();
    expect(m.rpc).toHaveBeenCalledWith(
      "decide_signing_request",
      expect.objectContaining({ p_reason: "Tidak sesuai", p_consent: false }),
    );
  });
  it("does not commit approval when actual geometry rejects the placement", async () => {
    m.inspect.mockRejectedValue(
      new ApiError(422, "INVALID_QR_PLACEMENT", "Pilih area lain."),
    );
    await expect(
      decideSigningRequest(request, body(), key),
    ).rejects.toMatchObject({ status: 422 });
    expect(m.rpc).not.toHaveBeenCalledWith(
      "approve_signing_request_with_placement",
      expect.anything(),
    );
    expect(m.render).not.toHaveBeenCalled();
  });
  it("replays the locked plan without reparsing or moving the immutable source", async () => {
    m.replies.signing_decisions = { id: decisionId, action: "approve" };
    m.outcome.mockResolvedValue({
      decision: { action: "approve" },
      evidence: { placements: plan },
    });
    const result = await decideSigningRequest(request, body(), key);
    expect(result.receiptId).toBe(receipt);
    expect(m.inspect).not.toHaveBeenCalled();
    expect(m.source).not.toHaveBeenCalled();
    expect(m.rpc).toHaveBeenCalledWith(
      "approve_signing_request_with_placement",
      expect.objectContaining({ p_placement_plan: plan }),
    );
  });
  it("rejects a changed placement after approval before privileged mutation", async () => {
    m.replies.signing_decisions = { id: decisionId, action: "approve" };
    m.outcome.mockResolvedValue({
      decision: { action: "approve" },
      evidence: { placements: plan },
    });
    await expect(
      decideSigningRequest(
        request,
        { ...body(), placements: [{ page: 1, x: 0.4, y: 0.2 }] },
        key,
      ),
    ).rejects.toMatchObject({ status: 409 });
    expect(m.rpc).not.toHaveBeenCalledWith(
      "approve_signing_request_with_placement",
      expect.anything(),
    );
  });
  it.each(["", "  ", "x".repeat(1001)])(
    "requires a bounded, nonempty rejection reason",
    async (reason) => {
      await expect(
        decideSigningRequest(request, rejectionBody(reason), key),
      ).rejects.toThrow();
      expect(m.rpc).not.toHaveBeenCalled();
    },
  );
});
