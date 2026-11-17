import { PublicMetadataShell } from "@/features/signing/public-metadata-view";
export default function PublicReceiptNotFound() {
  return (
    <PublicMetadataShell>
      <h1 className="text-2xl font-semibold">Metadata tidak ditemukan</h1>
      <p className="mt-4 text-sm leading-6 text-muted-foreground">
        QR tidak valid atau belum ada catatan persetujuan untuk tautan ini.
      </p>
    </PublicMetadataShell>
  );
}
