import Link from "next/link";
import { FileQuestion } from "lucide-react";

export default function NotFoundPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <FileQuestion size={36} className="text-subtle" />
      <p className="font-mono text-xs text-subtle">404</p>
      <h1 className="text-2xl font-semibold">Halaman tidak tersedia</h1>
      <p className="text-muted-foreground">
        Alamat ini belum tersedia dalam fondasi aplikasi.
      </p>
      <Link
        href="/dashboard"
        className="mt-2 inline-flex min-h-11 items-center rounded-lg bg-primary px-5 font-semibold text-primary-foreground"
      >
        Kembali ke workspace
      </Link>
    </main>
  );
}
