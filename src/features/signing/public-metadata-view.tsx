import Link from "next/link";
import { CheckCircle2, Layers3, LockKeyhole } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { formatTimestamp } from "@/features/workspace/format";
import { signingPrivateReceiptHref } from "@/lib/signing/receipt-link";
import type { SigningPublicMetadata } from "@/lib/signing/public-metadata";

export function PublicMetadataShell({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh bg-background">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-5 py-5 sm:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-[var(--color-sidebar)] text-white">
              <Layers3 aria-hidden="true" size={24} strokeWidth={1.75} />
            </span>
            <span className="text-sm font-semibold leading-5">
              Document Verification
              <br />
              Platform
            </span>
          </div>
          <ThemeSwitcher />
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-5 py-10 sm:px-8 sm:py-14">
        {children}
      </main>
    </div>
  );
}
export function PublicSigningMetadataView({
  metadata,
  receiptId,
}: {
  metadata: SigningPublicMetadata;
  receiptId: string;
}) {
  return (
    <PublicMetadataShell>
      <p className="text-xs font-medium uppercase tracking-widest text-subtle">
        Metadata persetujuan internal
      </p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">
        Persetujuan tercatat
      </h1>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">
        Informasi ini dapat dilihat tanpa login melalui QR dokumen.
      </p>
      <section
        className="panel mt-8 p-6 sm:p-8"
        aria-label="Metadata persetujuan"
      >
        <div className="flex items-center gap-3 text-success">
          <CheckCircle2 className="size-6" aria-hidden="true" />
          <span className="font-semibold">Disetujui</span>
        </div>
        <dl className="mt-7 space-y-6">
          {[
            ["Judul dokumen", metadata.documentTitle],
            ["Penandatangan", metadata.signerName],
            ["Waktu persetujuan", formatTimestamp(metadata.approvedAt)],
          ].map(([label, value]) => (
            <div key={label}>
              <dt className="text-xs text-subtle">{label}</dt>
              <dd className="mt-2 break-words text-sm font-medium leading-6">
                {value}
              </dd>
            </div>
          ))}
        </dl>
      </section>
      <p className="mt-6 text-xs leading-6 text-muted-foreground">
        Catatan ini menunjukkan persetujuan melalui akun pada platform. QR dapat
        disalin ke file lain; halaman ini sendiri tidak membuktikan kecocokan
        atau keaslian PDF yang sedang Anda pegang. Ini bukan sertifikat tanda
        tangan elektronik.
      </p>
      <section className="mt-7 border-t border-border pt-6">
        <p className="flex items-start gap-2 text-xs leading-6 text-muted-foreground">
          <LockKeyhole className="mt-1 size-4 shrink-0" aria-hidden="true" />
          PDF dan rincian privat hanya dapat dibuka pemilik serta penerima
          setelah login.
        </p>
        <Button asChild variant="secondary" className="mt-4">
          <Link href={signingPrivateReceiptHref(receiptId)}>
            Buka dokumen sebagai peserta
          </Link>
        </Button>
      </section>
    </PublicMetadataShell>
  );
}
