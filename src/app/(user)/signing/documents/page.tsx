import type { Metadata } from "next";
import { SigningDocumentsList } from "@/features/signing/document-list";
import { SigningUnavailable } from "@/features/signing/states";
import { requireUserWorkspace } from "@/lib/auth/session";
import { ApiError } from "@/server/errors";
import { getSigningDocuments } from "@/server/signing/queries";

export const metadata: Metadata = { title: "Dokumen persetujuan" };

export default async function SigningDocumentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireUserWorkspace("/signing/documents");
  const input = await searchParams;
  const cursor = typeof input.cursor === "string" ? input.cursor : undefined;
  let result: Awaited<ReturnType<typeof getSigningDocuments>>;
  try {
    result = await getSigningDocuments({ ...(cursor ? { cursor } : {}) });
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
    return <SigningUnavailable title="Dokumen persetujuan" />;
  }
  return <SigningDocumentsList result={result} hasCursor={Boolean(cursor)} />;
}
