import { beforeEach, describe, it, expect, vi } from "vitest";
import { NextRequest } from "next/server";
const m = vi.hoisted(() => ({
  env: vi.fn(),
  client: vi.fn(),
  getUser: vi.fn(),
}));
vi.mock("@/lib/env/public", () => ({ getPublicEnv: m.env }));
vi.mock("@supabase/ssr", () => ({ createServerClient: m.client }));
import { proxy } from "@/proxy";
beforeEach(() => {
  vi.resetAllMocks();
  m.env.mockReturnValue({
    supabaseUrl: "https://synthetic.supabase.co",
    supabasePublishableKey: "sb_publishable_synthetic",
  });
  m.client.mockReturnValue({ auth: { getUser: m.getUser } });
  m.getUser.mockResolvedValue({ data: { user: null }, error: null });
});
describe("S-19 public receipt landing page versus private routes", () => {
  it.each(["R".repeat(43), "invalid-token"])(
    "allows the QR landing page without Auth calls or login redirects (%s)",
    async (id) => {
      const req = new NextRequest(`http://127.0.0.1:3000/receipts/${id}`, {
        headers: { cookie: "invalid-auth-cookie=expired" },
      });
      const result = await proxy(req);
      expect(result.headers.get("location")).toBeNull();
      expect(result.headers.get("cache-control")).toContain("no-store");
      expect(m.env).not.toHaveBeenCalled();
      expect(m.getUser).not.toHaveBeenCalled();
    },
  );
  it.each([
    `/receipts/${"R".repeat(43)}/details`,
    `/receipts/${"R".repeat(43)}/private`,
    `/requests/${"R".repeat(43)}`,
  ])("still requires login for %s", async (path) => {
    const result = await proxy(new NextRequest(`http://127.0.0.1:3000${path}`));
    expect(new URL(result.headers.get("location")!).pathname).toBe("/login");
    expect(m.getUser).toHaveBeenCalledTimes(1);
  });
  it.each(["", "/file", "/render"])(
    "keeps private receipt API%s unavailable to a guest",
    async (suffix) => {
      const result = await proxy(
        new NextRequest(
          `http://127.0.0.1:3000/api/v2/signing-receipts/${"R".repeat(43)}${suffix}`,
        ),
      );
      expect(result.status).toBe(401);
      expect((await result.json()).error.code).toBe("UNAUTHENTICATED");
    },
  );
});
