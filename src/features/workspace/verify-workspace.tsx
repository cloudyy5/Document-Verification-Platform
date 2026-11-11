"use client";

import { useId, useRef, useState, type KeyboardEvent } from "react";
import {
  Camera,
  FileUp,
  Hash,
  Info,
  LockKeyhole,
  QrCode,
  ScanLine,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type VerificationMethod = "qr" | "code" | "pdf";
const methods = [
  { id: "qr", label: "QR Code", icon: QrCode },
  { id: "code", label: "Kode", icon: Hash },
  { id: "pdf", label: "File PDF", icon: FileUp },
] as const;

export function VerifyWorkspace({
  initialMethod = "qr",
}: {
  initialMethod?: VerificationMethod;
}) {
  const [method, setMethod] = useState<VerificationMethod>(initialMethod);
  const id = useId();
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  function onTabKey(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let target: number;
    if (event.key === "ArrowRight") target = (index + 1) % methods.length;
    else if (event.key === "ArrowLeft")
      target = (index + methods.length - 1) % methods.length;
    else if (event.key === "Home") target = 0;
    else if (event.key === "End") target = methods.length - 1;
    else return;
    event.preventDefault();
    setMethod(methods[target]!.id);
    tabs.current[target]?.focus();
  }
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="User workspace"
        title="Periksa dokumen"
        description="Pemeriksaan integritas file dan identitas dokumen milik akun Anda."
      />
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <section className="panel p-4 sm:p-6" aria-label="Metode pemeriksaan">
          <div
            role="tablist"
            aria-label="Metode pemeriksaan"
            className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1"
          >
            {methods.map(({ id: value, label, icon: Icon }, index) => (
              <button
                key={value}
                type="button"
                role="tab"
                id={`${id}-${value}-tab`}
                aria-controls={`${id}-${value}-panel`}
                aria-selected={method === value}
                tabIndex={method === value ? 0 : -1}
                ref={(element) => {
                  tabs.current[index] = element;
                }}
                onClick={() => setMethod(value)}
                onKeyDown={(event) => onTabKey(event, index)}
                className={cn(
                  "flex min-h-12 items-center justify-center gap-2 rounded-md px-2 py-3 text-xs font-semibold transition-colors sm:text-sm",
                  method === value
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-surface",
                )}
              >
                <Icon size={17} aria-hidden="true" />
                <span>{label}</span>
              </button>
            ))}
          </div>
          {methods.map(({ id: value }) => (
            <div
              key={value}
              role="tabpanel"
              id={`${id}-${value}-panel`}
              aria-labelledby={`${id}-${value}-tab`}
              hidden={method !== value}
              tabIndex={0}
              className="mt-5 rounded-lg border border-border px-4 py-7 sm:px-7 sm:py-10"
            >
              {value === "qr" ? (
                <div className="flex flex-col items-center text-center">
                  <div className="mb-6 flex size-28 items-center justify-center rounded-2xl border border-border bg-muted text-subtle">
                    <ScanLine size={48} strokeWidth={1.25} aria-hidden="true" />
                  </div>
                  <h2 className="text-lg font-semibold">
                    Pemeriksaan melalui QR
                  </h2>
                  <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
                    Pemindaian kamera dan pembacaan gambar QR belum diaktifkan.
                  </p>
                  <div className="mt-7 flex w-full flex-col gap-3 sm:flex-row">
                    <Button variant="secondary" disabled className="flex-1">
                      <Camera aria-hidden="true" /> Gunakan kamera
                    </Button>
                    <Button variant="secondary" disabled className="flex-1">
                      Unggah gambar QR
                    </Button>
                  </div>
                </div>
              ) : value === "code" ? (
                <div className="space-y-5">
                  <h2 className="text-lg font-semibold">
                    Masukkan kode verifikasi
                  </h2>
                  <Input
                    label="Kode verifikasi"
                    name="verificationCode"
                    disabled
                    hint="Pencarian kode belum diaktifkan. Kode hanya diterbitkan setelah dokumen disetujui."
                  />
                  <Button disabled className="w-full">
                    Periksa kode
                  </Button>
                </div>
              ) : (
                <div className="space-y-5">
                  <h2 className="text-lg font-semibold">Cocokkan file PDF</h2>
                  <Input
                    label="File PDF untuk perbandingan"
                    type="file"
                    accept="application/pdf,.pdf"
                    disabled
                    hint="Unggah perbandingan belum diaktifkan. File perbandingan tidak menjadi pengajuan baru."
                  />
                  <Button disabled className="w-full">
                    Periksa integritas file
                  </Button>
                </div>
              )}
              <p className="mt-6 flex items-start gap-2 rounded-md bg-muted px-3 py-3 text-xs leading-5 text-muted-foreground">
                <Info
                  size={16}
                  className="mt-0.5 shrink-0"
                  aria-hidden="true"
                />
                Metode ini belum tersedia. Tidak ada file yang dikirim atau
                hasil pemeriksaan yang dibuat di halaman ini.
              </p>
            </div>
          ))}
        </section>
        <aside className="space-y-5">
          <section className="panel p-5 sm:p-6">
            <h2 className="section-heading flex items-center gap-2">
              <LockKeyhole size={18} aria-hidden="true" /> Privat untuk akun
              Anda
            </h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Kode, QR, dan pencocokan file hanya digunakan untuk dokumen milik
              akun yang sedang masuk.
            </p>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Dokumen yang dicabut tidak dinyatakan berlaku meski identitasnya
              ditemukan.
            </p>
          </section>
          <section className="px-1">
            <h2 className="font-medium">Memahami hasil hash</h2>
            <p className="mt-2 text-xs leading-6 text-muted-foreground">
              SHA-256 yang cocok menunjukkan kesamaan file byte per byte. Hasil
              tersebut tidak membuktikan keaslian penerbit, kebenaran isi, atau
              keabsahan hukum dokumen.
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}
