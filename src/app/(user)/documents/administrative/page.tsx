import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import { PageHeader } from "@/components/ui/page-header";
import { DocumentsWorkspace } from "@/features/workspace/document-list";
import type {
  Category,
  DocumentFilters,
  DocumentListResult,
} from "@/features/workspace/types";
import { requireUserWorkspace } from "@/lib/auth/session";
import { ArchiveTabs, ArchiveHistoryTabs } from "@/features/archive/navigation";
import {
  getWorkspaceCategories,
  getWorkspaceDocuments,
  WorkspaceValidationError,
} from "@/server/workspace/queries";

export const metadata: Metadata = { title: "Pengajuan administratif lama" };

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireUserWorkspace("/documents/administrative");
  const input = await searchParams;
  let result: DocumentListResult | null = null;
  let categories: Category[] = [];
  try {
    [result, categories] = await Promise.all([
      getWorkspaceDocuments(input),
      getWorkspaceCategories(),
    ]);
  } catch (error) {
    if (!(error instanceof WorkspaceValidationError)) throw error;
  }
  if (!result) {
    return (
      <div>
        <PageHeader
          title="Pengajuan administratif lama"
          description="Lihat pengajuan dan status pemeriksaan dokumen milik Anda."
        />
        <section className="panel">
          <ErrorState
            title="Filter dokumen tidak valid"
            description="Periksa kata pencarian, status, rentang tanggal, atau kembali ke awal daftar."
          >
            <Button asChild variant="secondary">
              <Link href="/documents/administrative">Bersihkan filter</Link>
            </Button>
          </ErrorState>
        </section>
      </div>
    );
  }
  const filters: DocumentFilters = {
    ...(typeof input.q === "string" && input.q.trim()
      ? { q: input.q.trim() }
      : {}),
    ...(typeof input.status === "string" && input.status
      ? { status: input.status as DocumentFilters["status"] }
      : {}),
    ...(typeof input.categoryId === "string" && input.categoryId
      ? { categoryId: input.categoryId }
      : {}),
    ...(typeof input.from === "string" && input.from
      ? { from: input.from }
      : {}),
    ...(typeof input.to === "string" && input.to ? { to: input.to } : {}),
    ...(typeof input.cursor === "string" && input.cursor
      ? { cursor: input.cursor }
      : {}),
    limit: result.limit,
  };
  return (
    <div className="space-y-6">
      <ArchiveTabs current="legacy" />
      <ArchiveHistoryTabs administrative />
      <Link
        href="/dashboard?source=legacy"
        className="inline-flex min-h-11 items-center text-sm font-medium text-primary"
      >
        Ringkasan arsip pemeriksaan
      </Link>
      <DocumentsWorkspace
        basePath="/documents/administrative"
        result={result}
        categories={categories}
        filters={filters}
      />
    </div>
  );
}
