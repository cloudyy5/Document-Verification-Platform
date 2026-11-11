"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, ExternalLink, LoaderCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { signingFetch, SigningClientError } from "./api";

export function SigningArtifactControl({
  id,
  state,
}: {
  id: string;
  state: "pending" | "processing" | "failed" | "ready";
}) {
  const router = useRouter(),
    [pending, setPending] = useState(false),
    [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (state !== "processing") return;
    const timer = setInterval(() => router.refresh(), 5000);
    return () => clearInterval(timer);
  }, [state, router]);
  async function retry() {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      await signingFetch(`/api/v2/signing-receipts/${id}/render`, {
        method: "POST",
      });
      router.refresh();
    } catch (problem) {
      setError(
        problem instanceof SigningClientError
          ? problem.message
          : "PDF hasil belum dapat diperiksa. Coba kembali.",
      );
    } finally {
      setPending(false);
    }
  }
  if (state === "ready")
    return (
      <div className="flex flex-col gap-3 sm:flex-row">
        <Button asChild>
          <a href={`/api/v2/signing-receipts/${id}/file?download=1`}>
            <Download aria-hidden="true" />
            Unduh PDF ber-QR
          </a>
        </Button>
        <Button asChild variant="secondary">
          <a
            href={`/api/v2/signing-receipts/${id}/file`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <ExternalLink aria-hidden="true" />
            Pratinjau PDF hasil
          </a>
        </Button>
      </div>
    );
  return (
    <div className="space-y-4">
      <p role="status" className="text-sm leading-6 text-muted-foreground">
        {state === "failed"
          ? "Persetujuan sudah tercatat. PDF hasil belum berhasil disiapkan; Anda dapat mencoba lagi."
          : state === "processing"
            ? "Persetujuan sudah tercatat. PDF hasil sedang diproses."
            : "Persetujuan sudah tercatat. PDF hasil belum siap."}
      </p>
      <Button variant="secondary" onClick={retry} disabled={pending}>
        {pending ? (
          <LoaderCircle className="animate-spin" aria-hidden="true" />
        ) : (
          <RefreshCw aria-hidden="true" />
        )}
        {pending ? "Menyiapkan PDF…" : "Periksa & siapkan PDF"}
      </Button>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
