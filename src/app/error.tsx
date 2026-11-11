"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function AppError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="mx-auto flex min-h-[70dvh] max-w-lg flex-col items-center justify-center gap-5 p-6 text-center">
      <h1 className="text-2xl font-semibold">Layanan belum dapat dimuat</h1>
      <p className="text-muted-foreground">
        Silakan coba kembali. Jika masalah berlanjut, masuk ulang ke akun Anda.
      </p>
      <div className="flex gap-3">
        <Button onClick={reset}>Coba lagi</Button>
        <Button variant="secondary" asChild>
          <Link href="/login">Ke halaman masuk</Link>
        </Button>
      </div>
    </main>
  );
}
