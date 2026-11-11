import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Eye,
  FileText,
  Plus,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { DocumentStatusBadge, documentStatusLabels } from "./document-status";
import { formatTimestamp } from "./format";
import type {
  Category,
  DocumentFilters,
  DocumentListResult,
  DocumentSummary,
} from "./types";

export function documentListHref(filters: DocumentFilters): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== "") query.set(key, String(value));
  }
  const suffix = query.toString();
  return suffix ? `/documents?${suffix}` : "/documents";
}

export function DocumentRows({ items }: { items: DocumentSummary[] }) {
  return (
    <>
      <div className="hidden md:block">
        <Table>
          <TableCaption>
            Dokumen milik akun Anda. Waktu ditampilkan dalam UTC.
          </TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>Dokumen</TableHead>
              <TableHead>Kategori</TableHead>
              <TableHead>Diajukan</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>
                <span className="sr-only">Tindakan</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((document) => (
              <TableRow key={document.id}>
                <TableCell className="max-w-sm">
                  <div className="flex items-start gap-3">
                    <FileText
                      size={20}
                      className="mt-1 shrink-0 text-subtle"
                      aria-hidden="true"
                    />
                    <div className="min-w-0">
                      <Link
                        href={`/documents/${document.id}`}
                        className="block break-words font-medium leading-6 text-foreground hover:text-primary"
                      >
                        {document.title}
                      </Link>
                      <p className="mt-1 break-all font-mono text-xs text-subtle">
                        {document.id}
                      </p>
                      <p className="mt-1 text-xs text-subtle">
                        Versi {document.currentVersionNo}
                      </p>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="max-w-44 break-words">
                  {document.category.name ?? "Kategori tidak tersedia"}
                </TableCell>
                <TableCell className="min-w-40 text-xs leading-5">
                  <time dateTime={document.submittedAt}>
                    {formatTimestamp(document.submittedAt)}
                  </time>
                </TableCell>
                <TableCell>
                  <DocumentStatusBadge status={document.status} />
                </TableCell>
                <TableCell>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="min-h-11 sm:min-h-11"
                    asChild
                  >
                    <Link
                      href={`/documents/${document.id}`}
                      aria-label={`Lihat detail ${document.title}`}
                    >
                      <Eye aria-hidden="true" /> Lihat
                    </Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <ul
        className="divide-y divide-border md:hidden"
        aria-label="Daftar dokumen"
      >
        {items.map((document) => (
          <li key={document.id} className="space-y-3 px-4 py-5">
            <div className="flex items-start gap-3">
              <div className="rounded-md bg-muted p-2 text-subtle">
                <FileText size={20} aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="break-words font-semibold leading-6">
                  <Link href={`/documents/${document.id}`}>
                    {document.title}
                  </Link>
                </h3>
                <p className="mt-1 break-words text-xs text-muted-foreground">
                  {document.category.name ?? "Kategori tidak tersedia"} · Versi{" "}
                  {document.currentVersionNo}
                </p>
              </div>
            </div>
            <p className="break-all font-mono text-xs text-subtle">
              {document.id}
            </p>
            <time
              dateTime={document.submittedAt}
              className="block text-xs text-subtle"
            >
              {formatTimestamp(document.submittedAt)}
            </time>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <DocumentStatusBadge status={document.status} />
              <Button
                variant="secondary"
                size="sm"
                className="min-h-11 sm:min-h-11"
                asChild
              >
                <Link
                  href={`/documents/${document.id}`}
                  aria-label={`Lihat detail ${document.title}`}
                >
                  <Eye aria-hidden="true" /> Lihat
                </Link>
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}

const selectClass =
  "min-h-11 w-full rounded-md border border-border bg-surface px-3 py-2.5 text-sm text-foreground";

export function DocumentsWorkspace({
  result,
  categories,
  filters,
}: {
  result: DocumentListResult;
  categories: Category[];
  filters: DocumentFilters;
}) {
  const activeFilters = Boolean(
    filters.q ||
    filters.status ||
    filters.categoryId ||
    filters.from ||
    filters.to,
  );
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="User workspace"
        title="Dokumen saya"
        description="Lihat pengajuan, status pemeriksaan, dan riwayat dokumen milik Anda."
        actions={
          <Button asChild className="w-full sm:w-auto">
            <Link href="/submit">
              <Plus aria-hidden="true" /> Ajukan dokumen baru
            </Link>
          </Button>
        }
      />
      <nav aria-label="Filter status dokumen" className="flex flex-wrap gap-2">
        <Link
          href={documentListHref({
            ...filters,
            status: undefined,
            cursor: undefined,
          })}
          aria-current={!filters.status ? "page" : undefined}
          className={cn(
            "inline-flex min-h-11 items-center rounded-md border px-3 py-2 text-xs font-medium",
            !filters.status
              ? "border-primary bg-primary-soft text-primary"
              : "border-border bg-surface text-muted-foreground hover:bg-muted",
          )}
        >
          Semua status
        </Link>
        {Object.entries(documentStatusLabels).map(([status, label]) => (
          <Link
            key={status}
            href={documentListHref({
              ...filters,
              status: status as DocumentFilters["status"],
              cursor: undefined,
            })}
            aria-current={filters.status === status ? "page" : undefined}
            className={cn(
              "inline-flex min-h-11 items-center rounded-md border px-3 py-2 text-xs font-medium",
              filters.status === status
                ? "border-primary bg-primary-soft text-primary"
                : "border-border bg-surface text-muted-foreground hover:bg-muted",
            )}
          >
            {label}
          </Link>
        ))}
      </nav>
      <section className="panel" aria-label="Pencarian dan daftar dokumen">
        <form
          action="/documents"
          method="get"
          className="space-y-4 border-b border-border p-4 sm:p-5"
        >
          <div className="grid items-end gap-4 lg:grid-cols-[minmax(0,1fr)_200px_200px]">
            <Input
              label="Cari dokumen"
              name="q"
              type="search"
              defaultValue={filters.q ?? ""}
              maxLength={200}
              placeholder="Cari berdasarkan judul dokumen"
            />
            <div className="space-y-2">
              <label
                htmlFor="document-category"
                className="block text-[13px] font-medium"
              >
                Kategori
              </label>
              <select
                id="document-category"
                name="categoryId"
                defaultValue={filters.categoryId ?? ""}
                className={selectClass}
              >
                <option value="">Semua kategori</option>
                {filters.categoryId &&
                  !categories.some(
                    (category) => category.id === filters.categoryId,
                  ) && (
                    <option value={filters.categoryId}>
                      Kategori tidak tersedia
                    </option>
                  )}
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label
                htmlFor="document-status"
                className="block text-[13px] font-medium"
              >
                Status
              </label>
              <select
                id="document-status"
                name="status"
                defaultValue={filters.status ?? ""}
                className={selectClass}
              >
                <option value="">Semua status</option>
                {Object.entries(documentStatusLabels).map(([status, label]) => (
                  <option key={status} value={status}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <details
            className="group"
            open={Boolean(filters.from || filters.to || result.limit !== 20)}
          >
            <summary className="inline-flex min-h-11 items-center gap-2 text-xs font-medium text-muted-foreground">
              <SlidersHorizontal size={15} aria-hidden="true" /> Rentang tanggal
              dan jumlah hasil
            </summary>
            <div className="mt-3 grid gap-4 sm:grid-cols-3">
              <Input
                label="Diajukan dari"
                type="date"
                name="from"
                defaultValue={filters.from ?? ""}
              />
              <Input
                label="Diajukan sampai"
                type="date"
                name="to"
                defaultValue={filters.to ?? ""}
              />
              <div className="space-y-2">
                <label
                  htmlFor="document-limit"
                  className="block text-[13px] font-medium"
                >
                  Hasil per halaman
                </label>
                <select
                  id="document-limit"
                  name="limit"
                  defaultValue={String(result.limit)}
                  className={selectClass}
                >
                  {[...new Set([10, 20, 50, result.limit])]
                    .sort((left, right) => left - right)
                    .map((limit) => (
                      <option key={limit} value={limit}>
                        {limit} dokumen
                      </option>
                    ))}
                </select>
              </div>
            </div>
          </details>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" variant="secondary">
              <Search aria-hidden="true" /> Terapkan filter
            </Button>
            {activeFilters && (
              <Button asChild variant="ghost">
                <Link href="/documents">Bersihkan filter</Link>
              </Button>
            )}
          </div>
        </form>
        {result.items.length ? (
          <DocumentRows items={result.items} />
        ) : (
          <EmptyState
            icon={FileText}
            title={
              activeFilters || filters.cursor
                ? "Dokumen tidak ditemukan"
                : "Belum ada dokumen"
            }
            description={
              activeFilters || filters.cursor
                ? "Coba ubah kata pencarian, status, atau rentang tanggal untuk melihat dokumen Anda."
                : "Ajukan PDF pertama Anda untuk mulai mengikuti proses pemeriksaan administratif."
            }
          >
            <Button asChild variant={activeFilters ? "secondary" : "primary"}>
              <Link
                href={
                  activeFilters || filters.cursor ? "/documents" : "/submit"
                }
              >
                {activeFilters || filters.cursor
                  ? "Lihat semua dokumen"
                  : "Ajukan dokumen"}
              </Link>
            </Button>
          </EmptyState>
        )}
        <div className="flex flex-col gap-4 border-t border-border px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <p className="text-xs text-subtle">
            Menampilkan {result.items.length} dokumen pada halaman ini.
          </p>
          <nav
            aria-label="Navigasi hasil dokumen"
            className="flex flex-wrap gap-2"
          >
            {filters.cursor ? (
              <Button variant="secondary" asChild>
                <Link
                  href={documentListHref({ ...filters, cursor: undefined })}
                >
                  <ArrowLeft aria-hidden="true" /> Awal daftar
                </Link>
              </Button>
            ) : (
              <Button variant="secondary" disabled>
                <ArrowLeft aria-hidden="true" /> Awal daftar
              </Button>
            )}
            {result.nextCursor ? (
              <Button variant="secondary" asChild>
                <Link
                  href={documentListHref({
                    ...filters,
                    limit: result.limit,
                    cursor: result.nextCursor,
                  })}
                >
                  Selanjutnya <ArrowRight aria-hidden="true" />
                </Link>
              </Button>
            ) : (
              <Button variant="secondary" disabled>
                Selanjutnya <ArrowRight aria-hidden="true" />
              </Button>
            )}
          </nav>
        </div>
      </section>
    </div>
  );
}
