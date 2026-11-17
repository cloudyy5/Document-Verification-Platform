import type { Metadata } from "next";
import Link from "next/link";
import { Layers3 } from "lucide-react";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  submissionConsentText,
  submissionPolicySections,
} from "@/features/workspace/submission-policy";
import { SUBMISSION_POLICY_VERSION } from "@/lib/documents/policy";
import { getPublicServiceContact } from "@/server/service-contact";
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Kebijakan dokumen dan privasi",
  robots: { index: false, follow: false },
};

export default function SubmissionPolicyPage() {
  const contact = getPublicServiceContact();
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
          <Badge tone="neutral">Kebijakan layanan</Badge>
          <h1 className="mt-4 text-[28px] font-semibold leading-9 tracking-tight">
            Kebijakan dokumen dan privasi
          </h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Versi {SUBMISSION_POLICY_VERSION}. Berlaku untuk penggunaan dokumen
            pada platform. Baca batas akses dan penyimpanan sebelum mengunggah.
          </p>
        </div>
        <article className="panel divide-y divide-border">
          <section className="px-5 py-6 sm:px-7">
            <h2 className="text-lg font-semibold">Persetujuan pada formulir</h2>
            <blockquote className="mt-4 border-l-2 border-primary pl-4 text-sm leading-7 text-muted-foreground">
              {submissionConsentText}
            </blockquote>
          </section>
          {submissionPolicySections.map((section) => (
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
          {(contact?.name || contact?.email) && (
            <section className="px-5 py-6 sm:px-7">
              <h2 className="text-lg font-semibold">Kontak pengelola</h2>
              {contact.name && (
                <p className="mt-3 text-sm leading-7 text-muted-foreground">
                  {contact.name}
                </p>
              )}
              {contact.email && (
                <p className="mt-2 text-sm leading-7 text-muted-foreground">
                  Pertanyaan layanan dan permintaan penghapusan:{" "}
                  <a
                    className="break-all font-medium text-primary underline"
                    href={`mailto:${encodeURIComponent(contact.email)}`}
                  >
                    {contact.email}
                  </a>
                  .
                </p>
              )}
            </section>
          )}
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
