import Link from "next/link";
import { Info, LockKeyhole } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import { LoadingState } from "@/components/ui/loading-state";
import { PageHeader } from "@/components/ui/page-header";

export function SigningUnavailable({
  title = "Persetujuan internal",
}: {
  title?: string;
}) {
  return (
    <div>
      <PageHeader eyebrow="Persetujuan internal" title={title} />
      <section className="panel">
        <ErrorState
          title="Layanan belum dapat digunakan"
          description="Data persetujuan internal belum dapat dimuat. Coba kembali setelah layanan development siap."
        >
          <Button asChild variant="secondary">
            <Link href="/signing/documents">Kembali ke dokumen</Link>
          </Button>
        </ErrorState>
      </section>
    </div>
  );
}

export function SigningLoading() {
  return (
    <section className="panel">
      <LoadingState label="Memuat persetujuan internal…" />
    </section>
  );
}

export function InternalPrototypeNotice() {
  return (
    <div className="flex gap-3 rounded-lg border border-border bg-muted/50 p-4 text-xs leading-6 text-muted-foreground">
      <Info className="mt-1 size-4 shrink-0 text-info" aria-hidden="true" />
      <p>
        Prototipe persetujuan internal untuk dokumen sintetis. Catatan dan QR
        merupakan bukti internal platform. Prototipe ini bukan layanan TTE
        tersertifikasi.
      </p>
    </div>
  );
}

export function FileAccessEnded() {
  return (
    <section className="panel flex items-start gap-4 p-5 sm:p-6">
      <LockKeyhole
        className="mt-1 size-5 shrink-0 text-subtle"
        aria-hidden="true"
      />
      <div>
        <h2 className="section-heading">Akses dokumen telah berakhir</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          PDF dan informasi versinya tidak dapat dibuka karena permintaan
          ditolak, dibatalkan, atau kedaluwarsa. Riwayat permintaan tetap
          tersedia.
        </p>
      </div>
    </section>
  );
}
