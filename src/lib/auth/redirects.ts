import type { AppRole } from "@/types/database";
import { isAdminAccount, isUserWorkspacePath } from "./workspace";

const returnOrigin = "https://document-verification.invalid";
const protectedPath =
  /^\/(dashboard|documents|submit|verify|profile|admin|signing|requests|receipts)(?:\/|$)/;

function checkedReturnTo(value: unknown): string | null {
  if (
    typeof value !== "string" ||
    value.length > 2048 ||
    value !== value.trim() ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\") ||
    [...value].some(
      (character) =>
        character.charCodeAt(0) <= 32 || character.charCodeAt(0) === 127,
    ) ||
    /%(?:0[0-9a-f]|1[0-9a-f]|7f|5c)/i.test(value)
  ) {
    return null;
  }

  const rawPath = value.split(/[?#]/, 1)[0];
  // Private routes use fixed names and opaque identifiers. Reject encoded or
  // ambiguous paths rather than letting different proxies decode them twice.
  if (!rawPath || rawPath.includes("%") || rawPath.includes("//")) return null;

  try {
    const parsed = new URL(value, returnOrigin);
    if (
      parsed.origin !== returnOrigin ||
      parsed.pathname !== rawPath ||
      !protectedPath.test(parsed.pathname) ||
      parsed.hash
    ) {
      return null;
    }
    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return null;
  }
}

/** Accept only unambiguous in-app private destinations; never auth loops. */
export function sanitizeReturnTo(
  value: unknown,
  fallback = "/dashboard",
): string {
  return checkedReturnTo(value) ?? checkedReturnTo(fallback) ?? "/dashboard";
}

export function defaultWorkspacePath(
  roles: readonly AppRole[],
): "/admin/overview" | "/admin/review-queue" | "/dashboard" {
  if (isAdminAccount(roles)) return "/admin/overview";
  return roles.includes("reviewer") ? "/admin/review-queue" : "/dashboard";
}

/** Return-path hints do not grant a role or override page authorization. */
export function resolveAuthorizedReturnTo(
  value: unknown,
  roles: readonly AppRole[],
): string {
  const fallback = defaultWorkspacePath(roles);
  const target = sanitizeReturnTo(value, fallback);
  const pathname = new URL(target, returnOrigin).pathname;
  if (isAdminAccount(roles) && isUserWorkspacePath(pathname)) return fallback;
  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    if (!roles.includes("reviewer") && !roles.includes("platform_admin")) {
      return "/dashboard";
    }
    if (
      /^\/admin\/(overview|operations)(?:\/|$)/.test(pathname) &&
      !roles.includes("platform_admin")
    )
      return fallback;
    if (
      /^\/admin\/(review-queue|review-history)(?:\/|$)/.test(pathname) &&
      !roles.includes("reviewer")
    ) {
      return fallback;
    }
  }
  return target;
}
