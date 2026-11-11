"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAppOrigin, getAuthConfiguration } from "@/lib/auth/config";
import { isAllowedAuthOrigin } from "@/lib/auth/origin";
import {
  authFields,
  loginSchema,
  registerSchema,
  emailSchema,
  resetPasswordSchema,
} from "@/lib/auth/validation";
import { allowAuthAttempt } from "@/lib/auth/rate-limit";
import { getAuthSession } from "@/lib/auth/session";
import { resolveAuthorizedReturnTo } from "@/lib/auth/redirects";
import {
  getRecoveryContext,
  consumeRecoveryGrant,
  clearRecoveryProof,
} from "@/lib/auth/recovery";
import { clearLocalAuthCookies } from "@/lib/auth/cookies";
import { requireProviderEmailConfirmation } from "@/lib/auth/provider-policy";
import type { AuthActionState } from "@/lib/auth/types";

const unavailable: AuthActionState = {
  status: "error",
  message:
    "Layanan autentikasi sementara tidak tersedia. Silakan coba kembali nanti.",
};
const limited: AuthActionState = {
  status: "error",
  message:
    "Terlalu banyak permintaan. Tunggu beberapa saat sebelum mencoba kembali.",
};
const invalidRequest: AuthActionState = {
  status: "error",
  message:
    "Permintaan tidak dapat diproses. Muat ulang halaman dan coba kembali.",
};
const genericEmail: AuthActionState = {
  status: "success",
  message:
    "Jika alamat email dapat diproses, instruksi akan dikirim. Periksa email dan folder spam Anda.",
};

async function validOrigin() {
  const { appOrigin } = getAuthConfiguration();
  return isAllowedAuthOrigin((await headers()).get("origin"), appOrigin);
}

function validationState(error: z.ZodError): AuthActionState {
  const fieldErrors: NonNullable<AuthActionState["fieldErrors"]> = {};
  for (const issue of error.issues) {
    const field = issue.path[0];
    if (
      field === "fullName" ||
      field === "email" ||
      field === "password" ||
      field === "confirmPassword"
    )
      fieldErrors[field] ??= issue.message;
  }
  return {
    status: "error",
    message: "Periksa kembali data yang diisi.",
    fieldErrors,
  };
}

function providerUnavailable(error: { status?: number; name?: string } | null) {
  return (
    error &&
    ((error.status ?? 0) >= 500 ||
      error.status === 0 ||
      error.name === "AuthRetryableFetchError")
  );
}

export async function loginAction(
  _previous: AuthActionState,
  form: FormData,
): Promise<AuthActionState> {
  let destination: string;
  try {
    if (!(await validOrigin())) return invalidRequest;
    const result = loginSchema.safeParse(authFields(form));
    if (!result.success) return validationState(result.error);
    if (!(await allowAuthAttempt("login", result.data.email))) return limited;
    const client = await createSupabaseServerClient();
    const { data, error } = await client.auth.signInWithPassword(result.data);
    if (error || !data.user)
      return providerUnavailable(error)
        ? unavailable
        : {
            status: "error",
            message:
              "Email atau kata sandi tidak sesuai, atau akun belum dapat digunakan. Periksa kembali data Anda.",
          };
    const session = await getAuthSession();
    if (!session) return unavailable;
    await clearRecoveryProof();
    destination = resolveAuthorizedReturnTo(form.get("next"), session.roles);
  } catch {
    return unavailable;
  }
  redirect(destination);
}

export async function registerAction(
  _previous: AuthActionState,
  form: FormData,
): Promise<AuthActionState> {
  try {
    if (!(await validOrigin())) return invalidRequest;
    const result = registerSchema.safeParse(authFields(form));
    if (!result.success) return validationState(result.error);
    if (!(await allowAuthAttempt("register", result.data.email)))
      return limited;
    await requireProviderEmailConfirmation();
    const { appOrigin } = getAuthConfiguration();
    const client = await createSupabaseServerClient();
    try {
      const { data } = await client.auth.signUp({
        email: result.data.email,
        password: result.data.password,
        options: {
          data: { full_name: result.data.fullName },
          emailRedirectTo: `${appOrigin}/auth/callback`,
        },
      });
      if (data.session) {
        try {
          await client.auth.signOut({ scope: "local" });
        } finally {
          await clearLocalAuthCookies();
        }
      }
    } catch {
      /* Delivery/provider failures receive the same conditional response. */
    }
    // Duplicate/unavailable accounts receive the same conditional response.
    return genericEmail;
  } catch {
    return unavailable;
  }
}

export async function forgotPasswordAction(
  _previous: AuthActionState,
  form: FormData,
): Promise<AuthActionState> {
  try {
    if (!(await validOrigin())) return invalidRequest;
    const result = emailSchema.safeParse(authFields(form));
    if (!result.success) return validationState(result.error);
    if (!(await allowAuthAttempt("recovery", result.data.email)))
      return limited;
    const { appOrigin } = getAuthConfiguration();
    const client = await createSupabaseServerClient();
    try {
      await client.auth.resetPasswordForEmail(result.data.email, {
        redirectTo: `${appOrigin}/auth/confirm`,
      });
    } catch {
      /* Never reveal whether this address triggered an SMTP request. */
    }
    return genericEmail;
  } catch {
    return unavailable;
  }
}

export async function resendVerificationAction(
  _previous: AuthActionState,
  form: FormData,
): Promise<AuthActionState> {
  try {
    if (!(await validOrigin())) return invalidRequest;
    const result = emailSchema.safeParse(authFields(form));
    if (!result.success) return validationState(result.error);
    if (!(await allowAuthAttempt("resend", result.data.email))) return limited;
    const { appOrigin } = getAuthConfiguration();
    const client = await createSupabaseServerClient();
    try {
      await client.auth.resend({
        type: "signup",
        email: result.data.email,
        options: { emailRedirectTo: `${appOrigin}/auth/callback` },
      });
    } catch {
      /* Never reveal whether this address triggered an SMTP request. */
    }
    return genericEmail;
  } catch {
    return unavailable;
  }
}

export async function resetPasswordAction(
  _previous: AuthActionState,
  form: FormData,
): Promise<AuthActionState> {
  try {
    if (!(await validOrigin())) return invalidRequest;
    const result = resetPasswordSchema.safeParse(authFields(form));
    if (!result.success) return validationState(result.error);
    const recovery = await getRecoveryContext();
    if (!recovery)
      return {
        status: "error",
        message:
          "Tautan pemulihan tidak tersedia atau sudah digunakan. Minta tautan baru untuk melanjutkan.",
      };
    if (!(await allowAuthAttempt("reset", recovery.proof.userId)))
      return limited;
    if (!(await consumeRecoveryGrant(recovery))) return invalidRequest;
    await clearRecoveryProof();
    const { error } = await recovery.client.auth.updateUser({
      password: result.data.password,
    });
    if (error)
      return {
        status: "error",
        message:
          "Kata sandi belum dapat diperbarui. Minta tautan pemulihan baru dan coba kembali.",
      };
    try {
      await recovery.client.auth.signOut({ scope: "global" });
    } finally {
      await clearLocalAuthCookies();
    }
  } catch {
    return unavailable;
  }
  redirect("/login?notice=password_updated");
}

export async function logoutAction(): Promise<void> {
  try {
    if (!isAllowedAuthOrigin((await headers()).get("origin"), getAppOrigin()))
      return;
  } catch {
    return;
  }
  try {
    const client = await createSupabaseServerClient();
    await client.auth.signOut({ scope: "local" });
  } catch {
    // Local logout remains available during provider or unrelated config failure.
  } finally {
    await clearLocalAuthCookies();
  }
  redirect("/login?notice=signed_out");
}
