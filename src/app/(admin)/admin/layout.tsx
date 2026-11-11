import { WorkspaceShell } from "@/components/layout/workspace-shell";
import { requireAdminWorkspace } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireAdminWorkspace();
  return (
    <WorkspaceShell
      workspace="admin"
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
