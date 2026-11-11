import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SigningDocumentDetail } from "@/features/signing/document-detail";
import { SigningUnavailable } from "@/features/signing/states";
import { requireUserWorkspace } from "@/lib/auth/session";
import { ApiError } from "@/server/errors";
import { getSigningDocument } from "@/server/signing/queries";
import type { SigningDocument } from "@/server/signing/types";

export const metadata: Metadata = { title: "Detail dokumen persetujuan" };

export default async function SigningDocumentPage({
  params,
}: {
  params: Promise<{ documentId: string }>;
}) {
  const { documentId } = await params;
  await requireUserWorkspace(`/signing/documents/${documentId}`);
  let document: SigningDocument | null;
  try {
    document = await getSigningDocument(documentId);
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
    return <SigningUnavailable title="Detail dokumen" />;
  }
  if (!document) notFound();
  return <SigningDocumentDetail key={document.id} document={document} />;
}
