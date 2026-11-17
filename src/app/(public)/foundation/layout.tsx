import { notFound } from "next/navigation";
import { getAppOrigin } from "@/lib/auth/config";
export const dynamic = "force-dynamic";
export default function FoundationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const origin = new URL(getAppOrigin());
  if (!["127.0.0.1", "localhost", "[::1]"].includes(origin.hostname))
    notFound();
  return children;
}
