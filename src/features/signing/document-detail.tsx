"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight, LockKeyhole } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { formatTimestamp } from "@/features/workspace/format";
import { DocumentSnapshot } from "./document-snapshot";
import { SigningStatusBadge } from "./request-status";
import { SendSigningRequestForm } from "./send-request-form";
import { FileAccessEnded, InternalPrototypeNotice } from "./states";
import type { SigningDocument } from "./types";
import { useRequestLifecycle } from "./use-request-lifecycle";

export function SigningDocumentDetail({
  document,
}: {
  document: SigningDocument;
}) {
  const request = useRequestLifecycle(document.request);
  const readable = document.isOwner || Boolean(request?.canReadFile);
  return (
    <div className="space-y-6">
      <Link
        href={document.isOwner ? "/signing/documents" : "/requests/incoming"}
        className="inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft size={16} aria-hidden="true" />{" "}
        {document.isOwner ? "Dokumen persetujuan" : "Permintaan masuk"}
      </Link>
      <PageHeader
        eyebrow="Persetujuan internal"
        title="Detail dokumen"
        description="PDF sumber dan versi dokumen yang digunakan dalam permintaan persetujuan."
        actions={<SigningStatusBadge status={request?.status ?? "draft"} />}
      />
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0 space-y-6">
          {readable ? (
            <DocumentSnapshot document={document} />
          ) : (
            <FileAccessEnded />
          )}
          {document.isOwner && !request && (
            <SendSigningRequestForm document={document} />
          )}
          {request && (
            <section className="panel p-5 sm:p-6">
              <h2 className="section-heading">Permintaan versi ini</h2>
              <p className="mt-3 text-sm text-muted-foreground">
                {request.isOwner
                  ? `Dikirim kepada ${request.recipientName}`
                  : `Dikirim oleh ${request.ownerName}`}
              </p>
              <p className="mt-2 text-xs leading-6 text-subtle">
                Berlaku sampai {formatTimestamp(request.expiresAt)}.
              </p>
              <Button asChild variant="secondary" className="mt-4">
                <Link href={`/requests/${request.id}`}>
                  Lihat permintaan <ArrowRight aria-hidden="true" />
                </Link>
              </Button>
            </section>
          )}
        </div>
        <aside className="space-y-5">
          <section className="panel p-5">
            <LockKeyhole
              className="mb-3 size-5 text-primary"
              aria-hidden="true"
            />
            <h2 className="section-heading">Akses terkendali</h2>
            <p className="mt-3 text-xs leading-6 text-muted-foreground">
              Draft hanya tersedia bagi pemiliknya. Pengiriman permintaan
              memberi akses kepada satu penerima yang dipilih. PDF sumber tidak
              ditimpa saat proses berlangsung.
            </p>
          </section>
          <InternalPrototypeNotice />
        </aside>
      </div>
    </div>
  );
}
