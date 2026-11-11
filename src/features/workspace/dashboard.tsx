import Link from "next/link";
import {
  ArrowRight,
  Clock3,
  FileText,
  Inbox,
  Plus,
  ScanLine,
  Send,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { DocumentRows } from "./document-list";
import { formatTimestamp } from "./format";
import type { DashboardData } from "./types";

export function WorkspaceDashboard({ data }: { data: DashboardData }) {
  const metrics = [
    { label: "Total dokumen", count: data.counts.total, href: "/documents" },
    {
      label: "Menunggu review",
      count: data.counts.pendingReview,
      href: "/documents?status=pending_review",
    },
    {
      label: "Disetujui",
      count: data.counts.approved,
      href: "/documents?status=approved",
    },
    {
      label: "Perlu revisi",
      count: data.counts.revisionRequested,
      href: "/documents?status=revision_requested",
    },
    {
      label: "Ditolak",
      count: data.counts.rejected,
      href: "/documents?status=rejected",
    },
    {
      label: "Dicabut",
      count: data.counts.revoked,
      href: "/documents?status=revoked",
    },
  ];
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="User workspace"
        title="Ringkasan"
        description="Siapkan dokumen persetujuan internal dan pantau permintaan antar pengguna."
        actions={
          <Button asChild className="w-full sm:w-auto">
            <Link href="/signing/new">
              <Plus aria-hidden="true" /> Buat draft privat
            </Link>
          </Button>
        }
      />
      <section
        className="panel p-5 sm:p-6"
        aria-labelledby="internal-signing-heading"
      >
        <div className="flex flex-col justify-between gap-5 xl:flex-row xl:items-center">
          <div className="max-w-xl">
            <p className="mb-2 text-xs font-medium text-primary">
              Persetujuan internal
            </p>
            <h2
              id="internal-signing-heading"
              className="text-xl font-semibold tracking-tight"
            >
              Satu dokumen, satu penerima yang Anda pilih
            </h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Simpan PDF sintetis secara privat, temukan penerima melalui kode
              pengguna, lalu kirim permintaan dengan izin berbagi. Undangan
              berlaku 7 hari.
            </p>
            <Link
              href="/signing/documents"
              className="mt-3 inline-flex min-h-11 items-center gap-2 text-xs font-medium text-primary"
            >
              Buka dokumen persetujuan{" "}
              <ArrowRight size={15} aria-hidden="true" />
            </Link>
          </div>
          <div className="grid shrink-0 gap-3 sm:grid-cols-2 xl:grid-cols-1">
            <Button asChild variant="secondary">
              <Link href="/requests/incoming">
                <Inbox aria-hidden="true" /> Permintaan masuk
              </Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/requests/outgoing">
                <Send aria-hidden="true" /> Permintaan terkirim
              </Link>
            </Button>
          </div>
        </div>
        <p className="mt-5 border-t border-border pt-4 text-xs leading-6 text-subtle">
          Penerima dapat menyetujui atau menolak permintaan. QR hasil membuka
          bukti persetujuan privat di web.{" "}
          <Link href="/profile" className="font-medium text-primary">
            Lihat kode pengguna Anda
          </Link>
          .
        </p>
      </section>
      <div className="border-t border-border pt-5">
        <h2 className="section-heading">Arsip verifikasi administratif</h2>
        <p className="mt-2 text-xs leading-6 text-subtle">
          Jumlah dan aktivitas di bawah berasal dari pengajuan pemeriksaan
          administratif terdahulu. Status disetujui pada arsip tidak menyatakan
          dokumen telah ditandatangani.
        </p>
      </div>
      <section
        className="panel grid grid-cols-2 sm:grid-cols-3 2xl:grid-cols-6"
        aria-label="Ringkasan jumlah arsip administratif"
      >
        {metrics.map(({ label, count, href }) => (
          <Link
            key={label}
            href={href}
            className="border-b border-border p-4 transition-colors hover:bg-muted sm:p-5"
          >
            <p className="text-xs font-medium text-muted-foreground">{label}</p>
            <p className="mt-2 text-[28px] font-semibold leading-9 tracking-tight tabular-nums text-foreground">
              {new Intl.NumberFormat("id-ID").format(count)}
            </p>
          </Link>
        ))}
      </section>
      <div className="workspace-grid">
        <section className="panel" aria-labelledby="recent-documents-heading">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-4 sm:px-5">
            <h2
              id="recent-documents-heading"
              className="section-heading flex items-center gap-2"
            >
              <FileText size={18} aria-hidden="true" /> Pengajuan arsip terbaru
            </h2>
            <Link
              href="/documents"
              className="inline-flex min-h-11 items-center gap-2 text-xs font-medium text-primary"
            >
              Lihat semua <ArrowRight size={15} aria-hidden="true" />
            </Link>
          </div>
          {data.recentDocuments.length ? (
            <DocumentRows items={data.recentDocuments} />
          ) : (
            <EmptyState
              icon={FileText}
              title="Belum ada arsip administratif"
              description="Pengajuan dari alur pemeriksaan administratif terdahulu akan ditampilkan di sini. Dokumen persetujuan internal tersedia pada ruang dokumen terpisah."
            >
              <Button asChild variant="secondary">
                <Link href="/documents">Buka arsip dokumen</Link>
              </Button>
            </EmptyState>
          )}
        </section>
        <aside className="space-y-6">
          <section className="panel p-5">
            <h2 className="section-heading flex items-center gap-2">
              <ScanLine size={18} aria-hidden="true" /> Pemeriksaan arsip
            </h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Pilih metode kode, QR, atau pencocokan PDF untuk memahami alur
              pemeriksaan dokumen Anda.
            </p>
            <Button asChild variant="secondary" className="mt-4 w-full">
              <Link href="/verify">
                Periksa dokumen <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
            <p className="mt-3 text-xs leading-5 text-subtle">
              Metode pemeriksaan belum diaktifkan. Hanya dokumen milik akun Anda
              yang dapat diperiksa.
            </p>
          </section>
          <section className="panel p-5">
            <h2 className="section-heading flex items-center gap-2">
              <Clock3 size={18} aria-hidden="true" /> Aktivitas arsip
            </h2>
            {data.recentDocuments.length ? (
              <ol className="mt-5 space-y-5">
                {data.recentDocuments.slice(0, 4).map((document) => (
                  <li
                    key={document.submissionId}
                    className="relative border-l border-border pl-4"
                  >
                    <span
                      className="absolute -left-[4.5px] top-1.5 size-2 rounded-full bg-border-strong"
                      aria-hidden="true"
                    />
                    <p className="text-xs font-medium">
                      Versi {document.currentVersionNo} diajukan
                    </p>
                    <Link
                      href={`/documents/${document.id}`}
                      className="mt-1 block break-words text-xs leading-5 text-muted-foreground hover:text-primary"
                    >
                      {document.title}
                    </Link>
                    <time
                      dateTime={document.submittedAt}
                      className="mt-1 block text-xs text-subtle"
                    >
                      {formatTimestamp(document.submittedAt)}
                    </time>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mt-4 text-xs leading-6 text-subtle">
                Aktivitas akan muncul setelah Anda mengajukan dokumen.
              </p>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
