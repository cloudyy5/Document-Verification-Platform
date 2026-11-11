import Link from "next/link";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

export default function RequestNotFound() {
  return (
    <section className="panel">
      <EmptyState
        title="Permintaan tidak tersedia"
        description="Permintaan tidak ditemukan atau tidak ditujukan kepada akun Anda."
      >
        <Button asChild variant="secondary">
          <Link href="/requests/incoming">Kembali ke permintaan</Link>
        </Button>
      </EmptyState>
    </section>
  );
}
