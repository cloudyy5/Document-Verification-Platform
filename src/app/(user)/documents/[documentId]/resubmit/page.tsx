import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import { PageHeader } from "@/components/ui/page-header";
import { SubmissionForm } from "@/features/workspace/submission-form";
import { requireVerifiedEmail } from "@/lib/auth/session";
import { getSubmissionConfiguration } from "@/server/documents/config";
import {
  getWorkspaceCategories,
  getWorkspaceDocument,
} from "@/server/workspace/queries";

export const metadata: Metadata = { title: "Revisi dokumen" };

export default async function ResubmitPage({
  params,
}: {
  params: Promise<{ documentId: string }>;
}) {
  const { documentId } = await params;
  await requireVerifiedEmail(`/documents/${documentId}/resubmit`);
  const document = await getWorkspaceDocument(documentId);
  if (!document) notFound();
  if (document.status !== "revision_requested")
    return (
      <div>
        <PageHeader
          title="Revisi dokumen"
          description="Periksa status pengajuan sebelum mengirim versi baru."
        />
        <section className="panel">
          <ErrorState
            title="Dokumen tidak sedang meminta revisi"
            description="Status pengajuan telah berubah atau tidak mengizinkan versi baru. Buka detail dokumen untuk melihat informasi terbaru."
          >
            <Button asChild variant="secondary">
              <Link href={`/documents/${document.id}`}>
                Lihat detail dokumen
              </Link>
            </Button>
            {document.status === "rejected" && (
              <Button asChild>
                <Link href="/submit">Ajukan dokumen baru</Link>
              </Button>
            )}
          </ErrorState>
        </section>
      </div>
    );
  const configuration = getSubmissionConfiguration();
  const categories = await getWorkspaceCategories();
  return (
    <SubmissionForm
      key={document.submissionId}
      categories={categories}
      configuration={configuration}
      document={document}
    />
  );
}
