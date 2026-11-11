import { redirect } from "next/navigation";
import { getAuthSession } from "@/lib/auth/session";
import { defaultWorkspacePath } from "@/lib/auth/redirects";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const session = await getAuthSession();
  redirect(session ? defaultWorkspacePath(session.roles) : "/login");
}
