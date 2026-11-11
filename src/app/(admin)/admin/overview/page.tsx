import type { Metadata } from "next";
import { OperationsOverview } from "@/features/operations/overview";
import { loadOperationsPage } from "@/server/operations/page-data";
export const metadata: Metadata = {
  title: "Monitoring platform",
  robots: { index: false, follow: false },
};
export default async function AdminOverviewPage() {
  const data = await loadOperationsPage("/admin/overview");
  return <OperationsOverview data={data} />;
}
