import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Reply = { data: unknown; error: unknown; count?: number | null };
const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  client: vi.fn(),
  from: vi.fn(),
  privileged: vi.fn(),
  replies: [] as Reply[],
  chains: [] as Record<string, ReturnType<typeof vi.fn>>[],
}));
vi.mock("server-only", () => ({}));
vi.mock("@/server/api", () => ({ apiSession: mocks.session }));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: mocks.client,
}));
vi.mock("@/lib/supabase/privileged", () => ({
  createPrivilegedSupabaseClient: mocks.privileged,
}));

import { ApiError } from "@/server/errors";
import {
  getOwnNotifications,
  markOwnNotificationRead,
} from "@/server/notifications";
import { safeNotificationTarget } from "@/lib/notifications/schema";

const owner = "91000000-0000-4000-8000-000000000001";
const other = "91000000-0000-4000-8000-000000000002";
const id = "92000000-0000-4000-8000-000000000001";
const requestId = "93000000-0000-4000-8000-000000000001";
const created = "2026-11-16T01:00:00Z";
const readAt = "2026-11-16T02:00:00Z";
function row(extra: Record<string, unknown> = {}) {
  return {
    id,
    user_id: owner,
    title: "Permintaan persetujuan baru",
    body: "Uji sintetis",
    target_path: `/requests/${requestId}`,
    created_at: created,
    read_at: null,
    ...extra,
  };
}
function reply(data: unknown, count?: number): Reply {
  return { data, error: null, count };
}
function builder() {
  const result = mocks.replies.shift() ?? reply(null);
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  for (const method of ["select", "eq", "is", "order", "limit", "or", "update"])
    chain[method] = vi.fn(() => chain);
  chain.maybeSingle = vi.fn(async () => result);
  chain.then = vi.fn((resolve, reject) =>
    Promise.resolve(result).then(resolve, reject),
  );
  mocks.chains.push(chain);
  return chain;
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date(readAt));
  mocks.replies = [];
  mocks.chains = [];
  mocks.session.mockResolvedValue({
    user: { id: owner, emailConfirmed: true },
    roles: ["user"],
  });
  mocks.client.mockResolvedValue({ from: mocks.from });
  mocks.from.mockImplementation(builder);
});
afterEach(() => vi.useRealTimers());

describe("notification account access and pagination (mocked provider)", () => {
  it.each([
    () => getOwnNotifications({ cursor: "invalid" }),
    () => markOwnNotificationRead("invalid"),
  ])("authenticates before input validation or data access", async (run) => {
    mocks.session.mockRejectedValue(
      new ApiError(401, "UNAUTHENTICATED", "Masuk dahulu."),
    );
    await expect(run()).rejects.toMatchObject({ status: 401 });
    expect(mocks.client).not.toHaveBeenCalled();
    expect(mocks.privileged).not.toHaveBeenCalled();
  });
  it("returns only own display fields and an actual unread count using the cookie client", async () => {
    mocks.replies = [reply([row()]), reply(null, 3)];
    expect(await getOwnNotifications()).toEqual({
      items: [
        {
          id,
          title: "Permintaan persetujuan baru",
          body: "Uji sintetis",
          targetPath: `/requests/${requestId}`,
          createdAt: created,
          readAt: null,
        },
      ],
      unreadCount: 3,
      hasMore: false,
      nextCursor: null,
    });
    expect(mocks.session).toHaveBeenCalledWith("account");
    for (const chain of mocks.chains)
      expect(chain.eq).toHaveBeenCalledWith("user_id", owner);
    expect(mocks.chains[0]!.limit).toHaveBeenCalledWith(21);
    expect(mocks.chains[1]!.select).toHaveBeenCalledWith("id", {
      count: "exact",
      head: true,
    });
    expect(mocks.chains[1]!.is).toHaveBeenCalledWith("read_at", null);
    expect(mocks.privileged).not.toHaveBeenCalled();
  });
  it("keeps a valid empty list distinct from service failure", async () => {
    mocks.replies = [reply([]), reply(null, 0)];
    expect(await getOwnNotifications()).toEqual({
      items: [],
      unreadCount: 0,
      hasMore: false,
      nextCursor: null,
    });
  });
  it.each([
    [reply([row({ user_id: other })]), reply(null, 0)],
    [reply([row({ created_at: "not-a-date" })]), reply(null, 0)],
    [reply([]), reply(null)],
    [reply([]), reply(null, -1)],
    [reply([]), { data: null, error: { message: "secret SQL detail" } }],
    [
      {
        data: null,
        error: { code: "42P01", message: "private schema detail" },
      },
      reply(null, 0),
    ],
  ])(
    "fails closed on cross-owner, malformed, missing-count or failed responses %j",
    async (list, count) => {
      mocks.replies = [list, count];
      await expect(getOwnNotifications()).rejects.toMatchObject({
        code: "NOTIFICATIONS_UNAVAILABLE",
        status: 503,
      });
    },
  );
  it("paginates with bounded timestamp/UUID keysets instead of accepting query fragments", async () => {
    const rows = Array.from({ length: 21 }, (_, index) =>
      row({
        id: `92000000-0000-4000-8000-${(index + 1).toString().padStart(12, "0")}`,
      }),
    );
    mocks.replies = [reply(rows), reply(null, 21)];
    const first = await getOwnNotifications();
    expect(first.items).toHaveLength(20);
    expect(first.hasMore).toBe(true);
    const cursor = JSON.parse(
      Buffer.from(first.nextCursor!, "base64url").toString(),
    );
    expect(cursor).toEqual({ at: created, id: rows[19]!.id });
    mocks.replies = [reply([rows[20]]), reply(null, 21)];
    const next = await getOwnNotifications({ cursor: first.nextCursor });
    expect(next.items).toHaveLength(1);
    expect(mocks.chains[2]!.or).toHaveBeenCalledWith(
      `created_at.lt.${created},and(created_at.eq.${created},id.lt.${rows[19]!.id})`,
    );
  });
  it.each([
    { userId: other },
    { cursor: "!unsafe" },
    { cursor: "" },
    {
      cursor: Buffer.from(
        JSON.stringify({ at: "x),user_id.eq.other", id }),
      ).toString("base64url"),
    },
  ])(
    "rejects injected authority or cursors before querying %j",
    async (parameters) => {
      await expect(getOwnNotifications(parameters)).rejects.toMatchObject({
        status: 422,
      });
      expect(mocks.from).not.toHaveBeenCalled();
    },
  );
  it("lets an admin read only their own notifications without user workspace links", async () => {
    mocks.session.mockResolvedValue({
      user: { id: owner },
      roles: ["user", "platform_admin"],
    });
    mocks.replies = [reply([row()]), reply(null, 1)];
    const result = await getOwnNotifications();
    expect(result.items[0]!.targetPath).toBeNull();
    for (const chain of mocks.chains)
      expect(chain.eq).toHaveBeenCalledWith("user_id", owner);
    expect(mocks.privileged).not.toHaveBeenCalled();
  });
});

describe("mark only an owned notification read", () => {
  it("writes only server read_at, conditional on owner, id and currently unread state", async () => {
    mocks.replies = [reply(row()), reply(row({ read_at: readAt }))];
    expect(await markOwnNotificationRead(id)).toEqual({ id, readAt });
    expect(mocks.chains[1]!.update).toHaveBeenCalledWith({
      read_at: new Date(readAt).toISOString(),
    });
    expect(mocks.chains[1]!.eq).toHaveBeenCalledWith("id", id);
    expect(mocks.chains[1]!.eq).toHaveBeenCalledWith("user_id", owner);
    expect(mocks.chains[1]!.is).toHaveBeenCalledWith("read_at", null);
    expect(mocks.privileged).not.toHaveBeenCalled();
  });
  it("preserves the original read timestamp on retry", async () => {
    mocks.replies = [reply(row({ read_at: created }))];
    expect(await markOwnNotificationRead(id)).toEqual({ id, readAt: created });
    expect(mocks.chains[0]!.update).not.toHaveBeenCalled();
  });
  it("returns the committed timestamp when another tab wins the update", async () => {
    mocks.replies = [
      reply(row()),
      reply(null),
      reply(row({ read_at: created })),
    ];
    expect(await markOwnNotificationRead(id)).toEqual({ id, readAt: created });
    expect(mocks.chains).toHaveLength(3);
  });
  it("returns generic404 for missing or inaccessible notifications without mutation", async () => {
    mocks.replies = [reply(null)];
    await expect(markOwnNotificationRead(id)).rejects.toMatchObject({
      status: 404,
      code: "NOT_FOUND",
    });
    expect(mocks.chains[0]!.update).not.toHaveBeenCalled();
  });
  it.each([row({ user_id: other }), row({ id: requestId })])(
    "rejects an out-of-scope provider row %j",
    async (record) => {
      mocks.replies = [reply(record)];
      await expect(markOwnNotificationRead(id)).rejects.toMatchObject({
        status: 503,
      });
      expect(mocks.chains[0]!.update).not.toHaveBeenCalled();
    },
  );
  it("does not report success when the write fails", async () => {
    mocks.replies = [
      reply(row()),
      { data: null, error: { message: "private database error" } },
    ];
    await expect(markOwnNotificationRead(id)).rejects.toMatchObject({
      status: 503,
      code: "NOTIFICATIONS_UNAVAILABLE",
    });
  });
});

describe("notification targets", () => {
  it.each([`/requests/${requestId}`, `/documents/${id}`])(
    "permits a specific internal target %s",
    (path) => {
      expect(safeNotificationTarget(path)).toBe(path);
    },
  );
  it.each([
    null,
    "https://attacker.example",
    "//attacker.example",
    "javascript:alert(1)",
    "/admin/overview",
    `/requests/${requestId}?redirect=https://attacker.example`,
    "/requests/../admin",
    `/requests/${requestId}#token`,
    "/requests/%2F%2Fevil",
  ])("drops unsafe or unrelated targets %j", (path) => {
    expect(safeNotificationTarget(path)).toBeNull();
  });
});
