"use client";

import Link from "next/link";
import { ArrowRight, Inbox, Send } from "lucide-react";
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
import { formatTimestamp } from "@/features/workspace/format";
import { SigningStatusBadge } from "./request-status";
import type { SigningPage, SigningRequest } from "./types";
import { useRequestLifecycle } from "./use-request-lifecycle";

function RequestRow({
  request: original,
  received,
  mobile,
}: {
  request: SigningRequest;
  received: boolean;
  mobile?: boolean;
}) {
  const request = useRequestLifecycle(original) ?? original;
  const title = request.documentTitle || "Informasi dokumen tidak tersedia";
  const person = received ? request.ownerName : request.recipientName;
  if (mobile)
    return (
      <article className="space-y-4 border-b border-border p-5 last:border-b-0">
        <div>
          <h3 className="break-words text-sm font-semibold">{title}</h3>
          <p className="mt-2 break-words text-xs leading-6 text-muted-foreground">
            {received ? "Dari" : "Kepada"}: {person}
          </p>
        </div>
        <SigningStatusBadge status={request.status} />
        <dl className="space-y-2 text-xs leading-6 text-subtle">
          <div>
            <dt className="inline">Dikirim: </dt>
            <dd className="inline">{formatTimestamp(request.sentAt)}</dd>
          </div>
          <div>
            <dt className="inline">Batas waktu: </dt>
            <dd className="inline">{formatTimestamp(request.expiresAt)}</dd>
          </div>
        </dl>
        <Button asChild variant="secondary" className="w-full">
          <Link href={`/requests/${request.id}`}>
            Lihat permintaan <ArrowRight aria-hidden="true" />
          </Link>
        </Button>
      </article>
    );
  return (
    <TableRow>
      <TableCell className="max-w-72">
        <Link
          href={`/requests/${request.id}`}
          className="break-words font-semibold text-foreground hover:text-primary"
        >
          {title}
        </Link>
        <p className="mt-1 text-xs text-subtle">
          Dikirim {formatTimestamp(request.sentAt)}
        </p>
      </TableCell>
      <TableCell className="max-w-52 break-words text-sm">{person}</TableCell>
      <TableCell>
        <SigningStatusBadge status={request.status} />
      </TableCell>
      <TableCell className="text-xs leading-6">
        {formatTimestamp(request.expiresAt)}
      </TableCell>
      <TableCell>
        <Button asChild variant="secondary" size="sm">
          <Link href={`/requests/${request.id}`}>
            Lihat <ArrowRight aria-hidden="true" />
          </Link>
        </Button>
      </TableCell>
    </TableRow>
  );
}

export function SigningRequestsList({
  result,
  scope,
  hasCursor,
}: {
  result: SigningPage<SigningRequest>;
  scope: "received" | "sent";
  hasCursor: boolean;
}) {
  const received = scope === "received";
  const path = received ? "/requests/incoming" : "/requests/outgoing";
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Persetujuan internal"
        title={received ? "Permintaan masuk" : "Permintaan terkirim"}
        description={
          received
            ? "Lihat undangan yang ditujukan kepada akun Anda dan periksa versi PDF sumber selama akses berlaku."
            : "Pantau permintaan yang Anda kirim, penerima yang dipilih, dan batas waktunya."
        }
        actions={
          !received && (
            <Button asChild>
              <Link href="/signing/new">
                <Send aria-hidden="true" /> Siapkan dokumen
              </Link>
            </Button>
          )
        }
      />
      <nav aria-label="Kotak permintaan" className="flex flex-wrap gap-2">
        <Button asChild variant={received ? "primary" : "secondary"}>
          <Link
            href="/requests/incoming"
            aria-current={received ? "page" : undefined}
          >
            <Inbox aria-hidden="true" /> Masuk
          </Link>
        </Button>
        <Button asChild variant={received ? "secondary" : "primary"}>
          <Link
            href="/requests/outgoing"
            aria-current={!received ? "page" : undefined}
          >
            <Send aria-hidden="true" /> Terkirim
          </Link>
        </Button>
      </nav>
      <section
        className="panel"
        aria-label={
          received ? "Daftar permintaan masuk" : "Daftar permintaan terkirim"
        }
      >
        {!result.items.length ? (
          <EmptyState
            icon={received ? Inbox : Send}
            title={
              hasCursor
                ? "Tidak ada permintaan di halaman ini"
                : received
                  ? "Belum ada permintaan masuk"
                  : "Belum ada permintaan terkirim"
            }
            description={
              hasCursor
                ? "Kembali ke awal untuk melihat riwayat terbaru."
                : received
                  ? "Bagikan kode pengguna Anda kepada pengirim. Undangan yang sah akan muncul di sini."
                  : "Simpan draft privat, pilih penerima melalui kode pengguna, lalu berikan izin berbagi."
            }
          >
            <Button asChild variant="secondary">
              <Link
                href={hasCursor ? path : received ? "/profile" : "/signing/new"}
              >
                {hasCursor
                  ? "Kembali ke awal"
                  : received
                    ? "Lihat kode saya"
                    : "Buat draft privat"}
              </Link>
            </Button>
          </EmptyState>
        ) : (
          <>
            <div className="md:hidden">
              {result.items.map((request) => (
                <RequestRow
                  key={request.id}
                  request={request}
                  received={received}
                  mobile
                />
              ))}
            </div>
            <div className="hidden p-5 md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Dokumen & waktu kirim</TableHead>
                    <TableHead>{received ? "Pengirim" : "Penerima"}</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Batas waktu</TableHead>
                    <TableHead>Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {result.items.map((request) => (
                    <RequestRow
                      key={request.id}
                      request={request}
                      received={received}
                    />
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="flex flex-col gap-3 border-t border-border p-5 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-subtle">
                {result.items.length} permintaan pada halaman ini
              </p>
              <div className="flex flex-wrap gap-2">
                {hasCursor && (
                  <Button asChild variant="secondary" size="sm">
                    <Link href={path}>Kembali ke awal</Link>
                  </Button>
                )}
                {result.hasMore && result.cursor && (
                  <Button asChild variant="secondary" size="sm">
                    <Link
                      href={`${path}?cursor=${encodeURIComponent(result.cursor)}`}
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
        Undangan berlaku 7 hari. Riwayat tetap tersimpan saat akses PDF
        berakhir. Aksi persetujuan dan penolakan belum diaktifkan pada tahap
        ini.
      </p>
    </div>
  );
}
