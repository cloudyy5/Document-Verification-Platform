"use client";

import { useId, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, LoaderCircle, Search, Send, UserRound } from "lucide-react";
import { AuthNotice } from "@/components/auth/auth-notice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  normalizeSigningUserCode,
  SIGNING_SHARING_CONSENT_TEXT,
  SIGNING_SHARING_POLICY_VERSION,
  SIGNING_USER_CODE_PATTERN,
} from "@/lib/signing/policy";
import {
  isUuid,
  requestReceipt,
  SigningClientError,
  signingFetch,
} from "./api";
import type { SigningDocument, SigningRecipient } from "./types";

export function SendSigningRequestForm({
  document,
}: {
  document: SigningDocument;
}) {
  const router = useRouter();
  const id = useId();
  const key = useRef<string | null>(null);
  const inFlight = useRef(false);
  const [code, setCode] = useState("");
  const [candidate, setCandidate] = useState<SigningRecipient | null>(null);
  const [recipient, setRecipient] = useState<SigningRecipient | null>(null);
  const [consent, setConsent] = useState(false);
  const [pending, setPending] = useState<"lookup" | "send" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [needsLogin, setNeedsLogin] = useState(false);
  const [sentId, setSentId] = useState<string | null>(null);
  const locked = pending !== null || sentId !== null;

  function changeCode(value: string) {
    setCode(value);
    setCandidate(null);
    setRecipient(null);
    setConsent(false);
    setMessage(null);
    setNeedsLogin(false);
    key.current = null;
  }

  async function lookup() {
    if (inFlight.current || sentId) return;
    const normalized = normalizeSigningUserCode(code);
    setCandidate(null);
    setRecipient(null);
    setConsent(false);
    key.current = null;
    setMessage(null);
    if (!SIGNING_USER_CODE_PATTERN.test(normalized)) {
      setMessage(
        "Masukkan kode lengkap: DVP- diikuti 20 karakter kode pengguna.",
      );
      return;
    }
    inFlight.current = true;
    setPending("lookup");
    try {
      const data = await signingFetch("/api/v2/recipients/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: normalized }),
      });
      if (
        !isUuid(data.id) ||
        data.code !== normalized ||
        typeof data.displayName !== "string" ||
        !data.displayName.trim()
      )
        throw new Error("Missing recipient confirmation");
      setCandidate({
        id: data.id,
        code: normalized,
        displayName: data.displayName,
      });
      setNeedsLogin(false);
    } catch (problem) {
      setMessage(
        problem instanceof SigningClientError
          ? problem.message
          : "Penerima belum dapat dikonfirmasi. Coba kembali.",
      );
      setNeedsLogin(
        problem instanceof SigningClientError && problem.status === 401,
      );
    } finally {
      inFlight.current = false;
      setPending(null);
    }
  }

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current || sentId) return;
    if (
      !recipient ||
      recipient.code !== normalizeSigningUserCode(code) ||
      !consent
    ) {
      setMessage(
        "Temukan dan pilih penerima, lalu berikan izin berbagi versi ini.",
      );
      return;
    }
    inFlight.current = true;
    setPending("send");
    setMessage(null);
    try {
      key.current ??= crypto.randomUUID();
      const data = await signingFetch("/api/v2/signing-requests", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": key.current,
        },
        body: JSON.stringify({
          sourceVersionId: document.versionId,
          recipientCode: recipient.code,
          recipientId: recipient.id,
          sharingPolicyVersion: SIGNING_SHARING_POLICY_VERSION,
          sharingConsent: true,
        }),
      });
      if (
        !requestReceipt(data) ||
        data.documentId !== document.id ||
        data.sourceVersionId !== document.versionId ||
        !isUuid(data.requestId)
      )
        throw new Error("Missing request receipt");
      setSentId(data.requestId);
      router.push(`/requests/${data.requestId}`);
      router.refresh();
    } catch (problem) {
      setMessage(
        problem instanceof SigningClientError
          ? problem.message
          : "Konfirmasi pengiriman belum diterima. Coba lagi tanpa mengubah pilihan untuk mengulangi permintaan yang sama, atau periksa kotak keluar.",
      );
      setNeedsLogin(
        problem instanceof SigningClientError && problem.status === 401,
      );
    } finally {
      inFlight.current = false;
      setPending(null);
    }
  }

  return (
    <section className="panel p-5 sm:p-6" aria-labelledby={`${id}-heading`}>
      <h2 id={`${id}-heading`} className="section-heading">
        Kirim permintaan persetujuan
      </h2>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        Pilih satu pengguna lain. Penerima memperoleh akses ke PDF versi{" "}
        {document.versionNo}; permintaan berlaku 7 hari setelah dikirim.
      </p>
      {message && (
        <div className="mt-5">
          <AuthNotice title="Permintaan belum terkonfirmasi" tone="error">
            <p>{message}</p>
            {needsLogin && (
              <Link
                className="mt-2 inline-flex min-h-11 items-center font-medium text-primary"
                href={`/login?next=${encodeURIComponent(`/signing/documents/${document.id}`)}`}
              >
                Masuk kembali
              </Link>
            )}
          </AuthNotice>
        </div>
      )}
      {sentId && (
        <div className="mt-5">
          <AuthNotice title="Permintaan telah tercatat" tone="success">
            <Link
              href={`/requests/${sentId}`}
              className="inline-flex min-h-11 items-center font-medium text-primary"
            >
              Lihat permintaan
            </Link>
          </AuthNotice>
        </div>
      )}
      <form onSubmit={send} aria-busy={pending !== null} className="mt-5">
        <fieldset disabled={locked} className="min-w-0 space-y-5">
          <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-end">
            <Input
              label="Kode pengguna penerima"
              value={code}
              onChange={(event) => changeCode(event.target.value)}
              maxLength={64}
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              placeholder="Masukkan kode lengkap DVP-…"
              containerClassName="min-w-0 flex-1"
            />
            <Button variant="secondary" onClick={lookup}>
              {pending === "lookup" ? (
                <LoaderCircle className="animate-spin" aria-hidden="true" />
              ) : (
                <Search aria-hidden="true" />
              )}
              {pending === "lookup" ? "Mencari…" : "Temukan penerima"}
            </Button>
          </div>
          {candidate && (
            <div className="rounded-lg border border-border bg-muted/50 p-4">
              <div className="flex items-start gap-3">
                <UserRound
                  className="mt-1 size-5 shrink-0 text-subtle"
                  aria-hidden="true"
                />
                <div className="min-w-0 flex-1">
                  <p className="break-words text-sm font-semibold">
                    {candidate.displayName}
                  </p>
                  <code className="mt-1 block break-all text-xs leading-6 text-muted-foreground">
                    {candidate.code}
                  </code>
                </div>
              </div>
              {recipient ? (
                <p
                  role="status"
                  className="mt-3 flex items-center gap-2 text-xs font-medium text-primary"
                >
                  <Check size={15} aria-hidden="true" /> Penerima dipilih
                </p>
              ) : (
                <Button
                  variant="secondary"
                  className="mt-3"
                  onClick={() => {
                    setRecipient(candidate);
                    setConsent(false);
                    setMessage(null);
                    key.current = null;
                  }}
                >
                  Gunakan penerima ini
                </Button>
              )}
            </div>
          )}
          {recipient && (
            <div className="space-y-4 border-t border-border pt-5">
              <div>
                <p className="text-xs text-subtle">Versi yang akan dibagikan</p>
                <p className="mt-1 break-words text-sm font-medium">
                  {document.title} · Versi {document.versionNo}
                </p>
                <p className="mt-1 break-all text-xs text-subtle">
                  {document.fileName}
                </p>
              </div>
              <label className="flex cursor-pointer items-start gap-3 text-xs leading-6 text-muted-foreground">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(event) => {
                    setConsent(event.target.checked);
                    key.current = null;
                    setMessage(null);
                  }}
                  className="mt-1 size-4 shrink-0 accent-[var(--color-primary)]"
                />
                <span>{SIGNING_SHARING_CONSENT_TEXT}</span>
              </label>
            </div>
          )}
          <div className="flex flex-col gap-3 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="max-w-md text-xs leading-5 text-subtle">
              Nama dan kode harus sesuai dengan penerima yang Anda maksud.
              Setelah dikirim, penerima dan versi tidak dapat diganti.
            </p>
            <Button type="submit" disabled={!recipient || !consent}>
              {pending === "send" ? (
                <LoaderCircle className="animate-spin" aria-hidden="true" />
              ) : (
                <Send aria-hidden="true" />
              )}
              {pending === "send" ? "Mengirim…" : "Kirim permintaan"}
            </Button>
          </div>
        </fieldset>
      </form>
    </section>
  );
}
