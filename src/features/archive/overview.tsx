import Link from "next/link";
import { ArrowRight, Files, Inbox, Send, ScanLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { formatTimestamp } from "@/features/workspace/format";
import type { ArchiveOverviewData } from "@/server/archive";
import { archiveListHref } from "./navigation";

export function ArchiveOverview({
  data,
  legacyCount,
}: {
  data: ArchiveOverviewData | null;
  legacyCount: number | null;
}) {
  const metrics = [
    [
      "Dokumen saya",
      data?.metrics.ownedDocuments,
      archiveListHref({ scope: "owned" }),
    ],
    [
      "Permintaan terkirim",
      data?.metrics.sentRequests,
      archiveListHref({ scope: "sent" }),
    ],
    [
      "Permintaan masuk",
      data?.metrics.receivedRequests,
      archiveListHref({ scope: "received" }),
    ],
    [
      "Permintaan selesai",
      data?.metrics.completed,
      archiveListHref({ scope: "sent", status: "completed" }),
    ],
    [
      "Menunggu tanggapan",
      data?.metrics.pending,
      archiveListHref({ scope: "sent", status: "pending" }),
    ],
    [
      "Ditolak penerima",
      data?.metrics.rejected,
      archiveListHref({ scope: "sent", status: "rejected" }),
    ],
  ] as const;
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Arsip administratif"
        title="Ringkasan arsip"
        description="Pantau dokumen dan riwayat persetujuan yang melibatkan akun Anda."
        actions={
          <Button asChild>
            <Link href="/signing/new">Buat draft privat</Link>
          </Button>
        }
      />
      {!data && (
        <p role="alert" className="panel p-5 text-sm text-danger">
          Ringkasan persetujuan belum dapat dimuat. Muat ulang halaman untuk
          mencoba kembali.
        </p>
      )}
      <section
        className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"
        aria-label="Ringkasan persetujuan akun"
      >
        {metrics.map(([label, count, href]) => (
          <Link
            key={label}
            href={href}
            className="panel p-5 transition-colors hover:bg-muted"
          >
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="mt-3 text-3xl font-semibold tabular-nums">
              {count === undefined
                ? "Belum tersedia"
                : count.toLocaleString("id-ID")}
            </p>
          </Link>
        ))}
      </section>
      <p className="text-xs leading-6 text-subtle">
        Dokumen saya mencakup draft. Metrik permintaan selesai, menunggu, dan
        ditolak dihitung dari permintaan yang Anda kirim.
        {data && ` Diperbarui ${formatTimestamp(data.asOf)}.`}
      </p>
      {data && (
        <section
          className="panel flex flex-wrap gap-3 p-4"
          aria-label="Status permintaan lainnya"
        >
          {(
            [
              ["consented", "Persetujuan tercatat, hasil diproses"],
              ["cancelled", "Dibatalkan"],
              ["expired", "Kedaluwarsa"],
            ] as const
          ).map(([status, label]) => (
            <Link
              key={status}
              href={archiveListHref({ scope: "sent", status })}
              className="rounded-md border border-border px-3 py-2 text-xs leading-6 hover:bg-muted"
            >
              {label}: <strong>{data.metrics[status]}</strong>
            </Link>
          ))}
        </section>
      )}
      <div className="grid gap-5 lg:grid-cols-2">
        {(
          [
            ["sent", "Permintaan terkirim terbaru", Send],
            ["received", "Permintaan masuk terbaru", Inbox],
          ] as const
        ).map(([scope, title, Icon]) => (
          <section key={scope} className="panel">
            <div className="flex items-center justify-between gap-3 border-b border-border p-5">
              <h2 className="section-heading flex items-center gap-2">
                <Icon className="size-4" aria-hidden="true" />
                {title}
              </h2>
              <Link
                className="text-xs font-semibold text-primary"
                href={archiveListHref({ scope })}
              >
                Lihat semua
              </Link>
            </div>
            {!data ? (
              <p className="p-5 text-sm text-subtle">Belum tersedia</p>
            ) : !data[scope].length ? (
              <p className="p-5 text-sm text-subtle">Belum ada permintaan.</p>
            ) : (
              <ul className="divide-y divide-border">
                {data[scope].map((request) => (
                  <li key={request.id} className="p-5">
                    <Link
                      href={`/requests/${request.id}`}
                      className="break-words text-sm font-semibold text-foreground hover:text-primary"
                    >
                      {request.documentTitle ??
                        "Informasi dokumen tidak tersedia"}
                    </Link>
                    <p className="mt-2 text-xs text-subtle">
                      {formatTimestamp(request.sentAt)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>
      <section className="panel flex flex-col justify-between gap-4 p-5 sm:flex-row sm:items-center">
        <div>
          <h2 className="section-heading flex items-center gap-2">
            <Files className="size-4" aria-hidden="true" />
            Arsip pemeriksaan terdahulu
          </h2>
          <p className="mt-2 text-xs leading-6 text-muted-foreground">
            {legacyCount === null
              ? "Jumlah arsip pemeriksaan belum tersedia."
              : `${legacyCount} dokumen dari alur pemeriksaan terdahulu.`}{" "}
            Riwayat lama tetap dipertahankan.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="secondary">
            <Link href="/documents/administrative">
              Lihat arsip pemeriksaan <ArrowRight aria-hidden="true" />
            </Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href="/verify">
              <ScanLine aria-hidden="true" />
              Verifikasi arsip
            </Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
