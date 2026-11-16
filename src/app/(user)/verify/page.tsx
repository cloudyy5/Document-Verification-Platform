import type { Metadata } from "next";
import {
  ArchiveVerification,
  type VerificationMethod,
} from "@/features/archive/verification";
import { getAppOrigin } from "@/lib/auth/config";
import { requireUserWorkspace } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Verifikasi arsip" };

export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ method?: string; receipt?: string }>;
}) {
  await requireUserWorkspace("/verify");
  const { method, receipt } = await searchParams;
  const initialMethod: VerificationMethod =
    method === "code" || method === "pdf" ? method : "qr";
  const initialReceipt =
    typeof receipt === "string" && receipt.length <= 2048 ? receipt : "";
  return (
    <ArchiveVerification
      key={`${initialMethod}:${initialReceipt}`}
      initialMethod={initialMethod}
      initialReceipt={initialReceipt}
      canonicalOrigin={getAppOrigin()}
    />
  );
}
