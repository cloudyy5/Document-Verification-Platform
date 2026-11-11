"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { requestReceipt, SigningClientError, signingFetch } from "./api";

export function CancelSigningRequest({ requestId }: { requestId: string }) {
  const router = useRouter();
  const inFlight = useRef(false);
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [cancelled, setCancelled] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function cancel() {
    if (inFlight.current || cancelled) return;
    inFlight.current = true;
    setPending(true);
    setError(null);
    try {
      const data = await signingFetch(
        `/api/v2/signing-requests/${encodeURIComponent(requestId)}/cancel`,
        { method: "POST" },
      );
      if (
        !requestReceipt(data) ||
        data.requestId !== requestId ||
        data.status !== "cancelled" ||
        typeof data.cancelledAt !== "string" ||
        !Number.isFinite(Date.parse(data.cancelledAt))
      )
        throw new Error("Missing cancellation receipt");
      setCancelled(true);
      setOpen(false);
      router.refresh();
    } catch (problem) {
      setError(
        problem instanceof SigningClientError
          ? problem.message
          : "Pembatalan belum terkonfirmasi. Coba kembali atau muat ulang permintaan.",
      );
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }
  if (cancelled)
    return (
      <p role="status" className="text-sm text-muted-foreground">
        Pembatalan tercatat. Memuat riwayat terbaru…
      </p>
    );
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!pending) setOpen(value);
      }}
    >
      <DialogTrigger asChild>
        <Button variant="secondary">
          <X aria-hidden="true" /> Batalkan permintaan
        </Button>
      </DialogTrigger>
      <DialogContent
        onEscapeKeyDown={(event) => {
          if (pending) event.preventDefault();
        }}
        onInteractOutside={(event) => {
          if (pending) event.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle>Batalkan permintaan ini?</DialogTitle>
          <DialogDescription>
            Akses PDF penerima akan dicabut. Dokumen dan riwayat tetap
            tersimpan. Permintaan yang dibatalkan tidak dapat diaktifkan
            kembali; gunakan draft baru untuk permintaan berikutnya.
          </DialogDescription>
        </DialogHeader>
        {error && (
          <p
            role="alert"
            className="rounded-md bg-danger-soft p-3 text-sm leading-6 text-danger"
          >
            {error}
          </p>
        )}
        <DialogFooter>
          <Button
            variant="secondary"
            disabled={pending}
            onClick={() => setOpen(false)}
          >
            Kembali
          </Button>
          <Button variant="destructive" disabled={pending} onClick={cancel}>
            {pending && (
              <LoaderCircle className="animate-spin" aria-hidden="true" />
            )}
            {pending ? "Membatalkan…" : "Ya, batalkan permintaan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
