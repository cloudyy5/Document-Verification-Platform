import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({
  session: vi.fn(),
  origin: vi.fn(),
  decide: vi.fn(),
  outcome: vi.fn(),
  evidence: vi.fn(),
  render: vi.fn(),
  file: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/config", () => ({ getAppOrigin: m.origin }));
vi.mock("@/lib/auth/session", async (original) => ({
  ...(await original<typeof import("@/lib/auth/session")>()),
  getAuthSession: m.session,
}));
vi.mock("@/server/signing/decisions", () => ({
  decideSigningRequest: m.decide,
}));
vi.mock("@/server/signing/evidence", () => ({
  getSigningOutcome: m.outcome,
  getSigningEvidence: m.evidence,
}));
vi.mock("@/server/signing/artifacts", () => ({
  renderSigningEvidence: m.render,
  serveSigningResult: m.file,
}));
import { POST as decide } from "@/app/api/v2/signing-requests/[requestId]/decisions/route";
import { GET as outcome } from "@/app/api/v2/signing-requests/[requestId]/decision/route";
import { GET as receipt } from "@/app/api/v2/signing-receipts/[receiptId]/route";
import { POST as render } from "@/app/api/v2/signing-receipts/[receiptId]/render/route";
import { GET as file } from "@/app/api/v2/signing-receipts/[receiptId]/file/route";
import { SIGNING_ACTION_POLICY_VERSION } from "@/lib/signing/policy";
import { ApiError } from "@/server/errors";
const origin = "http://127.0.0.1:3000",
  requestId = "71000000-0000-4000-8000-000000000001",
  receiptId = "R".repeat(43),
  key = "72000000-0000-4000-8000-000000000001";
const requestContext = () => ({ params: Promise.resolve({ requestId }) });
const receiptContext = () => ({ params: Promise.resolve({ receiptId }) });
const body = () => ({
  action: "approve",
  sourceVersionId: "73000000-0000-4000-8000-000000000001",
  sourceSha256: "a".repeat(64),
  policyVersion: SIGNING_ACTION_POLICY_VERSION,
  consent: true,
  confirmed: true,
  placementVersion: "per-page-draggable-web-evidence-v2",
  placements: [{ page: 1, x: 0.1, y: 0.2 }],
});
function post(
  data: unknown = body(),
  requestOrigin: string | null = origin,
  idempotency: string | null = key,
) {
  return new Request(
    `${origin}/api/v2/signing-requests/${requestId}/decisions`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(requestOrigin === null ? {} : { origin: requestOrigin }),
        ...(idempotency === null ? {} : { "idempotency-key": idempotency }),
      },
      body: JSON.stringify(data),
    },
  );
}
function check(response: Response, status: number) {
  expect(response.status).toBe(status);
  expect(response.headers.get("cache-control")).toContain("no-store");
  expect(response.headers.get("vary")?.toLowerCase()).toContain("cookie");
}
beforeEach(() => {
  vi.resetAllMocks();
  m.origin.mockReturnValue(origin);
  m.session.mockResolvedValue({
    user: { id: requestId, emailConfirmed: true },
    roles: ["user"],
  });
  m.decide.mockResolvedValue({ receiptId, artifactState: "pending" });
  m.outcome.mockResolvedValue({ decision: null, evidence: null });
  m.evidence.mockResolvedValue(null);
  m.render.mockResolvedValue("processing");
});
describe("R3 real HTTP handlers, domain/provider mocked", () => {
  it.each(["decision", "render"])(
    "authenticates before reading %s input or checking Origin",
    async (operation) => {
      m.session.mockResolvedValue(null);
      const input = post();
      const response =
        operation === "decision"
          ? await decide(input, requestContext())
          : await render(input, receiptContext());
      check(response, 401);
      expect(input.bodyUsed).toBe(false);
      expect(m.origin).not.toHaveBeenCalled();
      expect(m.decide).not.toHaveBeenCalled();
      expect(m.render).not.toHaveBeenCalled();
    },
  );
  it.each([
    null,
    "null",
    "https://attacker.example",
    `${origin}.attacker.example`,
  ])(
    "rejects hostile or absent Origin %s before side effects",
    async (value) => {
      for (const operation of ["decision", "render"]) {
        const input = post(body(), value);
        const response =
          operation === "decision"
            ? await decide(input, requestContext())
            : await render(input, receiptContext());
        check(response, 403);
        expect(input.bodyUsed).toBe(false);
      }
      expect(m.decide).not.toHaveBeenCalled();
      expect(m.render).not.toHaveBeenCalled();
    },
  );
  it.each([null, "forged"])(
    "requires an idempotency key before consuming decision JSON (%s)",
    async (value) => {
      const input = post(body(), origin, value);
      check(await decide(input, requestContext()), 400);
      expect(input.bodyUsed).toBe(false);
      expect(m.decide).not.toHaveBeenCalled();
    },
  );
  it.each([
    { actor_id: requestId },
    { status: "completed" },
    { confirmed: false },
    { consent: false },
    { password: "not-requested" },
    { action: "reject", consent: false, reason: " " },
    { action: "reject", consent: false, reason: "x".repeat(1001) },
  ])("rejects unapproved authority/consent/rejection input", async (extra) => {
    check(await decide(post({ ...body(), ...extra }), requestContext()), 422);
    expect(m.decide).not.toHaveBeenCalled();
  });
  it("bounds JSON bytes before invoking the decision service", async () => {
    check(
      await decide(
        post({ ...body(), extra: "x".repeat(256 * 1024 + 1) }),
        requestContext(),
      ),
      413,
    );
    expect(m.decide).not.toHaveBeenCalled();
  });
  it("forwards only validated explicit confirmation with an awaited request ID", async () => {
    const response = await decide(post(), requestContext());
    check(response, 201);
    expect(m.decide).toHaveBeenCalledExactlyOnceWith(requestId, body(), key);
    expect((await response.json()).data.artifactState).toBe("pending");
  });
  it("normalizes a required private rejection reason", async () => {
    const input = {
      sourceVersionId: body().sourceVersionId,
      sourceSha256: body().sourceSha256,
      confirmed: true,
      policyVersion: body().policyVersion,
      action: "reject",
      consent: false,
      reason: "  Tidak sesuai  ",
    };
    check(await decide(post(input), requestContext()), 201);
    expect(m.decide).toHaveBeenCalledWith(
      requestId,
      { ...input, reason: "Tidak sesuai" },
      key,
    );
  });
  it("does not use render JSON as identity or storage authority", async () => {
    const input = post({
      actor_id: requestId,
      storage_path: "forged",
      state: "ready",
    });
    const response = await render(input, receiptContext());
    check(response, 200);
    expect(m.render).toHaveBeenCalledExactlyOnceWith(receiptId);
    expect(input.bodyUsed).toBe(false);
    expect((await response.json()).data).toEqual({ state: "processing" });
  });
  it.each(["outcome", "receipt", "file"])(
    "requires a session for private %s reads",
    async (operation) => {
      m.session.mockResolvedValue(null);
      const input = new Request(origin);
      const response =
        operation === "outcome"
          ? await outcome(input, requestContext())
          : operation === "receipt"
            ? await receipt(input, receiptContext())
            : await file(input, receiptContext());
      check(response, 401);
      expect(m.outcome).not.toHaveBeenCalled();
      expect(m.evidence).not.toHaveBeenCalled();
      expect(m.file).not.toHaveBeenCalled();
    },
  );
  it("hides unavailable receipts without echoing the identifier", async () => {
    const response = await receipt(new Request(origin), receiptContext());
    check(response, 404);
    expect(await response.text()).not.toContain(receiptId);
  });
  it("keeps safe errors and redacts unexpected storage/provider details", async () => {
    m.decide.mockRejectedValueOnce(
      new ApiError(409, "VERSION_CONFLICT", "Muat ulang versi."),
    );
    check(await decide(post(), requestContext()), 409);
    m.decide.mockRejectedValueOnce(
      new Error("synthetic-secret storage_path claimToken SQL"),
    );
    const response = await decide(post(), requestContext());
    check(response, 500);
    expect(await response.text()).not.toMatch(
      /synthetic-secret|storage_path|claimToken|SQL|stack/,
    );
  });
});
