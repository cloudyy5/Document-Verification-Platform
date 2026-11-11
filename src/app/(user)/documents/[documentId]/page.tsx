import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DocumentDetailWorkspace } from "@/features/workspace/document-detail";
import { requireUserWorkspace } from "@/lib/auth/session";
import { getWorkspaceDocument } from "@/server/workspace/queries";

export const metadata: Metadata = { title: "Detail dokumen" };

export default async function DocumentPage({
  params,
  searchParams,
}: {
  params: Promise<{ documentId: string }>;
  searchParams: Promise<{ submission?: string }>;
}) {
  const { documentId } = await params;
  await requireUserWorkspace(`/documents/${documentId}`);
  const document = await getWorkspaceDocument(documentId);
  if (!document) notFound();
  const query = await searchParams;
  const submissionId =
    typeof query.submission === "string" ? query.submission : undefined;
  return (
    <DocumentDetailWorkspace document={document} submissionId={submissionId} />
  );
}
