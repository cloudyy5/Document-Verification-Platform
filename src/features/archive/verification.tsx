"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Camera,
  CheckCircle2,
  FileSearch,
  Hash,
  LoaderCircle,
  QrCode,
  Square,
  TriangleAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import {
  parseEvidenceInput,
  hashComparisonPdf,
  compareEvidenceHash,
  verificationEvidenceSchema,
  type VerificationEvidence,
} from "@/lib/archive/verification";
import { formatTimestamp } from "@/features/workspace/format";

export type VerificationMethod = "qr" | "code" | "pdf";
export function ArchiveVerification({
  initialMethod = "qr",
  initialReceipt = "",
  canonicalOrigin,
}: {
  initialMethod?: VerificationMethod;
  initialReceipt?: string;
  canonicalOrigin: string;
}) {
  const [method, setMethod] = useState(initialMethod);
  const [value, setValue] = useState(initialReceipt);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [camera, setCamera] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [result, setResult] = useState<{
    evidence: VerificationEvidence;
    match: "source" | "result" | "different" | null;
    hash: string | null;
  } | null>(null);
  const operation = useRef(0),
    cameraEpoch = useRef(0);
  const request = useRef<AbortController | null>(null);
  const video = useRef<HTMLVideoElement | null>(null),
    stream = useRef<MediaStream | null>(null);
  const cameraTimer = useRef<ReturnType<typeof setInterval> | null>(null),
    cameraDeadline = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stopCamera = useCallback(() => {
    ++cameraEpoch.current;
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
    if (video.current) video.current.srcObject = null;
    if (cameraTimer.current) clearInterval(cameraTimer.current);
    if (cameraDeadline.current) clearTimeout(cameraDeadline.current);
  }, []);
  const cancelLookup = useCallback(() => {
    ++operation.current;
    request.current?.abort();
  }, []);
  useEffect(
    () => () => {
      stopCamera();
      cancelLookup();
    },
    [stopCamera, cancelLookup],
  );
  function clearResult() {
    cancelLookup();
    setBusy(false);
    setResult(null);
    setMessage(null);
  }
  async function checkProof(raw = value) {
    stopCamera();
    setCamera(false);
    cancelLookup();
    const current = operation.current,
      id = parseEvidenceInput(raw, canonicalOrigin);
    setResult(null);
    setMessage(null);
    if (!id) {
      setBusy(false);
      setMessage(
        raw.trim().startsWith("DVP-")
          ? "Kode pengguna bukan ID bukti. Gunakan ID atau tautan bukti dari detail permintaan."
          : "Masukkan ID bukti atau tautan QR dari website ini.",
      );
      return;
    }
    if (method === "pdf" && !file) {
      setBusy(false);
      setMessage("Pilih PDF yang ingin dibandingkan.");
      return;
    }
    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    try {
      const response = await fetch(`/api/v2/signing-receipts/${id}`, {
        credentials: "same-origin",
        cache: "no-store",
        signal: AbortSignal.any([
          controller.signal,
          AbortSignal.timeout(15000),
        ]),
      });
      if (response.status === 404)
        throw new Error(
          "Bukti tidak ditemukan atau akun Anda tidak memiliki akses.",
        );
      if (response.status === 401)
        throw new Error("Sesi berakhir. Masuk kembali untuk memeriksa bukti.");
      if (!response.ok)
        throw new Error("Bukti belum dapat dimuat. Silakan coba kembali.");
      const body = await response.json(),
        parsed = verificationEvidenceSchema.safeParse(body.data);
      if (!parsed.success || parsed.data.id !== id)
        throw new Error("Respons bukti belum dapat dikonfirmasi.");
      const evidence = parsed.data,
        hash = method === "pdf" && file ? await hashComparisonPdf(file) : null;
      if (current === operation.current)
        setResult({
          evidence,
          hash,
          match: hash ? compareEvidenceHash(hash, evidence) : null,
        });
    } catch (error) {
      if (current === operation.current && !controller.signal.aborted)
        setMessage(
          error instanceof Error
            ? error.message
            : "Pemeriksaan belum dapat diselesaikan.",
        );
    } finally {
      if (current === operation.current) setBusy(false);
    }
  }
  async function imageSelected(image: File | undefined) {
    if (!image) return;
    clearResult();
    stopCamera();
    setCamera(false);
    setBusy(true);
    const current = operation.current;
    try {
      const { decodeQrImage } = await import("./qr-reader"),
        raw = await decodeQrImage(image);
      if (current !== operation.current) return;
      setValue(raw);
      void checkProof(raw);
    } catch (error) {
      if (current === operation.current) {
        setMessage(
          error instanceof Error
            ? error.message
            : "Gambar QR belum dapat dibaca.",
        );
        setBusy(false);
      }
    }
  }
  async function startCamera() {
    clearResult();
    stopCamera();
    setCamera(true);
    const epoch = cameraEpoch.current;
    try {
      if (!navigator.mediaDevices?.getUserMedia)
        throw new Error("Camera unavailable");
      const media = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });
      if (epoch !== cameraEpoch.current) {
        media.getTracks().forEach((track) => track.stop());
        return;
      }
      stream.current = media;
      const player = video.current;
      if (!player) {
        stopCamera();
        setCamera(false);
        return;
      }
      player.srcObject = media;
      await player.play();
      const { decodeQrCanvas } = await import("./qr-reader");
      if (epoch !== cameraEpoch.current) return;
      const canvas = document.createElement("canvas");
      cameraTimer.current = setInterval(() => {
        if (epoch !== cameraEpoch.current || player.readyState < 2) return;
        const scale = Math.min(
          1,
          960 / Math.max(player.videoWidth, player.videoHeight),
        );
        canvas.width = Math.max(1, Math.round(player.videoWidth * scale));
        canvas.height = Math.max(1, Math.round(player.videoHeight * scale));
        canvas
          .getContext("2d")
          ?.drawImage(player, 0, 0, canvas.width, canvas.height);
        let raw: string | null;
        try {
          raw = decodeQrCanvas(canvas);
        } catch {
          stopCamera();
          setCamera(false);
          setMessage(
            "Kamera belum dapat membaca gambar. Gunakan gambar QR atau tautan bukti.",
          );
          return;
        }
        if (raw) {
          stopCamera();
          setCamera(false);
          setValue(raw);
          void checkProof(raw);
        }
      }, 250);
      cameraDeadline.current = setTimeout(() => {
        stopCamera();
        setCamera(false);
        setMessage("QR belum terbaca. Coba lagi atau gunakan gambar QR.");
      }, 45000);
    } catch {
      if (epoch === cameraEpoch.current) {
        stopCamera();
        setCamera(false);
        setMessage(
          "Kamera belum dapat digunakan. Periksa izin kamera atau gunakan gambar QR/tautan bukti.",
        );
      }
    }
  }
  const methods = [
    ["qr", "QR Code", QrCode],
    ["code", "ID bukti", Hash],
    ["pdf", "File PDF", FileSearch],
  ] as const;
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Arsip administratif"
        title="Verifikasi arsip"
        description="Periksa catatan persetujuan internal dan cocokkan file dengan bukti privat yang sudah diterbitkan."
      />
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="panel p-5 sm:p-6">
          <div
            role="group"
            aria-label="Metode verifikasi"
            className="mb-6 grid grid-cols-3 gap-1 rounded-lg bg-muted p-1"
          >
            {methods.map(([key, label, Icon]) => (
              <Button
                key={key}
                variant={method === key ? "primary" : "ghost"}
                size="sm"
                aria-pressed={method === key}
                onClick={() => {
                  stopCamera();
                  setCamera(false);
                  clearResult();
                  setMethod(key);
                }}
              >
                <Icon aria-hidden="true" />
                {label}
              </Button>
            ))}
          </div>
          <form
            className="space-y-5"
            onSubmit={(event) => {
              event.preventDefault();
              void checkProof();
            }}
          >
            <Input
              label="ID atau tautan bukti persetujuan"
              name="receipt"
              value={value}
              maxLength={2048}
              onChange={(event) => {
                clearResult();
                setValue(event.target.value);
              }}
              placeholder="Tempel tautan dari QR atau ID bukti"
              hint="Tersedia pada detail permintaan yang sudah disetujui. Kode DVP pengguna bukan ID bukti."
            />
            {method === "qr" && (
              <div className="space-y-4 rounded-lg border border-border p-4">
                <p className="text-xs leading-6 text-muted-foreground">
                  Pindai QR pada hasil PDF, pilih gambarnya, atau tempel tautan
                  QR di atas. Gambar dan kamera diproses di perangkat Anda.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="secondary"
                    disabled={busy || camera}
                    onClick={() => void startCamera()}
                  >
                    <Camera aria-hidden="true" />
                    Gunakan kamera
                  </Button>
                  {camera && (
                    <Button
                      variant="secondary"
                      onClick={() => {
                        stopCamera();
                        setCamera(false);
                      }}
                    >
                      <Square aria-hidden="true" />
                      Hentikan kamera
                    </Button>
                  )}
                </div>
                <video
                  ref={video}
                  muted
                  playsInline
                  aria-label="Pratinjau kamera QR"
                  hidden={!camera}
                  className="w-full rounded-md bg-black"
                />
                <Input
                  label="Gambar QR"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  disabled={busy || camera}
                  onChange={(event) => {
                    void imageSelected(event.target.files?.[0]);
                    event.target.value = "";
                  }}
                  hint="PNG, JPEG, atau WebP, maksimal 5 MiB. Tidak diunggah ke server."
                />
              </div>
            )}
            {method === "pdf" && (
              <Input
                label="PDF untuk dibandingkan"
                type="file"
                accept="application/pdf,.pdf"
                onChange={(event) => {
                  clearResult();
                  setFile(event.target.files?.[0] ?? null);
                }}
                hint="Maksimal 20 MiB. SHA-256 dihitung di browser; file tidak disimpan atau dikirim ke server."
              />
            )}
            <Button
              type="submit"
              disabled={busy || camera}
              className="w-full sm:w-auto"
            >
              {busy && (
                <LoaderCircle className="animate-spin" aria-hidden="true" />
              )}
              {busy
                ? "Memeriksa…"
                : method === "pdf"
                  ? "Cocokkan file PDF"
                  : "Periksa bukti"}
            </Button>
          </form>
          {message && (
            <p
              role="alert"
              className="mt-5 rounded-md border border-danger/30 bg-danger/5 p-4 text-sm leading-6 text-danger"
            >
              {message}
            </p>
          )}
          {result && (
            <section
              role="status"
              aria-label="Hasil pemeriksaan"
              className="mt-6 space-y-4 rounded-lg border border-border bg-muted/40 p-5"
            >
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                {result.match === "different" ? (
                  <TriangleAlert
                    className="size-5 text-warning"
                    aria-hidden="true"
                  />
                ) : (
                  <CheckCircle2
                    className="size-5 text-success"
                    aria-hidden="true"
                  />
                )}
                {result.match === "different"
                  ? "File tidak cocok dengan bukti ini"
                  : result.match === "source"
                    ? "File cocok dengan PDF sumber"
                    : result.match === "result"
                      ? "File cocok dengan PDF hasil persetujuan"
                      : "Bukti persetujuan ditemukan"}
              </h2>
              <dl className="space-y-3 text-sm leading-6">
                <div>
                  <dt className="text-xs text-subtle">Dokumen</dt>
                  <dd className="break-words font-medium">
                    {result.evidence.documentTitle}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-subtle">Disetujui oleh</dt>
                  <dd className="break-words">{result.evidence.signerName}</dd>
                </div>
                <div>
                  <dt className="text-xs text-subtle">Waktu persetujuan</dt>
                  <dd>{formatTimestamp(result.evidence.decidedAt)}</dd>
                </div>
              </dl>
              {result.evidence.artifact.state !== "ready" && (
                <p className="text-xs leading-6 text-warning">
                  Persetujuan sudah tercatat. PDF hasil belum siap; statusnya
                  dapat diperiksa pada detail bukti.
                </p>
              )}
              {result.hash && (
                <div>
                  <p className="text-xs text-subtle">SHA-256 file pilihan</p>
                  <code className="mt-2 block break-all text-xs leading-6">
                    {result.hash}
                  </code>
                </div>
              )}
              <Button asChild variant="secondary">
                <Link href={`/receipts/${result.evidence.id}`}>
                  Buka bukti privat
                </Link>
              </Button>
            </section>
          )}
        </section>
        <aside className="space-y-4">
          <section className="panel p-5">
            <h2 className="section-heading">Akses tetap privat</h2>
            <p className="mt-3 text-xs leading-6 text-muted-foreground">
              Hanya pemilik dan penerima yang berhak dapat membuka bukti.
              Memiliki QR atau ID tidak memberikan akses sendiri.
            </p>
            <p className="mt-3 text-xs leading-6 text-muted-foreground">
              Kecocokan SHA-256 menunjukkan kesamaan byte file. Pemeriksaan ini
              bukan sertifikat TTE, verifikasi penerbit, atau jaminan keabsahan
              hukum.
            </p>
          </section>
          <Button asChild variant="secondary" className="w-full">
            <Link href="/documents?scope=sent&status=completed">
              Cari permintaan selesai
            </Link>
          </Button>
        </aside>
      </div>
    </div>
  );
}
