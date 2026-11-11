"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";

export function CopyValue({ value, label }: { value: string; label: string }) {
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setStatus("success");
    } catch {
      setStatus("error");
    }
  }
  return (
    <div>
      <div className="flex items-start gap-2">
        <code className="min-w-0 flex-1 break-all text-xs leading-6 text-muted-foreground">
          {value}
        </code>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Salin ${label}`}
          onClick={copy}
        >
          {status === "success" ? (
            <Check aria-hidden="true" />
          ) : (
            <Copy aria-hidden="true" />
          )}
        </Button>
      </div>
      <p role="status" className="min-h-5 text-xs text-subtle">
        {status === "success"
          ? `${label} disalin.`
          : status === "error"
            ? "Belum dapat menyalin. Pilih teks lalu salin secara manual."
            : ""}
      </p>
    </div>
  );
}
