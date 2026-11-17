import type { Metadata } from "next";
import Link from "next/link";
import { requireUserWorkspace } from "@/lib/auth/session";
import { archiveHistoryFiltersSchema } from "@/lib/archive/schema";
import { getSigningRequests } from "@/server/signing/queries";
import { ApiError } from "@/server/errors";
import { ArchiveDocumentList } from "@/features/archive/document-list";
import { SigningUnavailable } from "@/features/signing/states";
import { ErrorState } from "@/components/ui/error-state";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Pengajuan lama" };

function InvalidHistoryFilters() {
  return (
    <section className="panel">
      <ErrorState
        title="Filter riwayat tidak valid"
        description="Pilih status Selesai, Ditolak, Dibatalkan, atau Kedaluwarsa pada riwayat yang Anda kirim atau terima."
      >
        <Button asChild variant="secondary">
          <Link href="/documents/legacy">Bersihkan filter</Link>
        </Button>
        <Button asChild variant="secondary">
          <Link href="/documents/administrative">
            Arsip pemeriksaan terdahulu
          </Link>
        </Button>
      </ErrorState>
    </section>
  );
}

export default async function PreviousApplicationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireUserWorkspace("/documents/legacy");
  const input = await searchParams;
  const parsed = archiveHistoryFiltersSchema.safeParse(input);
  if (!parsed.success) return <InvalidHistoryFilters />;
  let filters = parsed.data;
  let requests: Awaited<ReturnType<typeof getSigningRequests>>;
  try {
    requests = await getSigningRequests(filters);
    if (
      input.scope === undefined &&
      input.cursor === undefined &&
      !requests.items.length &&
      !requests.hasMore
    ) {
      filters = { ...filters, scope: "received" };
      requests = await getSigningRequests(filters);
    }
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
    if (error.status === 422) return <InvalidHistoryFilters />;
    return <SigningUnavailable title="Pengajuan lama" />;
  }
  return <ArchiveDocumentList history filters={filters} requests={requests} />;
}
