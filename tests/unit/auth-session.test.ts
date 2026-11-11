import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getPublicEnv: vi.fn(),
  createSupabaseServerClient: vi.fn(),
  getUser: vi.fn(),
  from: vi.fn(),
  redirect: vi.fn((value: string): never => {
    throw new Error(`NEXT_REDIRECT:${value}`);
  }),
  proxyCreateClient: vi.fn(),
  proxyGetUser: vi.fn(),
  roles: { data: [{ role: "user" }], error: null } as {
    data: { role: string }[] | null;
    error: unknown;
  },
  profile: { data: { full_name: "Verified profile name" }, error: null } as {
    data: { full_name: string | null } | null;
    error: unknown;
  },
  ownerFilters: [] as { table: string; field: string; id: string }[],
  proxyCookies: undefined as
    | undefined
    | {
        setAll: (
          cookies: {
            name: string;
            value: string;
            options: {
              path: string;
              secure?: boolean;
              httpOnly?: boolean;
              sameSite?: "lax";
            };
          }[],
          headers: Record<string, string>,
        ) => void;
      },
}));

vi.mock("server-only", () => ({}));
vi.mock("react", () => ({ cache: (callback: unknown) => callback }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/env/public", () => ({ getPublicEnv: mocks.getPublicEnv }));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: mocks.createSupabaseServerClient,
}));
vi.mock("@supabase/ssr", () => ({
  createServerClient: mocks.proxyCreateClient,
}));

import {
  AuthAvailabilityError,
  getAuthSession,
  requireAdminWorkspace,
  requireAuthenticated,
  requirePlatformAdmin,
  requireUserWorkspace,
  requireReviewer,
  requireVerifiedEmail,
} from "@/lib/auth/session";
import { proxy } from "../../src/proxy";

function authUser(confirmed = true) {
  return {
    id: "10000000-0000-4000-8000-000000000001",
    email: "owner@example.test",
    email_confirmed_at: confirmed ? "2026-11-03T00:00:00Z" : null,
    user_metadata: {
      role: "platform_admin",
      roles: ["reviewer"],
      full_name: "Spoofed metadata name",
    },
    app_metadata: { role: "platform_admin" },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getPublicEnv.mockImplementation(() => ({
    supabaseUrl: "https://project.supabase.co",
    supabasePublishableKey: "sb_publishable_test_placeholder",
  }));
  mocks.getUser.mockResolvedValue({ data: { user: authUser() }, error: null });
  mocks.proxyGetUser.mockResolvedValue({ data: { user: null }, error: null });
  mocks.roles = { data: [{ role: "user" }], error: null };
  mocks.profile = { data: { full_name: "Verified profile name" }, error: null };
  mocks.ownerFilters = [];
  mocks.proxyCookies = undefined;
  mocks.from.mockImplementation((table: string) => ({
    select: () => ({
      eq: (field: string, id: string) => {
        mocks.ownerFilters.push({ table, field, id });
        return table === "user_roles"
          ? Promise.resolve(mocks.roles)
          : { maybeSingle: () => Promise.resolve(mocks.profile) };
      },
    }),
  }));
  mocks.createSupabaseServerClient.mockResolvedValue({
    auth: { getUser: mocks.getUser },
    from: mocks.from,
  });
  mocks.proxyCreateClient.mockImplementation(
    (
      _url: string,
      _key: string,
      options: { cookies: typeof mocks.proxyCookies },
    ) => {
      mocks.proxyCookies = options.cookies;
      return { auth: { getUser: mocks.proxyGetUser } };
    },
  );
});

describe("verified server auth context", () => {
  it("uses the Auth server identity and own database roles, not metadata roles", async () => {
    const session = await getAuthSession();
    expect(session).toEqual({
      user: {
        id: authUser().id,
        email: "owner@example.test",
        emailConfirmed: true,
        fullName: "Verified profile name",
      },
      roles: ["user"],
    });
    expect(mocks.getUser).toHaveBeenCalledOnce();
    expect(mocks.ownerFilters).toEqual([
      { table: "user_roles", field: "user_id", id: authUser().id },
      { table: "profiles", field: "id", id: authUser().id },
    ]);
    expect(JSON.stringify(session)).not.toMatch(
      /access_token|refresh_token|Spoofed/,
    );
  });
  it("treats an unconfigured installation as unauthenticated", async () => {
    mocks.getPublicEnv.mockImplementation(() => {
      throw new Error("missing configuration");
    });
    expect(await getAuthSession()).toBeNull();
    expect(mocks.createSupabaseServerClient).not.toHaveBeenCalled();
  });
  it("does not query roles for a forged or invalid session", async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: null },
      error: { name: "AuthApiError", status: 401 },
    });
    expect(await getAuthSession()).toBeNull();
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it("does not persist an identity between calls outside a render", async () => {
    const first = await getAuthSession();
    mocks.getUser.mockResolvedValue({
      data: {
        user: { ...authUser(), id: "10000000-0000-4000-8000-000000000002" },
      },
      error: null,
    });
    const second = await getAuthSession();
    expect(first?.user.id).not.toBe(second?.user.id);
    expect(mocks.createSupabaseServerClient).toHaveBeenCalledTimes(2);
  });
  it.each(["roles", "profile"] as const)(
    "fails closed for %s query errors without exposing SQL details",
    async (target) => {
      mocks[target] = {
        data: null,
        error: { message: "SQL details and secret must not be exposed" },
      };
      await expect(getAuthSession()).rejects.toThrow(AuthAvailabilityError);
      await expect(getAuthSession()).rejects.not.toThrow("SQL details");
    },
  );
  it("fails closed if the identity has no assigned application role", async () => {
    mocks.roles = { data: [], error: null };
    await expect(getAuthSession()).rejects.toThrow(AuthAvailabilityError);
  });
  it("reports provider outages without turning cached metadata into identity", async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: authUser() },
      error: { name: "AuthRetryableFetchError", status: 503 },
    });
    await expect(getAuthSession()).rejects.toThrow(AuthAvailabilityError);
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it("omits absent optional email and profile name fields", async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: { id: authUser().id, email_confirmed_at: null } },
      error: null,
    });
    mocks.profile = { data: { full_name: null }, error: null };
    expect(await getAuthSession()).toEqual({
      user: { id: authUser().id, emailConfirmed: false },
      roles: ["user"],
    });
  });
});

describe("server page and action guards", () => {
  it("keeps admin accounts in the admin workspace while retaining shared account access", async () => {
    mocks.roles = {
      data: [{ role: "user" }, { role: "platform_admin" }],
      error: null,
    };
    await expect(requireUserWorkspace("/signing/documents")).rejects.toThrow(
      "NEXT_REDIRECT:/admin/overview",
    );
    await expect(requireVerifiedEmail("/signing/new")).rejects.toThrow(
      "NEXT_REDIRECT:/admin/overview",
    );
    expect((await requireAuthenticated("/profile")).roles).toContain(
      "platform_admin",
    );
  });
  it("allows ordinary users into their workspace without granting admin access", async () => {
    expect((await requireUserWorkspace("/documents")).roles).toEqual(["user"]);
    await expect(requirePlatformAdmin()).rejects.toThrow(
      "NEXT_REDIRECT:/access-denied",
    );
  });
  it("denies monitoring to a reviewer without the platform role", async () => {
    mocks.roles = {
      data: [{ role: "user" }, { role: "reviewer" }],
      error: null,
    };
    await expect(requirePlatformAdmin("/admin/operations")).rejects.toThrow(
      "NEXT_REDIRECT:/access-denied",
    );
  });
  it("allows monitoring for a verified platform admin without granting reviewer rights", async () => {
    mocks.roles = { data: [{ role: "platform_admin" }], error: null };
    expect((await requirePlatformAdmin()).roles).toEqual(["platform_admin"]);
    await expect(requireReviewer()).rejects.toThrow(
      "NEXT_REDIRECT:/access-denied",
    );
  });
  it("requires verified email before opening monitoring", async () => {
    mocks.roles = { data: [{ role: "platform_admin" }], error: null };
    mocks.getUser.mockResolvedValue({
      data: { user: authUser(false) },
      error: null,
    });
    await expect(requirePlatformAdmin("/admin/operations")).rejects.toThrow(
      "NEXT_REDIRECT:/verify-email?next=%2Fadmin%2Foperations",
    );
  });
  it("retains the private monitoring destination when a guest must log in", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });
    await expect(requirePlatformAdmin("/admin/operations")).rejects.toThrow(
      "NEXT_REDIRECT:/login?next=%2Fadmin%2Foperations",
    );
  });
  it("redirects anonymous users with a sanitized return path", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });
    await expect(
      requireAuthenticated("/documents?status=approved"),
    ).rejects.toThrow(
      "NEXT_REDIRECT:/login?next=%2Fdocuments%3Fstatus%3Dapproved",
    );
    await expect(requireAuthenticated("//attacker.example")).rejects.toThrow(
      "NEXT_REDIRECT:/login?next=%2Fdashboard",
    );
  });
  it("denies reviewer access to an ordinary user or platform administrator alone", async () => {
    await expect(requireReviewer()).rejects.toThrow(
      "NEXT_REDIRECT:/access-denied",
    );
    mocks.roles = {
      data: [{ role: "user" }, { role: "platform_admin" }],
      error: null,
    };
    await expect(requireReviewer()).rejects.toThrow(
      "NEXT_REDIRECT:/access-denied",
    );
  });
  it("allows reviewer access only with the authoritative reviewer role", async () => {
    mocks.roles = {
      data: [{ role: "user" }, { role: "reviewer" }],
      error: null,
    };
    expect((await requireReviewer()).roles).toContain("reviewer");
  });
  it("permits admin overview for an admin without granting review capability", async () => {
    mocks.roles = {
      data: [{ role: "user" }, { role: "platform_admin" }],
      error: null,
    };
    expect((await requireAdminWorkspace()).roles).toContain("platform_admin");
    await expect(requireReviewer()).rejects.toThrow(
      "NEXT_REDIRECT:/access-denied",
    );
  });
  it("denies admin overview to ordinary users", async () => {
    await expect(requireAdminWorkspace()).rejects.toThrow(
      "NEXT_REDIRECT:/access-denied",
    );
  });
  it("requires provider-confirmed email when the caller applies that policy", async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: authUser(false) },
      error: null,
    });
    await expect(requireVerifiedEmail()).rejects.toThrow(
      "NEXT_REDIRECT:/verify-email?next=%2Fsubmit",
    );
    mocks.getUser.mockResolvedValue({
      data: { user: authUser() },
      error: null,
    });
    expect((await requireVerifiedEmail()).user.emailConfirmed).toBe(true);
  });
});

describe("session refresh proxy", () => {
  it("redirects a forged or absent private session without trusting cookies", async () => {
    const response = await proxy(
      new NextRequest("https://app.example.test/documents", {
        headers: { cookie: "sb-test-auth-token=forged" },
      }),
    );
    expect(response.status).toBe(307);
    expect(new URL(response.headers.get("location")!).pathname).toBe("/login");
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(response.headers.get("vary")).toContain("Cookie");
    expect(mocks.proxyGetUser).toHaveBeenCalledOnce();
  });
  it("keeps public auth screens available when backend configuration is absent", async () => {
    mocks.getPublicEnv.mockImplementation(() => {
      throw new Error("missing config");
    });
    const login = await proxy(
      new NextRequest("https://app.example.test/login"),
    );
    expect(login.headers.get("location")).toBeNull();
    const privatePage = await proxy(
      new NextRequest("https://app.example.test/admin/overview"),
    );
    expect(new URL(privatePage.headers.get("location")!).pathname).toBe(
      "/login",
    );
    expect(mocks.proxyCreateClient).not.toHaveBeenCalled();
  });
  it("preserves refreshed cookies on the request and redirected response", async () => {
    mocks.proxyGetUser.mockImplementation(async () => {
      mocks.proxyCookies!.setAll(
        [
          {
            name: "sb-test-auth-token",
            value: "refreshed",
            options: {
              path: "/",
              secure: true,
              httpOnly: false,
              sameSite: "lax",
            },
          },
        ],
        {
          "Cache-Control": "private, no-store",
          Expires: "0",
          Pragma: "no-cache",
        },
      );
      return { data: { user: null }, error: null };
    });
    const request = new NextRequest("https://app.example.test/dashboard");
    const response = await proxy(request);
    expect(request.cookies.get("sb-test-auth-token")?.value).toBe("refreshed");
    expect(response.cookies.get("sb-test-auth-token")).toMatchObject({
      value: "refreshed",
      secure: true,
      httpOnly: false,
      sameSite: "lax",
    });
    expect(response.headers.get("pragma")).toBe("no-cache");
    expect(response.headers.get("expires")).toBe("0");
  });
  it("passes a verified user through without trusting a role header", async () => {
    mocks.proxyGetUser.mockResolvedValue({
      data: { user: authUser() },
      error: null,
    });
    const response = await proxy(
      new NextRequest("https://app.example.test/admin/overview", {
        headers: { "x-user-role": "platform_admin" },
      }),
    );
    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(response.headers.get("location")).toBeNull();
    // Role authorization remains in the independently tested page/DAL guard.
    await expect(requireAdminWorkspace()).rejects.toThrow(
      "NEXT_REDIRECT:/access-denied",
    );
  });
  it("returns JSON 401 for private API requests rather than a login document", async () => {
    const response = await proxy(
      new NextRequest("https://app.example.test/api/v1/me"),
    );
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({
      error: { code: "UNAUTHENTICATED" },
    });
  });
  it("fails closed on provider outages and does not expose upstream errors", async () => {
    mocks.proxyGetUser.mockRejectedValue(new Error("upstream secret details"));
    const page = await proxy(
      new NextRequest("https://app.example.test/dashboard"),
    );
    expect(
      new URL(page.headers.get("location")!).searchParams.get("error"),
    ).toBe("auth_unavailable");
    const api = await proxy(
      new NextRequest("https://app.example.test/api/v1/me"),
    );
    expect(api.status).toBe(503);
    expect(JSON.stringify(await api.json())).not.toContain(
      "upstream secret details",
    );
  });
});
