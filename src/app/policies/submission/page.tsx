import type { Metadata } from "next";
import Link from "next/link";
import { Layers3 } from "lucide-react";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  developmentConsentText,
  developmentPolicySections,
} from "@/features/workspace/submission-policy";
import { DEVELOPMENT_POLICY_VERSION } from "@/server/documents/config";

export const metadata: Metadata = {
  title: "Kebijakan pengajuan development",
  robots: { index: false, follow: false },
};

export default function SubmissionPolicyPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-surface px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-4">
          <Link
            href="/"
            className="flex min-h-11 items-center gap-3 font-semibold"
          >
            <span className="rounded-md bg-[var(--color-sidebar)] p-2.5 text-[var(--color-sidebar-text)]">
              <Layers3 size={21} aria-hidden="true" />
            </span>
            <span className="text-sm leading-5">
              Document Verification
              <br />
              Platform
            </span>
          </Link>
          <ThemeSwitcher />
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
        <div className="mb-6">
          <Badge tone="warning">Development · dokumen sintetis</Badge>
          <h1 className="mt-4 text-[28px] font-semibold leading-9 tracking-tight">
            Kebijakan pengajuan development
          </h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Versi {DEVELOPMENT_POLICY_VERSION}. Disetujui untuk pengujian
            development; kebijakan produksi masih memerlukan tinjauan hukum dan
            privasi.
          </p>
        </div>
        <article className="panel divide-y divide-border">
          <section className="px-5 py-6 sm:px-7">
            <h2 className="text-lg font-semibold">Persetujuan pada formulir</h2>
            <blockquote className="mt-4 border-l-2 border-primary pl-4 text-sm leading-7 text-muted-foreground">
              {developmentConsentText}
            </blockquote>
          </section>
          {developmentPolicySections.map((section) => (
            <section key={section.title} className="px-5 py-6 sm:px-7">
              <h2 className="text-lg font-semibold">{section.title}</h2>
              {section.paragraphs.map((paragraph) => (
                <p
                  key={paragraph}
                  className="mt-3 text-sm leading-7 text-muted-foreground"
                >
                  {paragraph}
                </p>
              ))}
            </section>
          ))}
        </article>
        <div className="mt-6">
          <Button asChild variant="secondary">
            <Link href="/">Kembali ke aplikasi</Link>
          </Button>
        </div>
      </main>
    </div>
  );
}
