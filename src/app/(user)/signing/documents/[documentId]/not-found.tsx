import Link from "next/link";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

export default function SigningDocumentNotFound() {
  return (
    <section className="panel">
      <EmptyState
        title="Dokumen tidak tersedia"
        description="Dokumen tidak ditemukan atau akun Anda tidak memiliki akses ke versi ini."
      >
        <Button asChild variant="secondary">
          <Link href="/signing/documents">Kembali ke dokumen</Link>
        </Button>
      </EmptyState>
    </section>
  );
}
