import Link from "next/link";
import { FileCheck2, KeyRound, Layers3, LockKeyhole } from "lucide-react";
import { ThemeSwitcher } from "@/components/theme-switcher";
import type { ReactNode } from "react";

export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-background text-foreground lg:grid lg:grid-cols-[minmax(340px,0.9fr)_minmax(0,1.4fr)]">
      <a
        href="#auth-content"
        className="sr-only fixed left-4 top-4 z-50 rounded-md bg-surface px-4 py-3 font-medium focus:not-sr-only"
      >
        Lewati ke formulir
      </a>
      <aside
        aria-label="Tentang Document Verification Platform"
        className="hidden min-h-dvh flex-col border-r border-[var(--color-sidebar-border)] bg-[var(--color-sidebar)] px-10 py-8 text-[var(--color-sidebar-text)] lg:flex xl:px-14"
      >
        <Brand light />
        <div className="my-auto max-w-sm py-16">
          <span className="mb-7 inline-flex size-14 items-center justify-center rounded-xl border border-[var(--color-sidebar-border)] text-[var(--color-sidebar-muted)]">
            <FileCheck2 size={27} strokeWidth={1.5} aria-hidden="true" />
          </span>
          <p className="mb-4 text-xs font-medium uppercase tracking-[0.16em] text-[var(--color-sidebar-muted)]">
            Ruang dokumen pribadi
          </p>
          <h2 className="text-[32px] font-semibold leading-[1.25] tracking-tight">
            Dokumen Anda.
            <br />
            Akses yang terjaga.
          </h2>
          <p className="mt-5 text-sm leading-6 text-[var(--color-sidebar-muted)]">
            Satu akun untuk mengajukan dokumen, mengikuti pemeriksaan
            administratif, dan memeriksa integritas file milik Anda.
          </p>
          <div className="mt-10 space-y-5 border-t border-[var(--color-sidebar-border)] pt-7">
            <div className="flex items-start gap-3">
              <LockKeyhole
                size={18}
                className="mt-0.5 shrink-0 text-[var(--color-sidebar-muted)]"
                aria-hidden="true"
              />
              <div>
                <p className="text-sm font-medium">Akses sesuai kepemilikan</p>
                <p className="mt-1 text-xs leading-5 text-[var(--color-sidebar-muted)]">
                  Dokumen pribadi tetap berada dalam cakupan akun Anda.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <KeyRound
                size={18}
                className="mt-0.5 shrink-0 text-[var(--color-sidebar-muted)]"
                aria-hidden="true"
              />
              <div>
                <p className="text-sm font-medium">Identitas akun yang jelas</p>
                <p className="mt-1 text-xs leading-5 text-[var(--color-sidebar-muted)]">
                  Masuk dengan email dan kata sandi untuk melanjutkan.
                </p>
              </div>
            </div>
          </div>
        </div>
        <p className="text-xs text-[var(--color-sidebar-muted)]">
          Document Verification Platform
        </p>
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="flex min-h-20 items-center justify-between gap-4 border-b border-border bg-surface px-5 sm:px-8 lg:justify-end lg:border-b-0 lg:bg-transparent lg:px-10">
          <div className="min-w-0 lg:hidden">
            <Brand />
          </div>
          <ThemeSwitcher />
        </header>
        <main
          id="auth-content"
          tabIndex={-1}
          className="flex min-w-0 flex-1 items-center justify-center px-5 py-10 outline-none sm:px-8 lg:px-12 lg:py-12"
        >
          <div className="w-full max-w-[440px]">{children}</div>
        </main>
        <footer className="px-5 pb-7 text-center text-xs leading-5 text-subtle sm:px-8">
          Akses workspace menggunakan akun Anda sendiri.
        </footer>
      </div>
    </div>
  );
}

function Brand({ light = false }: { light?: boolean }) {
  return (
    <Link
      href="/login"
      className={`inline-flex min-h-11 items-center gap-3 rounded-md ${light ? "text-[var(--color-sidebar-text)]" : "text-foreground"}`}
      aria-label="Document Verification Platform — halaman masuk"
    >
      <span
        className={`inline-flex size-9 shrink-0 items-center justify-center rounded-lg border ${light ? "border-[var(--color-sidebar-border)]" : "border-border bg-surface"}`}
      >
        <Layers3 size={23} strokeWidth={1.7} aria-hidden="true" />
      </span>
      <span className="text-xs font-semibold leading-[17px] tracking-tight sm:text-[13px]">
        Document Verification
        <br />
        Platform
      </span>
    </Link>
  );
}
