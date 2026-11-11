"use client";

import { useEffect, useState } from "react";
import { Fingerprint, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CopyValue } from "@/features/workspace/copy-value";
import { signingFetch } from "./api";

export function OwnCodeCard() {
  const [code, setCode] = useState<string | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    void signingFetch("/api/v2/me/user-code")
      .then((data) => {
        if (
          typeof data.code !== "string" ||
          !/^DVP-[A-F0-9]{20}$/.test(data.code)
        )
          throw new Error("Invalid identifier response");
        if (active) {
          setCode(data.code);
          setStatus("ready");
        }
      })
      .catch(() => {
        if (active) setStatus("error");
      });
    return () => {
      active = false;
    };
  }, [attempt]);

  return (
    <section
      className="panel p-5"
      aria-labelledby="own-signing-code"
      aria-busy={status === "loading"}
    >
      <Fingerprint className="mb-3 size-5 text-primary" aria-hidden="true" />
      <h2 id="own-signing-code" className="section-heading">
        Kode pengguna Anda
      </h2>
      <p className="mb-4 mt-2 text-xs leading-6 text-muted-foreground">
        Bagikan kode ini kepada pengguna yang ingin mengirim permintaan
        persetujuan kepada Anda. Kode ini bukan tanda tangan atau bukti
        persetujuan.
      </p>
      {status === "loading" ? (
        <p role="status" className="text-xs text-subtle">
          Memuat kode akun…
        </p>
      ) : status === "ready" && code ? (
        <CopyValue value={code} label="kode pengguna" />
      ) : (
        <div>
          <p role="status" className="text-xs leading-6 text-muted-foreground">
            Kode akun belum dapat dimuat. Layanan persetujuan internal mungkin
            belum siap.
          </p>
          <Button
            variant="secondary"
            size="sm"
            className="mt-3"
            onClick={() => {
              setStatus("loading");
              setAttempt((value) => value + 1);
            }}
          >
            <RefreshCw aria-hidden="true" /> Coba lagi
          </Button>
        </div>
      )}
    </section>
  );
}
