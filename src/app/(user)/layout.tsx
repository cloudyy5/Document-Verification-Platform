import { WorkspaceShell } from "@/components/layout/workspace-shell";
import { requireAuthenticated } from "@/lib/auth/session";
import { isAdminAccount } from "@/lib/auth/workspace";

export const dynamic = "force-dynamic";

export default async function UserLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireAuthenticated();
  return (
    <WorkspaceShell
      workspace={isAdminAccount(session.roles) ? "admin" : "user"}
      user={{
        name: session.user.fullName ?? session.user.email ?? "Akun Anda",
        email: session.user.email,
        emailConfirmed: session.user.emailConfirmed,
        roles: session.roles,
      }}
    >
      {children}
    </WorkspaceShell>
  );
}
