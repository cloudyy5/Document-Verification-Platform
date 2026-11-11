import type { AnchorHTMLAttributes } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { AppRole } from "@/types/database";

vi.mock("next/navigation", () => ({ usePathname: () => "/profile" }));
vi.mock("next/link", () => ({
  default: (props: AnchorHTMLAttributes<HTMLAnchorElement>) => <a {...props} />,
}));
vi.mock("@/app/(user)/profile/actions", () => ({
  updateProfileAction: vi.fn(),
}));
vi.mock("@/components/theme-switcher", () => ({
  ThemeSwitcher: () => <button>Tema akun</button>,
}));
vi.mock("@/features/signing/own-code-card", () => ({
  OwnCodeCard: () => <section>Kode untuk permintaan persetujuan</section>,
}));

import { AppSidebar } from "@/components/layout/sidebar";
import { WorkspaceProfile } from "@/features/workspace/profile-form";

describe("role-specific workspace navigation", () => {
  it.each([
    { roles: ["platform_admin"] as AppRole[] },
    { roles: ["user", "platform_admin"] as AppRole[] },
    { roles: ["user", "reviewer", "platform_admin"] as AppRole[] },
  ])(
    "never offers an admin a user workspace switch for $roles",
    ({ roles }) => {
      const html = renderToStaticMarkup(
        <AppSidebar
          workspace="admin"
          user={{ name: "Uji lokal", emailConfirmed: true, roles }}
        />,
      );
      expect(html).toContain('href="/admin/overview"');
      expect(html).toContain('href="/profile"');
      expect(html).not.toContain('href="/signing/documents"');
      expect(html).not.toContain("Workspace lain");
      expect(html).not.toContain("User Workspace");
    },
  );
  it("keeps ordinary user navigation and omits an admin switch", () => {
    const html = renderToStaticMarkup(
      <AppSidebar
        workspace="user"
        user={{ name: "Uji lokal", emailConfirmed: true, roles: ["user"] }}
      />,
    );
    expect(html).toContain('href="/signing/documents"');
    expect(html).not.toContain('href="/admin/overview"');
  });
  it("keeps profile preferences in the admin workspace without a signing code card", () => {
    const profile = {
      fullName: "Uji lokal",
      phone: null,
      createdAt: "2026-11-11T08:00:00Z",
      email: "synthetic@example.invalid",
      emailConfirmed: true,
    };
    const admin = renderToStaticMarkup(
      <WorkspaceProfile profile={profile} workspace="admin" />,
    );
    const user = renderToStaticMarkup(
      <WorkspaceProfile profile={profile} workspace="user" />,
    );
    expect(admin).toContain("Admin workspace");
    expect(admin).toContain("Tema akun");
    expect(admin).not.toContain("Kode untuk permintaan persetujuan");
    expect(user).toContain("Kode untuk permintaan persetujuan");
  });
});
