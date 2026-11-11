import { Download, ExternalLink, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CopyValue } from "@/features/workspace/copy-value";
import {
  formatDate,
  formatFileSize,
  formatTimestamp,
} from "@/features/workspace/format";
import { signingFileHref } from "./api";
import type { SigningDocument } from "./types";

export function DocumentSnapshot({ document }: { document: SigningDocument }) {
  const fields = [
    [
      "Tanggal dokumen",
      document.documentDate ? formatDate(document.documentDate) : "Belum diisi",
    ],
    ["Instansi penerbit", document.issuingInstitution || "Belum diisi"],
    ["Disimpan", formatTimestamp(document.createdAt)],
    [
      "Jenis dokumen",
      document.customDocumentType || "Mengikuti kategori yang dipilih",
    ],
  ];
  return (
    <section className="panel" aria-labelledby="signing-source-document">
      <div className="flex items-start gap-3 border-b border-border p-5 sm:p-6">
        <span className="rounded-lg bg-muted p-3 text-subtle">
          <FileText size={22} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="mb-1 text-xs text-subtle">
            PDF sumber · Versi {document.versionNo}
          </p>
          <h2
            id="signing-source-document"
            className="break-words text-lg font-semibold tracking-tight"
          >
            {document.title}
          </h2>
          <p className="mt-2 break-all text-xs leading-6 text-muted-foreground">
            {document.fileName} · {formatFileSize(document.fileSizeBytes)}
          </p>
        </div>
      </div>
      <div className="space-y-5 p-5 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button asChild>
            <a
              href={signingFileHref(document.id, document.versionId)}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink aria-hidden="true" /> Pratinjau PDF
            </a>
          </Button>
          <Button asChild variant="secondary">
            <a href={signingFileHref(document.id, document.versionId, true)}>
              <Download aria-hidden="true" /> Unduh PDF sumber
            </a>
          </Button>
        </div>
        <p className="text-xs leading-6 text-subtle">
          Pratinjau terbuka melalui pembaca PDF browser. Kedua tautan membuka
          versi sumber yang sama dan tetap memeriksa hak akses akun.
        </p>
        <dl className="grid gap-x-5 gap-y-4 border-t border-border pt-5 sm:grid-cols-2">
          {fields.map(([label, value]) => (
            <div key={label}>
              <dt className="text-xs text-subtle">{label}</dt>
              <dd className="mt-1 break-words text-sm leading-6">{value}</dd>
            </div>
          ))}
          {document.description && (
            <div className="sm:col-span-2">
              <dt className="text-xs text-subtle">Deskripsi</dt>
              <dd className="mt-1 whitespace-pre-wrap break-words text-sm leading-6">
                {document.description}
              </dd>
            </div>
          )}
        </dl>
        <details className="border-t border-border pt-2">
          <summary className="inline-flex min-h-11 items-center text-xs font-medium text-muted-foreground">
            Identitas versi dan hash file sumber
          </summary>
          <div className="mt-2 space-y-3">
            <div>
              <p className="mb-1 text-xs text-subtle">ID versi</p>
              <CopyValue value={document.versionId} label="ID versi" />
            </div>
            <div>
              <p className="mb-1 text-xs text-subtle">SHA-256</p>
              <CopyValue value={document.sha256} label="hash PDF sumber" />
            </div>
          </div>
        </details>
      </div>
    </section>
  );
}
