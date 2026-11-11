import { AuthForm, type AuthMode } from "@/components/auth/auth-form";
import { AuthNotice } from "@/components/auth/auth-notice";
import { getAuthPageContext } from "@/lib/auth/page-context";
import { KeyRound, Mail, UserPlus } from "lucide-react";

export type AuthSearchParams = Promise<{
  next?: string;
  error?: string;
  notice?: string;
}>;

const content: Record<AuthMode, { title: string; description: string }> = {
  login: {
    title: "Masuk ke akun Anda",
    description:
      "Masuk dengan email dan kata sandi untuk melanjutkan pekerjaan Anda.",
  },
  register: {
    title: "Buat akun",
    description:
      "Mulai dengan profil pengguna untuk mengakses workspace dokumen Anda.",
  },
  "forgot-password": {
    title: "Lupa kata sandi?",
    description:
      "Masukkan email akun Anda. Jika alamat dapat diproses, instruksi pemulihan akan dikirim melalui email.",
  },
  "reset-password": {
    title: "Buat kata sandi baru",
    description:
      "Gunakan tautan pemulihan yang valid untuk mengganti kata sandi akun Anda.",
  },
  "verify-email": {
    title: "Periksa email Anda",
    description:
      "Buka tautan verifikasi di email untuk mengonfirmasi alamat Anda. Periksa juga folder spam. Jika perlu, minta email baru di bawah.",
  },
};

const safeErrors: Record<string, string> = {
  invalid_link:
    "Tautan tidak dapat digunakan. Minta tautan baru untuk melanjutkan.",
  expired_link:
    "Tautan sudah tidak berlaku. Minta tautan terbaru dari halaman ini.",
  invalid_callback:
    "Tautan autentikasi tidak dapat diproses. Silakan coba kembali.",
  session_expired: "Sesi tidak tersedia. Silakan masuk kembali.",
  recovery_required:
    "Buka tautan pemulihan yang dikirim ke email Anda untuk melanjutkan.",
  access_denied: "Akun Anda tidak memiliki akses ke halaman tersebut.",
  auth_unavailable:
    "Layanan autentikasi belum dapat digunakan. Silakan coba kembali nanti.",
};

const safeNotices: Record<string, string> = {
  email_verified:
    "Alamat email telah dikonfirmasi. Silakan masuk untuk melanjutkan.",
  check_email:
    "Jika alamat email dapat diproses, instruksi akan dikirim. Periksa juga folder spam.",
  password_updated: "Silakan masuk menggunakan kata sandi terbaru Anda.",
  signed_out: "Anda dapat masuk kembali untuk mengakses workspace.",
};

export async function AuthPage({
  mode,
  searchParams,
}: {
  mode: AuthMode;
  searchParams: AuthSearchParams;
}) {
  const params = await searchParams;
  const context = await getAuthPageContext(params.next);
  const copy = content[mode];
  const Icon =
    mode === "register"
      ? UserPlus
      : mode === "verify-email" || mode === "forgot-password"
        ? Mail
        : KeyRound;
  const error =
    typeof params.error === "string" && Object.hasOwn(safeErrors, params.error)
      ? safeErrors[params.error]
      : undefined;
  const notice =
    typeof params.notice === "string" &&
    Object.hasOwn(safeNotices, params.notice)
      ? safeNotices[params.notice]
      : undefined;

  return (
    <div className="space-y-7">
      <div>
        <span className="mb-6 inline-flex size-11 items-center justify-center rounded-lg border border-border bg-surface text-muted-foreground">
          <Icon size={20} strokeWidth={1.7} aria-hidden="true" />
        </span>
        <p className="mb-2 text-xs font-medium uppercase tracking-[0.13em] text-subtle">
          Akses akun
        </p>
        <h1 className="text-[28px] font-semibold leading-9 tracking-tight">
          {copy.title}
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          {copy.description}
        </p>
      </div>
      {error && <AuthNotice tone="error">{error}</AuthNotice>}
      {!error && notice && <AuthNotice>{notice}</AuthNotice>}
      <AuthForm
        key={mode}
        mode={mode}
        configured={context.configured}
        returnTo={context.returnTo}
        recoveryAllowed={context.recoveryAllowed}
      />
    </div>
  );
}
