import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AccessDeniedPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col items-center justify-center gap-5 px-6 text-center">
      <ShieldAlert size={32} className="text-subtle" />
      <h1 className="text-2xl font-semibold">Akses tidak tersedia</h1>
      <p className="text-muted-foreground">
        Akun Anda tidak memiliki izin untuk membuka halaman tersebut.
      </p>
      <Button asChild>
        <Link href="/dashboard">Kembali ke workspace saya</Link>
      </Button>
    </main>
  );
}
