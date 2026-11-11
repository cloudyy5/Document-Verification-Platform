"use client";

import Link from "next/link";
import { ArrowRight, FilePlus2, FileText, LockKeyhole } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { formatFileSize, formatTimestamp } from "@/features/workspace/format";
import { SigningStatusBadge } from "./request-status";
import type { SigningDocument, SigningPage } from "./types";
import { useRequestLifecycle } from "./use-request-lifecycle";

function DocumentRow({
  document,
  mobile,
}: {
  document: SigningDocument;
  mobile?: boolean;
}) {
  const request = useRequestLifecycle(document.request);
  if (mobile)
    return (
      <article className="space-y-4 border-b border-border p-5 last:border-b-0">
        <div className="flex items-start gap-3">
          <FileText
            className="mt-1 size-5 shrink-0 text-subtle"
            aria-hidden="true"
          />
          <div className="min-w-0 flex-1">
            <h3 className="break-words text-sm font-semibold">
              {document.title}
            </h3>
            <p className="mt-1 text-xs leading-6 text-subtle">
              Versi {document.versionNo} ·{" "}
              {formatFileSize(document.fileSizeBytes)}
            </p>
          </div>
        </div>
        <SigningStatusBadge status={request?.status ?? "draft"} />
        <p className="text-xs leading-6 text-muted-foreground">
          {request
            ? `Penerima: ${request.recipientName}`
            : "Belum dibagikan kepada penerima"}
        </p>
        <p className="text-xs text-subtle">
          Disimpan {formatTimestamp(document.createdAt)}
        </p>
        <Button asChild variant="secondary" className="w-full">
          <Link href={`/signing/documents/${document.id}`}>
            Lihat dokumen <ArrowRight aria-hidden="true" />
          </Link>
        </Button>
      </article>
    );
  return (
    <TableRow>
      <TableCell className="max-w-80">
        <div className="flex items-start gap-3">
          <FileText
            className="mt-0.5 size-5 shrink-0 text-subtle"
            aria-hidden="true"
          />
          <div className="min-w-0">
            <Link
              href={`/signing/documents/${document.id}`}
              className="break-words font-semibold text-foreground hover:text-primary"
            >
              {document.title}
            </Link>
            <p className="mt-1 text-xs text-subtle">
              Versi {document.versionNo} ·{" "}
              {formatFileSize(document.fileSizeBytes)}
            </p>
          </div>
        </div>
      </TableCell>
      <TableCell>
        <SigningStatusBadge status={request?.status ?? "draft"} />
      </TableCell>
      <TableCell className="max-w-52 break-words text-xs">
        {request?.recipientName || "Belum dibagikan"}
      </TableCell>
      <TableCell className="text-xs leading-6">
        {formatTimestamp(document.createdAt)}
      </TableCell>
      <TableCell>
        <Button asChild variant="secondary" size="sm">
          <Link href={`/signing/documents/${document.id}`}>
            Lihat <ArrowRight aria-hidden="true" />
          </Link>
        </Button>
      </TableCell>
    </TableRow>
  );
}

export function SigningDocumentsList({
  result,
  hasCursor,
}: {
  result: SigningPage<SigningDocument>;
  hasCursor: boolean;
}) {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Persetujuan internal"
        title="Dokumen persetujuan"
        description="Simpan draft privat dan ajukan persetujuan kepada satu pengguna melalui kode akun."
        actions={
          <Button asChild>
            <Link href="/signing/new">
              <FilePlus2 aria-hidden="true" /> Buat draft privat
            </Link>
          </Button>
        }
      />
      <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/50 p-4 text-xs leading-6 text-muted-foreground">
        <LockKeyhole
          className="mt-1 size-4 shrink-0 text-subtle"
          aria-hidden="true"
        />
        <p>
          Draft hanya dapat diakses oleh Anda. Penerima memperoleh akses setelah
          permintaan dikirim.{" "}
          <Link href="/profile" className="font-medium text-primary">
            Lihat kode pengguna Anda
          </Link>{" "}
          untuk menerima permintaan.
        </p>
      </div>
      <section className="panel" aria-label="Daftar dokumen persetujuan">
        {!result.items.length ? (
          <EmptyState
            title="Belum ada draft di halaman ini"
            description={
              hasCursor
                ? "Tidak ada dokumen pada halaman lanjutan ini. Kembali ke awal untuk melihat dokumen terbaru."
                : "Mulai dengan satu PDF sintetis. Setelah draft tersimpan, Anda dapat memilih penerima dan mengirim permintaan."
            }
            icon={FileText}
          >
            {hasCursor ? (
              <Button asChild variant="secondary">
                <Link href="/signing/documents">Kembali ke awal</Link>
              </Button>
            ) : (
              <Button asChild>
                <Link href="/signing/new">Buat draft privat</Link>
              </Button>
            )}
          </EmptyState>
        ) : (
          <>
            <div className="md:hidden">
              {result.items.map((document) => (
                <DocumentRow key={document.id} document={document} mobile />
              ))}
            </div>
            <div className="hidden p-5 md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Dokumen</TableHead>
                    <TableHead>Status permintaan</TableHead>
                    <TableHead>Penerima</TableHead>
                    <TableHead>Disimpan</TableHead>
                    <TableHead>Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {result.items.map((document) => (
                    <DocumentRow key={document.id} document={document} />
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="flex flex-col gap-3 border-t border-border p-5 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-subtle">
                {result.items.length} dokumen pada halaman ini
              </p>
              <div className="flex flex-wrap gap-2">
                {hasCursor && (
                  <Button asChild variant="secondary" size="sm">
                    <Link href="/signing/documents">Kembali ke awal</Link>
                  </Button>
                )}
                {result.hasMore && result.cursor && (
                  <Button asChild variant="secondary" size="sm">
                    <Link
                      href={`/signing/documents?cursor=${encodeURIComponent(result.cursor)}`}
                    >
                      Berikutnya <ArrowRight aria-hidden="true" />
                    </Link>
                  </Button>
                )}
              </div>
            </div>
          </>
        )}
      </section>
      <p className="text-xs leading-6 text-subtle">
        Pengajuan pemeriksaan administratif terdahulu tetap tersedia di{" "}
        <Link href="/documents" className="font-medium text-primary">
          arsip dokumen
        </Link>
        .
      </p>
    </div>
  );
}
