import Link from "next/link";
import { ArrowRight, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { SigningStatusBadge } from "@/features/signing/request-status";
import { formatTimestamp } from "@/features/workspace/format";
import { archiveStatusSchema, type ArchiveFilters } from "@/lib/archive/schema";
import type {
  SigningDocument,
  SigningPage,
  SigningRequest,
} from "@/server/signing/types";
import { ArchiveTabs, archiveListHref } from "./navigation";

const labels = {
  pending: "Menunggu tanggapan",
  expired: "Kedaluwarsa",
  cancelled: "Dibatalkan",
  rejected: "Ditolak",
  consented: "Hasil diproses",
  completed: "Selesai",
};
export function ArchiveDocumentList({
  filters,
  owned,
  requests,
}: {
  filters: ArchiveFilters;
  owned?: SigningPage<SigningDocument>;
  requests?: SigningPage<SigningRequest>;
}) {
  const rows = owned
    ? owned.items.map((document) => ({
        id: document.id,
        title: document.title,
        date: document.createdAt,
        status: document.request?.status ?? null,
        person: document.request?.recipientName ?? "Belum dikirim",
        href: `/signing/documents/${document.id}`,
      }))
    : (requests?.items ?? []).map((request) => ({
        id: request.id,
        title: request.documentTitle ?? "Informasi dokumen tidak tersedia",
        date: request.sentAt,
        status: request.status,
        person: request.isOwner ? request.recipientName : request.ownerName,
        href: `/requests/${request.id}`,
      }));
  const page = owned ?? requests;
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Arsip administratif"
        title="Dokumen terdahulu"
        description="Telusuri dokumen milik Anda, permintaan yang melibatkan akun Anda, dan pengajuan lama."
      />
      <ArchiveTabs current={filters.scope} />
      <section className="panel">
        <form
          action="/documents"
          method="get"
          className="flex flex-col items-end gap-3 border-b border-border p-5 sm:flex-row"
        >
          <input type="hidden" name="scope" value={filters.scope} />
          {filters.scope === "owned" ? (
            <div className="w-full flex-1">
              <Input
                label="Cari judul dokumen"
                name="q"
                type="search"
                defaultValue={filters.q ?? ""}
                maxLength={200}
              />
            </div>
          ) : (
            <label className="w-full flex-1 space-y-2 text-[13px] font-medium">
              Status permintaan
              <select
                name="status"
                defaultValue={filters.status ?? ""}
                className="block min-h-11 w-full rounded-md border border-border bg-surface px-3 text-sm"
              >
                <option value="">Semua status</option>
                {archiveStatusSchema.options.map((status) => (
                  <option key={status} value={status}>
                    {labels[status]}
                  </option>
                ))}
              </select>
            </label>
          )}
          <Button type="submit" variant="secondary">
            <Search aria-hidden="true" />
            Terapkan
          </Button>
          <Button asChild variant="ghost">
            <Link href={archiveListHref({ scope: filters.scope })}>
              Bersihkan
            </Link>
          </Button>
        </form>
        {!rows.length ? (
          <EmptyState
            title="Tidak ada dokumen pada daftar ini"
            description="Coba sumber atau filter lain. Pengajuan lama berada pada tab tersendiri; akses penerima tetap mengikuti status permintaan."
          />
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((row) => (
              <li
                key={row.id}
                className="flex flex-col justify-between gap-4 p-5 sm:flex-row sm:items-center"
              >
                <div className="min-w-0">
                  <Link
                    href={row.href}
                    className="break-words text-sm font-semibold hover:text-primary"
                  >
                    {row.title}
                  </Link>
                  <p className="mt-2 break-words text-xs text-muted-foreground">
                    {row.person}
                  </p>
                  <p className="mt-1 text-xs text-subtle">
                    {formatTimestamp(row.date)}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-3">
                  <SigningStatusBadge status={row.status ?? "draft"} />
                  <Button asChild variant="secondary" size="sm">
                    <Link href={row.href}>
                      Lihat riwayat <ArrowRight aria-hidden="true" />
                    </Link>
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
        <div className="flex flex-wrap justify-between gap-3 border-t border-border p-5">
          <p className="self-center text-xs text-subtle">
            {rows.length} item pada halaman ini
          </p>
          <div className="flex gap-2">
            {filters.cursor && (
              <Button asChild variant="secondary" size="sm">
                <Link href={archiveListHref({ ...filters, cursor: undefined })}>
                  Awal daftar
                </Link>
              </Button>
            )}
            {page?.hasMore && page.cursor && (
              <Button asChild variant="secondary" size="sm">
                <Link
                  href={archiveListHref({ ...filters, cursor: page.cursor })}
                >
                  Berikutnya
                </Link>
              </Button>
            )}
          </div>
        </div>
      </section>
      <p className="text-xs leading-6 text-subtle">
        Daftar ini tidak memindahkan atau mengubah dokumen. Detail sumber, hasil
        PDF, dan bukti dibuka melalui halaman yang memeriksa izin Anda.
      </p>
    </div>
  );
}
