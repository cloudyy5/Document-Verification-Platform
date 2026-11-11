"use client";

import Link from "next/link";
import { ArrowLeft, Clock3, UserRound } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { formatTimestamp } from "@/features/workspace/format";
import { CancelSigningRequest } from "./cancel-request";
import { DocumentSnapshot } from "./document-snapshot";
import { SigningStatusBadge } from "./request-status";
import { FileAccessEnded, InternalPrototypeNotice } from "./states";
import type { SigningDocument, SigningRequest } from "./types";
import { useRequestLifecycle } from "./use-request-lifecycle";
import { SigningDecisionPanel } from "./decision-panel";

export function SigningRequestDetail({
  request: original,
  document,
}: {
  request: SigningRequest;
  document: SigningDocument | null;
}) {
  const request = useRequestLifecycle(original) ?? original;
  const readable = request.canReadFile && document !== null;
  const inactive = ["expired", "cancelled", "rejected"].includes(
    request.status,
  );
  return (
    <div className="space-y-6">
      <Link
        href={request.isOwner ? "/requests/outgoing" : "/requests/incoming"}
        className="inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft size={16} aria-hidden="true" />{" "}
        {request.isOwner ? "Permintaan terkirim" : "Permintaan masuk"}
      </Link>
      <PageHeader
        eyebrow="Persetujuan internal"
        title="Detail permintaan"
        description={
          request.isOwner
            ? "Pantau penerima dan masa berlaku permintaan Anda."
            : "Periksa pengirim, versi sumber, dan masa berlaku permintaan untuk akun Anda."
        }
        actions={<SigningStatusBadge status={request.status} />}
      />
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0 space-y-6">
          <section className="panel p-5 sm:p-6">
            <div className="flex items-center gap-3">
              <UserRound className="size-5 text-subtle" aria-hidden="true" />
              <h2 className="section-heading">Pengirim & penerima</h2>
            </div>
            <dl className="mt-5 grid gap-5 sm:grid-cols-2">
              <div>
                <dt className="text-xs text-subtle">Pengirim</dt>
                <dd className="mt-1 break-words text-sm font-medium">
                  {request.ownerName}
                  {request.isOwner && " (Anda)"}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-subtle">Penerima</dt>
                <dd className="mt-1 break-words text-sm font-medium">
                  {request.recipientName}
                  {!request.isOwner && " (Anda)"}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-subtle">Dikirim</dt>
                <dd className="mt-1 text-sm leading-6">
                  {formatTimestamp(request.sentAt)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-subtle">Batas waktu</dt>
                <dd className="mt-1 text-sm leading-6">
                  {formatTimestamp(request.expiresAt)}
                </dd>
              </div>
              {request.cancelledAt && (
                <div>
                  <dt className="text-xs text-subtle">Dibatalkan</dt>
                  <dd className="mt-1 text-sm leading-6">
                    {formatTimestamp(request.cancelledAt)}
                  </dd>
                </div>
              )}
            </dl>
            {request.status === "pending" && (
              <p className="mt-5 flex items-start gap-2 border-t border-border pt-4 text-xs leading-6 text-muted-foreground">
                <Clock3 className="mt-1 size-4 shrink-0" aria-hidden="true" />
                Undangan berlaku 7 hari. Membuka atau mengunduh PDF tidak
                mencatat persetujuan.
              </p>
            )}
            {request.isOwner && request.status === "pending" && (
              <div className="mt-5">
                <CancelSigningRequest requestId={request.id} />
              </div>
            )}
            {request.isOwner && inactive && (
              <p className="mt-5 border-t border-border pt-4 text-xs leading-6 text-muted-foreground">
                Akses penerima telah berakhir. Dokumen dan riwayat tetap
                tersimpan. Buat draft baru untuk mengirim permintaan baru.
              </p>
            )}
          </section>
          {readable ? (
            <DocumentSnapshot document={document} />
          ) : !request.isOwner && inactive ? (
            <FileAccessEnded />
          ) : (
            <section className="panel p-5">
              <p
                role="status"
                className="text-sm leading-6 text-muted-foreground"
              >
                PDF sumber belum dapat dimuat. Muat ulang untuk memeriksa akses
                terbaru.
              </p>
            </section>
          )}
          <SigningDecisionPanel
            key={request.id}
            request={request}
            document={document}
          />
          <InternalPrototypeNotice />
        </div>
        <aside className="panel p-5">
          <h2 className="section-heading">Riwayat permintaan</h2>
          <p className="mt-3 text-xs leading-6 text-muted-foreground">
            Versi dan penerima tersimpan bersama permintaan. Kedaluwarsa hanya
            menghentikan akses penerima; riwayat tidak dihapus.
          </p>
          <p className="mb-2 mt-5 text-xs text-subtle">ID permintaan</p>
          <code className="block break-all text-xs leading-6 text-muted-foreground">
            {request.id}
          </code>
        </aside>
      </div>
    </div>
  );
}
