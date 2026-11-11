"use client";

import { useActionState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/auth/password-input";
import { AuthNotice } from "@/components/auth/auth-notice";
import {
  loginAction,
  registerAction,
  forgotPasswordAction,
  resetPasswordAction,
  resendVerificationAction,
} from "@/app/(auth)/actions";
import type { AuthActionState } from "@/lib/auth/types";

export type AuthMode =
  "login" | "register" | "forgot-password" | "reset-password" | "verify-email";

const actions = {
  login: loginAction,
  register: registerAction,
  "forgot-password": forgotPasswordAction,
  "reset-password": resetPasswordAction,
  "verify-email": resendVerificationAction,
};

const submitLabels: Record<AuthMode, string> = {
  login: "Masuk",
  register: "Buat akun",
  "forgot-password": "Kirim tautan pemulihan",
  "reset-password": "Simpan kata sandi",
  "verify-email": "Kirim ulang email verifikasi",
};

const initialState: AuthActionState = { status: "idle" };

export function AuthForm({
  mode,
  configured,
  returnTo = "/dashboard",
  recoveryAllowed = false,
}: {
  mode: AuthMode;
  configured: boolean;
  returnTo?: string;
  recoveryAllowed?: boolean;
}) {
  const [state, formAction, pending] = useActionState(
    actions[mode],
    initialState,
  );
  const unavailableRecovery = mode === "reset-password" && !recoveryAllowed;
  const disabled = !configured || unavailableRecovery || pending;
  const passwordMode =
    mode === "login" || mode === "register" || mode === "reset-password";
  const emailMode = mode !== "reset-password";
  const linkWithReturn = (path: string) =>
    `${path}?${new URLSearchParams({ next: returnTo }).toString()}`;

  return (
    <div className="space-y-6">
      {!configured && (
        <AuthNotice title="Autentikasi belum dikonfigurasi">
          Layanan akun belum tersedia di lingkungan ini. Pendaftaran dan proses
          masuk akan aktif setelah koneksi Supabase disiapkan.
        </AuthNotice>
      )}
      {unavailableRecovery && (
        <AuthNotice title="Tautan pemulihan tidak tersedia" tone="error">
          Buka tautan pemulihan terbaru dari email Anda. Jika tautan sudah
          kedaluwarsa atau digunakan,{" "}
          <Link
            href="/forgot-password"
            className="font-medium underline underline-offset-4"
          >
            minta tautan baru
          </Link>
          .
        </AuthNotice>
      )}
      <form action={formAction} aria-busy={pending} className="space-y-5">
        <input type="hidden" name="next" value={returnTo} />
        {mode === "register" && (
          <Input
            label="Nama lengkap"
            name="fullName"
            autoComplete="name"
            maxLength={120}
            required
            disabled={disabled}
            error={state.fieldErrors?.fullName}
            placeholder="Nama sesuai profil Anda"
          />
        )}
        {emailMode && (
          <Input
            label="Email"
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            maxLength={254}
            required
            disabled={disabled}
            error={state.fieldErrors?.email}
            placeholder="nama@contoh.com"
            autoCapitalize="none"
            spellCheck={false}
          />
        )}
        {passwordMode && (
          <PasswordInput
            label="Kata sandi"
            name="password"
            autoComplete={
              mode === "login" ? "current-password" : "new-password"
            }
            minLength={mode === "login" ? undefined : 8}
            required
            disabled={disabled}
            error={state.fieldErrors?.password}
            hint={
              mode === "login"
                ? undefined
                : "Gunakan minimal 8 karakter. Hindari memakai ulang kata sandi akun lain."
            }
          />
        )}
        {(mode === "register" || mode === "reset-password") && (
          <PasswordInput
            label="Konfirmasi kata sandi"
            name="confirmPassword"
            autoComplete="new-password"
            minLength={8}
            required
            disabled={disabled}
            error={state.fieldErrors?.confirmPassword}
            confirmation
          />
        )}
        {mode === "login" && (
          <div className="flex justify-end">
            <Link
              href={linkWithReturn("/forgot-password")}
              className="inline-flex min-h-11 items-center text-sm font-medium text-primary"
            >
              Lupa kata sandi?
            </Link>
          </div>
        )}
        <div aria-live="polite" aria-atomic="true">
          {state.message && state.status !== "idle" && (
            <AuthNotice tone={state.status === "error" ? "error" : "success"}>
              {state.message}
            </AuthNotice>
          )}
        </div>
        <Button type="submit" className="w-full" disabled={disabled}>
          {pending ? (
            <>
              <LoaderCircle className="animate-spin" aria-hidden="true" />{" "}
              Memproses…
            </>
          ) : (
            <>
              {submitLabels[mode]} <ArrowRight aria-hidden="true" />
            </>
          )}
        </Button>
        {mode === "register" && (
          <p className="text-xs leading-5 text-subtle">
            Akun baru memperoleh akses pengguna biasa. Verifikasi email
            diperlukan sebelum pengajuan dokumen.
          </p>
        )}
      </form>
      <div className="border-t border-border pt-5 text-center text-sm text-muted-foreground">
        {mode === "login" ? (
          <p>
            Belum memiliki akun?{" "}
            <Link
              href={linkWithReturn("/register")}
              className="inline-flex min-h-11 items-center font-medium text-primary"
            >
              Buat akun
            </Link>
          </p>
        ) : mode === "register" ? (
          <p>
            Sudah memiliki akun?{" "}
            <Link
              href={linkWithReturn("/login")}
              className="inline-flex min-h-11 items-center font-medium text-primary"
            >
              Masuk
            </Link>
          </p>
        ) : (
          <Link
            href={linkWithReturn("/login")}
            className="inline-flex min-h-11 items-center gap-2 font-medium text-primary"
          >
            <ArrowLeft size={16} aria-hidden="true" /> Kembali ke halaman masuk
          </Link>
        )}
      </div>
    </div>
  );
}
