import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  origin: vi.fn(),
  list: vi.fn(),
  read: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/config", () => ({ getAppOrigin: mocks.origin }));
vi.mock("@/lib/auth/session", async (original) => ({
  ...(await original<typeof import("@/lib/auth/session")>()),
  getAuthSession: mocks.session,
}));
vi.mock("@/server/notifications", () => ({
  getOwnNotifications: mocks.list,
  markOwnNotificationRead: mocks.read,
}));
import { GET } from "@/app/api/v1/notifications/route";
import { PATCH } from "@/app/api/v1/notifications/[notificationId]/read/route";
import { ApiError } from "@/server/errors";

const origin = "https://prototype.example.invalid";
const id = "94000000-0000-4000-8000-000000000001";
const context = { params: Promise.resolve({ notificationId: id }) };
function patch(body: unknown = {}, requestOrigin: string | null = origin) {
  return new Request(`${origin}/api/v1/notifications/${id}/read`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...(requestOrigin ? { origin: requestOrigin } : {}),
    },
    body: JSON.stringify(body),
  });
}
function assertPrivate(response: Response, status: number) {
  expect(response.status).toBe(status);
  expect(response.headers.get("cache-control")).toContain("no-store");
  expect(response.headers.get("vary")).toContain("Cookie");
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.origin.mockReturnValue(origin);
  mocks.session.mockResolvedValue({
    user: { id, emailConfirmed: true },
    roles: ["user"],
  });
  mocks.list.mockResolvedValue({
    items: [],
    unreadCount: 0,
    nextCursor: null,
    hasMore: false,
  });
  mocks.read.mockResolvedValue({ id, readAt: "2026-11-16T02:00:00Z" });
});
describe("private own-account notification HTTP endpoints", () => {
  it("returns a private real empty result and forwards only a cursor", async () => {
    const response = await GET(
      new Request(`${origin}/api/v1/notifications?cursor=opaque`),
    );
    assertPrivate(response, 200);
    expect(mocks.list).toHaveBeenCalledWith({ cursor: "opaque" });
    expect((await response.json()).data.unreadCount).toBe(0);
  });
  it.each(["?user_id=foreign", "?unreadCount=0", "?cursor=a&cursor=b"])(
    "rejects authority injection and ambiguous filters %s",
    async (query) => {
      assertPrivate(
        await GET(new Request(`${origin}/api/v1/notifications${query}`)),
        422,
      );
      expect(mocks.list).not.toHaveBeenCalled();
    },
  );
  it("authenticates both endpoints before validation or service access", async () => {
    mocks.session.mockResolvedValue(null);
    assertPrivate(
      await GET(new Request(`${origin}/api/v1/notifications?user_id=foreign`)),
      401,
    );
    assertPrivate(
      await PATCH(
        patch({ userId: "forged" }, "https://attacker.example"),
        context,
      ),
      401,
    );
    expect(mocks.list).not.toHaveBeenCalled();
    expect(mocks.read).not.toHaveBeenCalled();
  });
  it.each([null, "https://attacker.example"])(
    "rejects missing or foreign mutation Origin %j",
    async (value) => {
      assertPrivate(await PATCH(patch({}, value), context), 403);
      expect(mocks.read).not.toHaveBeenCalled();
    },
  );
  it.each([
    { userId: "forged" },
    { readAt: "2020-01-01" },
    { title: "rewritten" },
  ])("rejects client authority and metadata writes %j", async (body) => {
    assertPrivate(await PATCH(patch(body), context), 422);
    expect(mocks.read).not.toHaveBeenCalled();
  });
  it("marks exactly the route notification read without client timestamps", async () => {
    const response = await PATCH(patch(), context);
    assertPrivate(response, 200);
    expect(mocks.read).toHaveBeenCalledExactlyOnceWith(id);
    expect((await response.json()).data.id).toBe(id);
  });
  it("bounds mutation JSON", async () => {
    assertPrivate(
      await PATCH(patch({ padding: "x".repeat(5000) }), context),
      413,
    );
    expect(mocks.read).not.toHaveBeenCalled();
  });
  it.each(["platform_admin", "reviewer"])(
    "supports own account notifications for %s without requesting user business scope",
    async (role) => {
      mocks.session.mockResolvedValue({ user: { id }, roles: [role] });
      assertPrivate(
        await GET(new Request(`${origin}/api/v1/notifications`)),
        200,
      );
    },
  );
  it("preserves a generic foreign404 and never echoes provider errors", async () => {
    mocks.read.mockRejectedValue(
      new ApiError(404, "NOT_FOUND", "Notifikasi tidak ditemukan."),
    );
    const missing = await PATCH(patch(), context);
    assertPrivate(missing, 404);
    expect(JSON.stringify(await missing.json())).not.toContain(id);
    mocks.list.mockRejectedValue(new Error("private SQL detail and secret"));
    const failure = await GET(new Request(`${origin}/api/v1/notifications`));
    assertPrivate(failure, 500);
    expect(JSON.stringify(await failure.json())).not.toMatch(
      /private SQL|secret/,
    );
  });
});
