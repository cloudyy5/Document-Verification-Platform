"use client";

import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";

export default function SigningError({ reset }: { reset: () => void }) {
  return (
    <section className="panel">
      <ErrorState
        title="Persetujuan internal belum dapat dimuat"
        description="Coba kembali dalam beberapa saat untuk memeriksa layanan development."
      >
        <Button onClick={reset}>Coba lagi</Button>
      </ErrorState>
    </section>
  );
}
