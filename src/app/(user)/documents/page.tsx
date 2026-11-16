import type { Metadata } from "next";
import { requireUserWorkspace } from "@/lib/auth/session";
import { archiveFiltersSchema } from "@/lib/archive/schema";
import {
  getSigningDocuments,
  getSigningRequests,
} from "@/server/signing/queries";
import { ArchiveDocumentList } from "@/features/archive/document-list";
import { SigningUnavailable } from "@/features/signing/states";
import { ErrorState } from "@/components/ui/error-state";
import { ApiError } from "@/server/errors";
export const metadata: Metadata = { title: "Dokumen terdahulu" };
export default async function ArchiveDocumentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireUserWorkspace("/documents");
  const parsed = archiveFiltersSchema.safeParse(await searchParams);
  if (!parsed.success)
    return (
      <section className="panel">
        <ErrorState
          title="Filter arsip tidak valid"
          description="Buka Dokumen terdahulu kembali untuk mengatur ulang filter."
        />
      </section>
    );
  const filters = parsed.data;
  let owned: Awaited<ReturnType<typeof getSigningDocuments>> | undefined;
  let requests: Awaited<ReturnType<typeof getSigningRequests>> | undefined;
  try {
    if (filters.scope === "owned")
      owned = await getSigningDocuments({
        q: filters.q,
        cursor: filters.cursor,
      });
    else
      requests = await getSigningRequests({
        scope: filters.scope,
        status: filters.status,
        cursor: filters.cursor,
      });
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
    return <SigningUnavailable title="Dokumen terdahulu" />;
  }
  return (
    <ArchiveDocumentList filters={filters} owned={owned} requests={requests} />
  );
}
