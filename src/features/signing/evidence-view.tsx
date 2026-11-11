import Link from "next/link";
import { ArrowLeft, LockKeyhole } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { CopyValue } from "@/features/workspace/copy-value";
import { formatTimestamp, formatFileSize } from "@/features/workspace/format";
import { getAppOrigin } from "@/lib/auth/config";
import { createSigningEvidenceQr } from "@/server/signing/evidence-qr";
import type { SigningEvidence } from "@/server/signing/evidence";
import { SIGNING_ACTION_CONSENT_TEXT } from "@/lib/signing/policy";
import { QR_PLACEMENT_VERSION } from "@/lib/signing/placement";
import { SigningArtifactControl } from "./artifact-control";
import { signingFileHref } from "./api";

export function SigningEvidenceView({
  evidence,
}: {
  evidence: SigningEvidence;
}) {
  const qr = createSigningEvidenceQr(getAppOrigin(), evidence.id);
  let path = "";
  for (let row = 0; row < qr.size; row++)
    for (let col = 0; col < qr.size; col++)
      if (qr.cells[row * qr.size + col])
        path += `M${col + 4} ${row + 4}h1v1h-1z`;
  const fields = [
    ["Penandatangan", evidence.signerName],
    ["Kode akun", evidence.signerCode],
    ["Pemilik dokumen", evidence.ownerName],
    ["Persetujuan tercatat", formatTimestamp(evidence.decidedAt)],
    ["Konfirmasi", "Tindakan eksplisit melalui akun yang login"],
  ];
  return (
    <div className="space-y-6">
      <Link
        href={`/requests/${evidence.requestId}`}
        className="inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground"
      >
        <ArrowLeft size={16} aria-hidden="true" />
        Kembali ke permintaan
      </Link>
      <PageHeader
        eyebrow="Persetujuan internal"
        title="Bukti persetujuan"
        description="Catatan privat atas satu versi dokumen dan satu tindakan penerima."
      />
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0 space-y-6">
          <section className="panel p-5 sm:p-6">
            <p className="text-xs font-medium uppercase tracking-wider text-primary">
              Persetujuan tercatat
            </p>
            <h2 className="mt-2 break-words text-xl font-semibold">
              {evidence.documentTitle}
            </h2>
            <dl className="mt-6 grid gap-5 sm:grid-cols-2">
              {fields.map(([label, value]) => (
                <div key={label}>
                  <dt className="text-xs text-subtle">{label}</dt>
                  <dd className="mt-1 break-words text-sm leading-6">
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
            <blockquote className="mt-6 border-l-2 border-primary pl-4 text-xs leading-6 text-muted-foreground">
              {SIGNING_ACTION_CONSENT_TEXT}
            </blockquote>
          </section>
          <section className="panel space-y-5 p-5 sm:p-6">
            <h2 className="section-heading">PDF hasil persetujuan</h2>
            <SigningArtifactControl
              id={evidence.id}
              state={evidence.artifact.state}
            />
            {evidence.artifact.state === "ready" && (
              <p className="text-xs leading-6 text-subtle">
                {evidence.artifact.pageCount} halaman ·{" "}
                {formatFileSize(evidence.artifact.bytes!)}.{" "}
                {evidence.layoutVersion === QR_PLACEMENT_VERSION
                  ? "QR berada pada posisi yang dipilih penerima di setiap halaman. Bukti persetujuan tersedia pada halaman web ini."
                  : "QR mengikuti penempatan yang telah disetujui pada dokumen ini, termasuk halaman bukti tambahan."}
              </p>
            )}
            <div className="border-t border-border pt-5">
              <p className="mb-2 text-xs text-subtle">SHA-256 PDF sumber</p>
              <CopyValue
                value={evidence.sourceSha256}
                label="hash PDF sumber"
              />
            </div>
            {evidence.artifact.sha256 && (
              <div>
                <p className="mb-2 text-xs text-subtle">
                  SHA-256 PDF hasil ber-QR
                </p>
                <CopyValue
                  value={evidence.artifact.sha256}
                  label="hash PDF hasil"
                />
              </div>
            )}
            <a
              href={signingFileHref(
                evidence.documentId,
                evidence.sourceVersionId,
              )}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center text-sm font-medium text-primary"
            >
              Buka PDF sumber yang disetujui
            </a>
          </section>
        </div>
        <aside className="space-y-5">
          <section className="panel p-5">
            <h2 className="section-heading">QR bukti privat</h2>
            <svg
              role="img"
              aria-label="QR tautan bukti persetujuan privat"
              viewBox={`0 0 ${qr.size + 8} ${qr.size + 8}`}
              shapeRendering="crispEdges"
              className="mx-auto my-5 w-full max-w-56 rounded bg-white p-2"
            >
              <rect width="100%" height="100%" fill="white" />
              <path d={path} fill="black" />
            </svg>
            <p className="text-xs leading-6 text-muted-foreground">
              Pemindaian membuka halaman ini. Login dan hak sebagai peserta
              tetap diperlukan.
            </p>
            <p className="mt-4 text-xs text-subtle">ID bukti</p>
            <code className="mt-2 block break-all text-xs leading-6">
              {evidence.id}
            </code>
          </section>
          <section className="panel p-5">
            <LockKeyhole className="size-5 text-primary" aria-hidden="true" />
            <p className="mt-3 text-xs leading-6 text-muted-foreground">
              Bukti ini mencatat persetujuan internal. Bukan sertifikat TTE,
              verifikasi penerbit, atau jaminan kebenaran isi dokumen.
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}
