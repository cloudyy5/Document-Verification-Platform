import Link from "next/link";
import { ErrorState } from "@/components/ui/error-state";
import { Button } from "@/components/ui/button";
export default function EvidenceNotFound() {
  return (
    <section className="panel">
      <ErrorState
        title="Bukti tidak ditemukan"
        description="Bukti belum tersedia atau akun Anda tidak mempunyai akses."
      >
        <Button asChild variant="secondary">
          <Link href="/requests/incoming">Kembali ke permintaan</Link>
        </Button>
      </ErrorState>
    </section>
  );
}
