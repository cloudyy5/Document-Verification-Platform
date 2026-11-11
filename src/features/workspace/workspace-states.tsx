"use client";

import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import { LoadingState } from "@/components/ui/loading-state";

export function WorkspaceError({ reset }: { reset?: () => void }) {
  return (
    <section className="panel">
      <ErrorState description="Data workspace belum dapat dimuat. Silakan coba kembali dalam beberapa saat.">
        {reset && <Button onClick={reset}>Coba lagi</Button>}
      </ErrorState>
    </section>
  );
}

export function WorkspaceLoading() {
  return (
    <section className="panel" aria-label="Memuat workspace">
      <LoadingState label="Memuat data workspace Anda…" />
    </section>
  );
}
