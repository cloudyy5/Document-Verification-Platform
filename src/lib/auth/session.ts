import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { getPublicEnv } from "@/lib/env/public";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { sanitizeReturnTo } from "@/lib/auth/redirects";
import { isAdminAccount } from "@/lib/auth/workspace";
import type { AppRole } from "@/types/database";

export interface AuthSession {
  user: {
    id: string;
    email?: string;
    emailConfirmed: boolean;
    fullName?: string;
  };
  roles: AppRole[];
}

export class AuthAvailabilityError extends Error {
  constructor() {
    super(
      "Layanan autentikasi sementara tidak tersedia. Silakan coba kembali.",
    );
    this.name = "AuthAvailabilityError";
  }
}

function isAppRole(role: unknown): role is AppRole {
  return role === "user" || role === "reviewer" || role === "platform_admin";
}

/** React cache deduplicates only within a render, never between users. */
export const getAuthSession = cache(async (): Promise<AuthSession | null> => {
  try {
    getPublicEnv();
  } catch {
    // An unconfigured installation has no authenticated workspace access.
    return null;
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.getUser();
    if (error) {
      if (
        error.name === "AuthRetryableFetchError" ||
        error.status === 0 ||
        (error.status ?? 0) >= 500
      ) {
        throw new AuthAvailabilityError();
      }
      return null;
    }
    if (!data.user) return null;

    const user = data.user;
    const [rolesResult, profileResult] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", user.id),
      supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .maybeSingle(),
    ]);
    if (rolesResult.error || profileResult.error)
      throw new AuthAvailabilityError();

    const roles = [
      ...new Set(
        (rolesResult.data ?? []).map((row) => row.role).filter(isAppRole),
      ),
    ];
    if (!roles.length) throw new AuthAvailabilityError();

    const fullName = profileResult.data?.full_name?.trim();
    return {
      user: {
        id: user.id,
        ...(user.email ? { email: user.email } : {}),
        emailConfirmed: Boolean(user.email_confirmed_at),
        ...(fullName ? { fullName } : {}),
      },
      roles,
    };
  } catch (error) {
    if (error instanceof AuthAvailabilityError) throw error;
    throw new AuthAvailabilityError();
  }
});

function loginDestination(returnTo: unknown) {
  return `/login?next=${encodeURIComponent(sanitizeReturnTo(returnTo))}`;
}

export async function requireAuthenticated(
  returnTo = "/dashboard",
): Promise<AuthSession> {
  const session = await getAuthSession();
  if (!session) redirect(loginDestination(returnTo));
  return session;
}

export async function requireReviewer(
  returnTo = "/admin/review-queue",
): Promise<AuthSession> {
  const session = await requireAuthenticated(returnTo);
  if (!session.roles.includes("reviewer")) redirect("/access-denied");
  return session;
}

/** Check in each page as well as the DAL; layouts can be reused during navigation. */
export async function requireUserWorkspace(
  returnTo = "/dashboard",
): Promise<AuthSession> {
  const session = await requireAuthenticated(returnTo);
  if (isAdminAccount(session.roles)) redirect("/admin/overview");
  return session;
}

export async function requireAdminWorkspace(
  returnTo = "/admin/overview",
): Promise<AuthSession> {
  const session = await requireAuthenticated(returnTo);
  if (
    !session.roles.includes("reviewer") &&
    !session.roles.includes("platform_admin")
  ) {
    redirect("/access-denied");
  }
  return session;
}

/** R4 is separate from archived reviewer access and never grants PDF access. */
export async function requirePlatformAdmin(
  returnTo = "/admin/overview",
): Promise<AuthSession> {
  const session = await requireAuthenticated(returnTo);
  if (!session.roles.includes("platform_admin")) redirect("/access-denied");
  if (!session.user.emailConfirmed)
    redirect(
      `/verify-email?next=${encodeURIComponent(sanitizeReturnTo(returnTo))}`,
    );
  return session;
}

/** For the submission policy when the owner has approved requiring email verification. */
export async function requireVerifiedEmail(
  returnTo = "/submit",
): Promise<AuthSession> {
  const session = await requireUserWorkspace(returnTo);
  if (!session.user.emailConfirmed) {
    redirect(
      `/verify-email?next=${encodeURIComponent(sanitizeReturnTo(returnTo))}`,
    );
  }
  return session;
}
