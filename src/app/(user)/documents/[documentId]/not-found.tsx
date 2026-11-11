import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function DocumentNotFound() {
  return (
    <section className="panel px-5 py-12 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">
        Dokumen tidak ditemukan
      </h1>
      <p className="mb-6 mt-3 text-sm text-muted-foreground">
        Dokumen ini tidak tersedia untuk akun Anda.
      </p>
      <Button asChild variant="secondary">
        <Link href="/documents">Kembali ke dokumen saya</Link>
      </Button>
    </section>
  );
}
