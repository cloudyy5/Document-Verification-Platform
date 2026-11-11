import { redirect } from "next/navigation";
import { requireAdminWorkspace } from "@/lib/auth/session";
import { defaultWorkspacePath } from "@/lib/auth/redirects";

export default async function AdminPage() {
  const session = await requireAdminWorkspace("/admin");
  redirect(defaultWorkspacePath(session.roles));
}
