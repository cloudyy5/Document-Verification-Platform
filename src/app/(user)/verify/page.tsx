import type { Metadata } from "next";
import {
  VerifyWorkspace,
  type VerificationMethod,
} from "@/features/workspace/verify-workspace";
import { requireUserWorkspace } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Periksa dokumen" };

export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ method?: string }>;
}) {
  await requireUserWorkspace("/verify");
  const { method } = await searchParams;
  const initialMethod: VerificationMethod =
    method === "code" || method === "pdf" ? method : "qr";
  return <VerifyWorkspace initialMethod={initialMethod} />;
}
