import type { Metadata } from "next";
import { WorkspaceDashboard } from "@/features/workspace/dashboard";
import { requireUserWorkspace } from "@/lib/auth/session";
import { getWorkspaceDashboard } from "@/server/workspace/queries";
import { getArchiveOverview } from "@/server/archive";
import { ArchiveOverview } from "@/features/archive/overview";

export const metadata: Metadata = { title: "Ringkasan arsip" };

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ source?: string }>;
}) {
  await requireUserWorkspace("/dashboard");
  if ((await searchParams).source === "legacy")
    return <WorkspaceDashboard data={await getWorkspaceDashboard()} />;
  const [summary, legacy] = await Promise.allSettled([
    getArchiveOverview(),
    getWorkspaceDashboard(),
  ]);
  return (
    <ArchiveOverview
      data={summary.status === "fulfilled" ? summary.value : null}
      legacyCount={
        legacy.status === "fulfilled" ? legacy.value.counts.total : null
      }
    />
  );
}
