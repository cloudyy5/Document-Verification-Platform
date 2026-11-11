import type { Metadata } from "next";
import { OperationsOverview } from "@/features/operations/overview";
import { loadOperationsPage } from "@/server/operations/page-data";
export const metadata: Metadata = {
  title: "Pemantauan hasil PDF",
  robots: { index: false, follow: false },
};
export default async function OperationsPage() {
  const data = await loadOperationsPage("/admin/operations");
  return <OperationsOverview data={data} detail />;
}
