import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ExternalLink,
  FileText,
  Info,
  Minus,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { CopyValue } from "./copy-value";
import { DocumentStatusBadge } from "./document-status";
import { formatDate, formatFileSize, formatTimestamp } from "./format";
import type { DocumentDetail, SubmissionVersion } from "./types";

export function privateFileHref(
  documentId: string,
  submissionId: string,
): string {
  return `/api/v1/documents/${encodeURIComponent(documentId)}/file?submissionId=${encodeURIComponent(submissionId)}`;
}

const statusDescriptions = {
  pending_review:
    "Pengajuan sedang menunggu pemeriksaan administratif oleh reviewer.",
  revision_requested:
    "Tinjau catatan reviewer, lalu ajukan versi baru. File dan keputusan versi sebelumnya tetap tersimpan.",
  approved:
    "Dokumen lolos pemeriksaan administratif dan terdaftar pada platform.",
  rejected:
    "Pengajuan ini ditolak. Jika ingin mencoba kembali, ajukan sebagai dokumen baru.",
  revoked:
    "Pendaftaran dokumen ini telah dicabut dan tidak dinyatakan berlaku saat ini.",
};

function MetadataItem({
  label,
  value,
}: {
  label: string;
  value: string | null;
}) {
  return (
    <div className="space-y-1">
      <dt className="text-xs text-subtle">{label}</dt>
      <dd className="break-words text-sm leading-6 text-foreground">
        {value || "Belum diisi"}
      </dd>
    </div>
  );
}

function VersionSnapshot({
  documentId,
  version,
}: {
  documentId: string;
  version: SubmissionVersion;
}) {
  return (
    <details className="group border-b border-border last:border-b-0">
      <summary className="flex min-h-16 cursor-pointer flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-5">
        <span>
          <span className="font-medium">Versi {version.versionNo}</span>
          <time
            dateTime={version.submittedAt}
            className="mt-1 block text-xs text-subtle"
          >
            {formatTimestamp(version.submittedAt)}
          </time>
        </span>
        <DocumentStatusBadge status={version.status} />
      </summary>
      <div className="space-y-5 border-t border-border bg-muted/40 px-4 py-5 sm:px-5">
        <dl className="grid gap-4 sm:grid-cols-2">
          <MetadataItem label="Nama dokumen" value={version.title} />
          <MetadataItem
            label="Kategori"
            value={version.category.name ?? "Kategori tidak tersedia"}
          />
          {version.customDocumentType && (
            <MetadataItem
              label="Jenis dokumen"
              value={version.customDocumentType}
            />
          )}
          <MetadataItem
            label="Tanggal dokumen"
            value={formatDate(version.documentDate)}
          />
          <MetadataItem
            label="Instansi penerbit"
            value={version.issuingInstitution}
          />
          <MetadataItem label="Deskripsi" value={version.description} />
          <MetadataItem
            label="File PDF"
            value={`${version.fileName} · ${formatFileSize(version.fileSizeBytes)}`}
          />
        </dl>
        <div>
          <p className="mb-2 text-xs text-subtle">Nomor pengajuan</p>
          <code className="break-all text-xs">{version.submissionId}</code>
        </div>
        <details>
          <summary className="inline-flex min-h-11 items-center text-xs font-medium text-muted-foreground">
            Hash SHA-256 versi ini
          </summary>
          <CopyValue
            key={version.sha256}
            label={`hash versi ${version.versionNo}`}
            value={version.sha256}
          />
        </details>
        <Button asChild variant="secondary">
          <a
            href={privateFileHref(documentId, version.submissionId)}
            target="_blank"
            rel="noopener noreferrer"
          >
            <ExternalLink aria-hidden="true" /> Buka PDF versi{" "}
            {version.versionNo}
          </a>
        </Button>
      </div>
    </details>
  );
}

export function DocumentDetailWorkspace({
  document,
  submissionId,
}: {
  document: DocumentDetail;
  submissionId?: string;
}) {
  const receipt = document.versions.find(
    (version) => version.submissionId === submissionId,
  );
  const current = document.versions.find(
    (version) => version.versionNo === document.currentVersionNo,
  );
  const decisions = document.versions.filter(
    (version) => version.review !== null,
  );
  return (
    <div className="space-y-6">
      <Link
        href="/documents"
        className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft size={16} aria-hidden="true" /> Dokumen saya
      </Link>
      <PageHeader
        eyebrow="User workspace"
        title="Detail dokumen"
        description="Informasi pengajuan, versi file, dan riwayat pemeriksaan dokumen Anda."
        actions={
          document.status === "revision_requested" ? (
            <Button asChild>
              <Link href={`/documents/${document.id}/resubmit`}>
                <RotateCcw aria-hidden="true" /> Ajukan versi baru
              </Link>
            </Button>
          ) : document.status === "rejected" ? (
            <Button asChild>
              <Link href="/submit">
                Ajukan dokumen baru <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
          ) : undefined
        }
      />
      {receipt && (
        <section
          role="status"
          className="rounded-lg border border-primary bg-primary-soft p-5"
        >
          <h2 className="font-semibold">Pengajuan tersimpan</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Versi {receipt.versionNo} tercatat pada{" "}
            {formatTimestamp(receipt.submittedAt)}.
          </p>
          <p className="mt-2 break-all font-mono text-xs text-muted-foreground">
            {receipt.submissionId}
          </p>
          <div className="mt-3">
            <DocumentStatusBadge status={receipt.status} />
          </div>
        </section>
      )}
      <section className="panel p-5 sm:p-6">
        <div className="flex items-start gap-4">
          <div className="hidden rounded-lg border border-border bg-muted p-3 text-muted-foreground sm:block">
            <FileText size={30} strokeWidth={1.5} aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <h2 className="min-w-0 break-words text-xl font-semibold leading-8 tracking-tight">
                {document.title}
              </h2>
              <DocumentStatusBadge status={document.status} />
            </div>
            <p className="mt-2 break-all font-mono text-xs text-subtle">
              {document.id}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              {document.category.name ?? "Kategori tidak tersedia"} · Versi{" "}
              {document.currentVersionNo}
            </p>
            <p className="mt-4 text-sm leading-6 text-muted-foreground">
              {statusDescriptions[document.status]}
            </p>
            {current?.review?.note && (
              <div className="mt-4 rounded-md border border-border bg-muted p-4">
                <p className="mb-1 text-xs font-medium">
                  Catatan keputusan terbaru
                </p>
                <p className="whitespace-pre-wrap break-words text-sm leading-6 text-muted-foreground">
                  {current.review.note}
                </p>
              </div>
            )}
            {document.status === "revoked" && (
              <div className="mt-4 rounded-md bg-neutral-soft p-4 text-sm leading-6 text-neutral">
                {document.revokedAt && (
                  <p>Dicabut pada {formatTimestamp(document.revokedAt)}.</p>
                )}
                {document.revocationReason && (
                  <p className="whitespace-pre-wrap break-words">
                    {document.revocationReason}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </section>
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-6">
          <section className="panel" aria-labelledby="document-information">
            <h2
              id="document-information"
              className="section-heading border-b border-border px-5 py-4"
            >
              Informasi dokumen
            </h2>
            <dl className="grid gap-x-6 gap-y-5 p-5 sm:grid-cols-2">
              <MetadataItem
                label="Kategori"
                value={document.category.name ?? "Kategori tidak tersedia"}
              />
              {document.customDocumentType && (
                <MetadataItem
                  label="Jenis dokumen"
                  value={document.customDocumentType}
                />
              )}
              <MetadataItem
                label="Diajukan pada"
                value={formatTimestamp(document.submittedAt)}
              />
              <MetadataItem
                label="Tanggal dokumen"
                value={formatDate(document.documentDate)}
              />
              <MetadataItem
                label="Instansi penerbit"
                value={document.issuingInstitution}
              />
              {document.registeredAt && (
                <MetadataItem
                  label="Terdaftar pada"
                  value={formatTimestamp(document.registeredAt)}
                />
              )}
              <div className="sm:col-span-2">
                <MetadataItem label="Deskripsi" value={document.description} />
              </div>
            </dl>
            <div className="border-t border-border px-5 py-3">
              <details>
                <summary className="inline-flex min-h-11 items-center text-xs font-medium text-muted-foreground">
                  Persetujuan kebijakan
                </summary>
                <dl className="grid gap-4 py-3 sm:grid-cols-2">
                  <MetadataItem
                    label="Versi kebijakan"
                    value={document.policyVersion}
                  />
                  <MetadataItem
                    label="Disetujui pada"
                    value={formatTimestamp(document.consentedAt)}
                  />
                </dl>
              </details>
            </div>
          </section>
          <section className="panel" aria-labelledby="review-history">
            <h2
              id="review-history"
              className="section-heading border-b border-border px-5 py-4"
            >
              Riwayat pemeriksaan
            </h2>
            {decisions.length ? (
              <ol className="divide-y divide-border">
                {decisions.map((version) => {
                  const review = version.review!;
                  return (
                    <li key={version.submissionId} className="space-y-4 p-5">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <h3 className="text-sm font-medium">
                            Keputusan versi {version.versionNo}
                          </h3>
                          <time
                            dateTime={review.createdAt}
                            className="mt-1 block text-xs text-subtle"
                          >
                            {formatTimestamp(review.createdAt)}
                          </time>
                        </div>
                        <DocumentStatusBadge status={review.decision} />
                      </div>
                      {review.note && (
                        <p className="whitespace-pre-wrap break-words text-sm leading-6 text-muted-foreground">
                          {review.note}
                        </p>
                      )}
                      <ul className="grid gap-3 text-xs sm:grid-cols-2">
                        {(
                          [
                            { key: "completeness", label: "Kelengkapan" },
                            { key: "readability", label: "Keterbacaan" },
                            {
                              key: "category_match",
                              label: "Kesesuaian kategori",
                            },
                            {
                              key: "registration_eligibility",
                              label: "Kelayakan pendaftaran",
                            },
                          ] as const
                        ).map(({ key, label }) => (
                          <li key={key} className="flex items-start gap-2">
                            <span
                              className={
                                review.checklist[key]
                                  ? "text-success"
                                  : "text-muted-foreground"
                              }
                            >
                              {review.checklist[key] ? (
                                <Check size={15} aria-hidden="true" />
                              ) : (
                                <Minus size={15} aria-hidden="true" />
                              )}
                            </span>
                            <span>
                              {label}
                              <span className="mt-1 block text-subtle">
                                {review.checklist[key]
                                  ? "Memenuhi"
                                  : "Belum memenuhi"}
                              </span>
                            </span>
                          </li>
                        ))}
                      </ul>
                    </li>
                  );
                })}
              </ol>
            ) : (
              <EmptyState
                title="Belum ada keputusan review"
                description="Catatan dan hasil pemeriksaan administratif akan muncul setelah reviewer membuat keputusan."
              />
            )}
          </section>
          <section className="panel" aria-labelledby="version-history">
            <div className="border-b border-border px-5 py-4">
              <h2 id="version-history" className="section-heading">
                Riwayat versi
              </h2>
              <p className="mt-2 text-xs leading-5 text-subtle">
                Setiap versi menyimpan file dan metadata pada saat pengajuan.
                Versi sebelumnya tidak ditimpa.
              </p>
            </div>
            {document.versions.map((version) => (
              <VersionSnapshot
                key={version.submissionId}
                documentId={document.id}
                version={version}
              />
            ))}
          </section>
        </div>
        <aside className="min-w-0 space-y-5">
          <section className="panel p-5">
            <h2 className="section-heading">File PDF privat</h2>
            <div className="my-5 flex min-h-28 items-center justify-center rounded-lg border border-border bg-muted text-subtle">
              <FileText size={42} strokeWidth={1.2} aria-hidden="true" />
            </div>
            <p className="break-words text-sm font-medium">
              {document.fileName}
            </p>
            <p className="mt-1 text-xs text-subtle">
              PDF · {formatFileSize(document.fileSizeBytes)}
            </p>
            <Button asChild variant="secondary" className="mt-4 w-full">
              <a
                href={privateFileHref(document.id, document.submissionId)}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink aria-hidden="true" /> Buka preview PDF
              </a>
            </Button>
            <p className="mt-3 text-xs leading-5 text-subtle">
              PDF dibuka di tab baru setelah pemeriksaan akses akun.
            </p>
            <details className="mt-3 border-t border-border pt-2">
              <summary className="inline-flex min-h-11 items-center text-xs font-medium text-muted-foreground">
                Hash SHA-256
              </summary>
              <CopyValue
                key={document.sha256}
                label="hash SHA-256"
                value={document.sha256}
              />
            </details>
          </section>
          <section className="panel p-5">
            <h2 className="section-heading">Identitas verifikasi</h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              {document.status === "approved" || document.status === "revoked"
                ? "Kode dan QR belum ditampilkan pada tahap ini. Metode verifikasi akan tersedia bersama mesin pemeriksaan integritas."
                : "Kode dan QR aktif hanya diterbitkan setelah dokumen disetujui. Pengajuan ini belum memiliki identitas verifikasi aktif."}
            </p>
          </section>
          <p className="flex items-start gap-2 px-1 text-xs leading-6 text-subtle">
            <Info size={16} className="mt-1 shrink-0" aria-hidden="true" />
            Persetujuan administratif tidak membuktikan keaslian penerbit,
            kebenaran isi, atau keabsahan hukum dokumen.
          </p>
        </aside>
      </div>
    </div>
  );
}
