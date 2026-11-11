import type { AppRole } from "@/types/database";

/** Platform administrators use only the admin workspace, even with a user role. */
export function isAdminAccount(roles: readonly AppRole[]): boolean {
  return roles.includes("platform_admin");
}

/** Profile/settings belong to the account and can render in either shell. */
export function isUserWorkspacePath(pathname: string): boolean {
  return /^\/(dashboard|documents|submit|verify|signing|requests|receipts)(?:\/|$)/.test(
    pathname,
  );
}
