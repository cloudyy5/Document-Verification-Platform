import Link from "next/link";
import {
  Activity,
  ArrowRight,
  CheckCheck,
  Clock3,
  FileText,
  Files,
  LockKeyhole,
  ShieldCheck,
  TriangleAlert,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { RefreshOperationsButton } from "./refresh-button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatTimestamp } from "@/features/workspace/format";
import type {
  OperationIssue,
  OperationsSnapshot,
} from "@/lib/operations/schema";

const number = new Intl.NumberFormat("id-ID");
const issueLabels: Record<OperationIssue["code"], string> = {
  RENDER_FAILED: "PDF belum berhasil disiapkan",
  RENDER_LIMIT: "Batas pengolahan PDF tercapai",
  SOURCE_UNAVAILABLE: "Sumber PDF belum dapat diambil",
  STORAGE_UNAVAILABLE: "Penyimpanan hasil belum tersedia",
  PROCESSING_TIMEOUT: "Proses melewati batas waktu",
};

export function OperationsOverview({
  data,
  detail = false,
}: {
  data: OperationsSnapshot | null;
  detail?: boolean;
}) {
  const metrics = data?.metrics;
  const cards = [
    {
      label: "Akun terdaftar",
      value: metrics?.registeredUsers,
      icon: Users,
      note: "Akun yang masih tercatat; seluruh peran.",
    },
    {
      label: "Aktif beraktivitas dokumen (30 hari)",
      value: metrics?.activeDocumentUsers30d,
      icon: Activity,
      note:
        data?.activeBasis === "unavailable"
          ? "Sumber aktivitas belum tersedia."
          : "Akun unik dengan upload, kirim, atau keputusan berhasil.",
    },
    {
      label: "Dokumen diunggah",
      value: metrics?.uploadedDocuments,
      icon: Files,
      note: "Dokumen persetujuan unik dengan sumber tersimpan.",
    },
    {
      label: "Dokumen selesai",
      value: metrics?.completedDocuments,
      icon: CheckCheck,
      note: "Persetujuan tercatat dan PDF hasil sudah siap.",
    },
    {
      label: "Permintaan tertunda",
      value: metrics?.pendingRequests,
      icon: Clock3,
      note: "Menunggu penerima dan belum kedaluwarsa.",
    },
    {
      label: "Hasil PDF perlu perhatian",
      value: metrics?.attentionResults,
      icon: TriangleAlert,
      note: "Hasil gagal atau proses melewati batas waktu.",
    },
  ];
  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Admin workspace"
        title={detail ? "Pemantauan hasil PDF" : "Monitoring platform"}
        description="Pantau penggunaan dan proses persetujuan internal melalui ringkasan operasional."
        actions={
          <Badge tone="neutral">
            <ShieldCheck size={13} aria-hidden="true" /> Akses baca-saja
          </Badge>
        }
      />
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface px-5 py-4">
        <div className="min-w-0">
          <p className="text-xs font-medium text-foreground">
            Lingkungan development
          </p>
          <p className="mt-1 text-xs leading-5 text-subtle">
            {data
              ? `Data per ${formatTimestamp(data.asOf)}`
              : "Data monitoring belum tersedia."}
          </p>
        </div>
        <RefreshOperationsButton />
      </div>
      {!data && (
        <section
          role="alert"
          className="rounded-lg border border-warning/30 bg-warning/5 p-5"
        >
          <p className="font-medium text-foreground">Data belum dapat dimuat</p>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Periksa konfigurasi monitoring atau coba muat ulang. Angka tidak
            ditampilkan sampai sumber data tersedia.
          </p>
        </section>
      )}
      <section
        aria-label="Indikator monitoring"
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
      >
        {cards.map(({ label, value, icon: Icon, note }) => (
          <article
            key={label}
            className="panel flex min-h-44 flex-col p-5 sm:p-6"
          >
            <div className="flex items-start justify-between gap-3">
              <h2 className="max-w-56 text-sm font-medium leading-6 text-muted-foreground">
                {label}
              </h2>
              <Icon
                className="mt-1 size-5 shrink-0 text-subtle"
                strokeWidth={1.6}
                aria-hidden="true"
              />
            </div>
            <p className="mt-3 text-3xl font-semibold tracking-tight text-foreground">
              {value === null || value === undefined ? (
                <span className="text-lg font-medium text-subtle">
                  Belum tersedia
                </span>
              ) : (
                number.format(value)
              )}
            </p>
            <p className="mt-auto pt-3 text-xs leading-5 text-subtle">{note}</p>
          </article>
        ))}
      </section>
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
        <section
          className="panel overflow-hidden"
          aria-labelledby="attention-title"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-5 sm:px-6">
            <div>
              <h2 id="attention-title" className="section-heading">
                Hasil yang perlu perhatian
              </h2>
              <p className="mt-2 text-xs leading-5 text-subtle">
                Kondisi hasil saat ini. Retry yang berhasil tidak lagi dihitung.
              </p>
            </div>
            {!detail && (
              <Link
                href="/admin/operations"
                className="inline-flex min-h-11 items-center gap-2 text-xs font-medium text-primary"
              >
                Lihat pemantauan <ArrowRight size={14} aria-hidden="true" />
              </Link>
            )}
          </div>
          {!data ? (
            <div className="p-6 text-sm text-muted-foreground">
              Daftar belum dapat dimuat.
            </div>
          ) : data.attention.items.length === 0 ? (
            <EmptyState
              icon={CheckCheck}
              title="Tidak ada hasil yang perlu perhatian"
              description="Tidak ada hasil gagal atau proses yang melewati batas waktu pada snapshot ini."
            />
          ) : (
            <>
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Referensi proses</TableHead>
                      <TableHead>Kondisi</TableHead>
                      <TableHead>Diperbarui</TableHead>
                      <TableHead>Percobaan</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.attention.items
                      .slice(0, detail ? 20 : 5)
                      .map((item) => (
                        <TableRow key={item.reference}>
                          <TableCell>
                            <span className="font-mono text-xs text-foreground">
                              {item.reference.slice(0, 12).toUpperCase()}
                            </span>
                            <p className="mt-1 text-xs text-subtle">
                              Pembuatan PDF hasil
                            </p>
                          </TableCell>
                          <TableCell>
                            <Badge tone="warning">
                              {item.state === "failed"
                                ? "Perlu diperiksa"
                                : "Batas waktu terlewati"}
                            </Badge>
                            <p className="mt-2 max-w-60 text-xs leading-5">
                              {issueLabels[item.code]}
                            </p>
                          </TableCell>
                          <TableCell className="text-xs">
                            {formatTimestamp(item.updatedAt)}
                          </TableCell>
                          <TableCell className="text-xs">
                            {number.format(item.attempts)}
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </div>
              <div className="divide-y divide-border md:hidden">
                {data.attention.items.slice(0, detail ? 20 : 5).map((item) => (
                  <article key={item.reference} className="space-y-3 p-5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-mono text-xs text-foreground">
                        {item.reference.slice(0, 12).toUpperCase()}
                      </span>
                      <Badge tone="warning">
                        {item.state === "failed"
                          ? "Perlu diperiksa"
                          : "Batas waktu terlewati"}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {issueLabels[item.code]}
                    </p>
                    <p className="text-xs leading-5 text-subtle">
                      {formatTimestamp(item.updatedAt)} ·{" "}
                      {number.format(item.attempts)} percobaan
                    </p>
                  </article>
                ))}
              </div>
              <p className="border-t border-border px-5 py-4 text-xs leading-5 text-subtle">
                Menampilkan{" "}
                {number.format(
                  Math.min(data.attention.items.length, detail ? 20 : 5),
                )}{" "}
                dari {number.format(data.attention.total)} hasil.{" "}
                {data.attention.hasMore
                  ? "Daftar dibatasi pada 20 hasil terbaru."
                  : ""}
              </p>
            </>
          )}
        </section>
        <aside className="space-y-5">
          <section className="panel p-5">
            <LockKeyhole
              className="mb-3 size-5 text-primary"
              aria-hidden="true"
            />
            <h2 className="section-heading">Isi dokumen tetap privat</h2>
            <p className="mt-3 text-xs leading-6 text-muted-foreground">
              Monitoring menampilkan agregat dan kondisi proses. Akses ini tidak
              membuka isi PDF atau memberi wewenang menandatangani atas nama
              peserta.
            </p>
          </section>
          <section className="panel p-5">
            <FileText className="mb-3 size-5 text-subtle" aria-hidden="true" />
            <h2 className="section-heading">Cakupan hitungan</h2>
            <p className="mt-3 text-xs leading-6 text-muted-foreground">
              Angka utama memakai model persetujuan antar pengguna. Arsip
              administratif dan versi PDF dihitung terpisah.
            </p>
            <dl className="mt-4 divide-y divide-border text-xs">
              {[
                ["Versi sumber", metrics?.sourceVersions],
                ["Persetujuan menunggu hasil", metrics?.awaitingResults],
                ["Hasil sedang diproses", metrics?.processingResults],
                ["Dokumen arsip administratif", metrics?.legacyDocuments],
              ].map(([label, value]) => (
                <div
                  key={String(label)}
                  className="flex items-start justify-between gap-3 py-3"
                >
                  <dt className="leading-5 text-muted-foreground">{label}</dt>
                  <dd className="shrink-0 font-medium text-foreground">
                    {typeof value === "number" ? number.format(value) : "—"}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
          <p className="px-1 text-xs leading-6 text-subtle">
            {data
              ? `Jendela aktivitas: ${formatTimestamp(data.periodStart)} sampai ${formatTimestamp(data.asOf)}. `
              : ""}
            Data development mencakup akun dan dokumen uji. Angka ini tidak
            mewakili penggunaan produksi.
          </p>
        </aside>
      </div>
    </div>
  );
}
