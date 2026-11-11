"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, LoaderCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  SIGNING_ACTION_CONSENT_TEXT,
  SIGNING_ACTION_POLICY_VERSION,
} from "@/lib/signing/policy";
import { signingReceiptHref } from "@/lib/signing/receipt-link";
import { signingDecisionSchema } from "@/lib/signing/decision-validation";
import { signingFetch, SigningClientError } from "./api";
import type { SigningRequest, SigningDocument } from "./types";
import type {
  SigningDecision,
  SigningEvidence,
} from "@/lib/signing/evidence-types";
import { formatTimestamp } from "@/features/workspace/format";
import QrPlacementEditor from "./qr-placement-editor";
import { QR_PLACEMENT_VERSION, type QrPosition } from "@/lib/signing/placement";
import { signingFileHref } from "./api";

export function SigningDecisionPanel({
  request,
  document,
}: {
  request: SigningRequest;
  document: SigningDocument | null;
}) {
  const router = useRouter();
  const [outcome, setOutcome] = useState<{
    decision: SigningDecision | null;
    evidence: SigningEvidence | null;
  } | null>(null);
  const [available, setAvailable] = useState(false),
    [attempt, setAttempt] = useState(0);
  const [action, setAction] = useState<"approve" | "reject" | null>(null);
  const [reason, setReason] = useState(""),
    [consent, setConsent] = useState(false),
    [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [placements, setPlacements] = useState<QrPosition[] | null>(null);
  const inFlight = useRef(false),
    key = useRef<string | null>(null);
  useEffect(() => {
    let active = true;
    void signingFetch(`/api/v2/signing-requests/${request.id}/decision`)
      .then((data) => {
        if (active) {
          setOutcome(
            data as unknown as {
              decision: SigningDecision | null;
              evidence: SigningEvidence | null;
            },
          );
          setAvailable(true);
        }
      })
      .catch(() => {
        if (active) setAvailable(false);
      });
    return () => {
      active = false;
    };
  }, [request.id, request.status, attempt]);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (inFlight.current || !document || !action) return;
    const parsed = signingDecisionSchema.safeParse({
      action,
      sourceVersionId: document.versionId,
      sourceSha256: document.sha256,
      policyVersion: SIGNING_ACTION_POLICY_VERSION,
      confirmed: true,
      consent: action === "approve" ? consent : false,
      ...(action === "reject" ? { reason } : {}),
      ...(action === "approve"
        ? { placementVersion: QR_PLACEMENT_VERSION, placements }
        : {}),
    });
    if (!parsed.success) {
      setError(
        action === "approve"
          ? "Centang pernyataan persetujuan sebelum mengonfirmasi."
          : "Isi alasan penolakan, maksimal 1.000 karakter.",
      );
      return;
    }
    inFlight.current = true;
    setPending(true);
    setError(null);
    try {
      key.current ??= crypto.randomUUID();
      const result = await signingFetch(
        `/api/v2/signing-requests/${request.id}/decisions`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": key.current,
          },
          body: JSON.stringify(parsed.data),
        },
      );
      if (result.requestId !== request.id || result.action !== action)
        throw new Error("Missing decision receipt");
      setAction(null);
      setAttempt((value) => value + 1);
      router.refresh();
      if (action === "approve" && typeof result.receiptId === "string")
        router.push(signingReceiptHref(result.receiptId));
    } catch (problem) {
      setError(
        problem instanceof SigningClientError
          ? problem.message
          : "Konfirmasi belum diterima. Coba lagi tanpa mengubah isian untuk mengulangi tindakan yang sama.",
      );
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }
  if (!available)
    return (
      <section className="panel p-5">
        <h2 className="section-heading">Keputusan penerima</h2>
        <p role="status" className="mt-3 text-sm text-muted-foreground">
          Layanan keputusan sedang dimuat atau belum tersedia.
        </p>
        <Button
          variant="secondary"
          className="mt-4"
          onClick={() => setAttempt((value) => value + 1)}
        >
          Periksa kembali
        </Button>
      </section>
    );
  if (outcome?.decision)
    return (
      <section className="panel p-5 sm:p-6">
        <h2 className="section-heading">
          {outcome.decision.action === "approve"
            ? "Persetujuan tercatat"
            : "Dokumen ditolak"}
        </h2>
        <p className="mt-2 text-xs text-subtle">
          {formatTimestamp(outcome.decision.decidedAt)}
        </p>
        {outcome.decision.reason && (
          <p className="mt-4 whitespace-pre-wrap break-words text-sm leading-6">
            {outcome.decision.reason}
          </p>
        )}
        {outcome.evidence && (
          <Button asChild className="mt-5">
            <Link href={signingReceiptHref(outcome.evidence.id)}>
              Buka bukti & PDF hasil
            </Link>
          </Button>
        )}
      </section>
    );
  if (
    request.isOwner ||
    request.status !== "pending" ||
    !request.canReadFile ||
    !document
  )
    return null;
  return (
    <>
      <QrPlacementEditor
        key={document.versionId}
        sourceUrl={signingFileHref(document.id, document.versionId)}
        sourceSha256={document.sha256}
        disabled={pending}
        onChange={(value) => {
          setPlacements(value);
          key.current = null;
        }}
      />
      <section className="panel p-5 sm:p-6">
        <h2 className="section-heading">Tanggapi dokumen ini</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Periksa PDF sumber versi {document.versionNo} sebelum mengambil
          keputusan. Keputusan final akan tersimpan dalam riwayat privat.
        </p>
        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <Button
            disabled={!placements || pending}
            onClick={() => {
              setAction("approve");
              setConsent(false);
              setError(null);
              key.current = null;
            }}
          >
            <Check aria-hidden="true" />
            Setujui dokumen
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              setAction("reject");
              setReason("");
              setError(null);
              key.current = null;
            }}
          >
            <X aria-hidden="true" />
            Tolak dokumen
          </Button>
        </div>
        {!placements && (
          <p className="mt-3 text-xs text-muted-foreground">
            Atur posisi QR pada seluruh halaman untuk melanjutkan persetujuan.
          </p>
        )}
        <Dialog
          open={action !== null}
          onOpenChange={(open) => {
            if (!pending && !open) setAction(null);
          }}
        >
          <DialogContent
            onEscapeKeyDown={(event) => {
              if (pending) event.preventDefault();
            }}
            onInteractOutside={(event) => {
              if (pending) event.preventDefault();
            }}
          >
            <form onSubmit={submit}>
              <DialogHeader>
                <DialogTitle>
                  {action === "approve"
                    ? "Setujui versi dokumen ini?"
                    : "Tolak versi dokumen ini?"}
                </DialogTitle>
                <DialogDescription>
                  {document.title} · Versi {document.versionNo}. Tindakan ini
                  akan dicatat atas akun Anda dan tidak dapat diubah melalui
                  aplikasi.
                  {action === "approve" &&
                    " Posisi QR di seluruh halaman akan dikunci. Bukti persetujuan ditampilkan di web tanpa halaman PDF tambahan."}
                </DialogDescription>
              </DialogHeader>
              <fieldset disabled={pending} className="min-w-0 space-y-4">
                {action === "approve" ? (
                  <label className="flex items-start gap-3 text-xs leading-6 text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={consent}
                      onChange={(event) => {
                        setConsent(event.target.checked);
                        key.current = null;
                        setError(null);
                      }}
                      className="mt-1 size-4 shrink-0 accent-[var(--color-primary)]"
                    />
                    <span>{SIGNING_ACTION_CONSENT_TEXT}</span>
                  </label>
                ) : (
                  <label className="block space-y-2 text-sm font-medium">
                    Alasan penolakan
                    <textarea
                      required
                      maxLength={1000}
                      rows={5}
                      value={reason}
                      onChange={(event) => {
                        setReason(event.target.value);
                        key.current = null;
                        setError(null);
                      }}
                      className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm font-normal"
                    />
                    <span className="block text-xs font-normal text-subtle">
                      {reason.length}/1.000 karakter. Hanya pemilik dan penerima
                      yang dapat membaca alasan ini.
                    </span>
                  </label>
                )}
                {error && (
                  <p role="alert" className="text-sm text-danger">
                    {error}
                  </p>
                )}
              </fieldset>
              <DialogFooter>
                <Button
                  variant="secondary"
                  disabled={pending}
                  onClick={() => setAction(null)}
                >
                  Kembali
                </Button>
                <Button
                  type="submit"
                  disabled={pending}
                  variant={action === "reject" ? "destructive" : "primary"}
                >
                  {pending && (
                    <LoaderCircle className="animate-spin" aria-hidden="true" />
                  )}
                  {pending
                    ? "Mencatat keputusan…"
                    : action === "approve"
                      ? "Ya, setujui versi ini"
                      : "Ya, tolak dokumen"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </section>
    </>
  );
}
