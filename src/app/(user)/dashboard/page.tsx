import type { Metadata } from "next";
import { WorkspaceDashboard } from "@/features/workspace/dashboard";
import { requireUserWorkspace } from "@/lib/auth/session";
import { getWorkspaceDashboard } from "@/server/workspace/queries";

export const metadata: Metadata = { title: "Ringkasan" };

export default async function DashboardPage() {
  await requireUserWorkspace("/dashboard");
  const data = await getWorkspaceDashboard();
  return <WorkspaceDashboard data={data} />;
}
