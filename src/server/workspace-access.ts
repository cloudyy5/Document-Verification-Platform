import "server-only";
import type { AuthSession } from "@/lib/auth/session";
import { isAdminAccount } from "@/lib/auth/workspace";
import { ApiError } from "./errors";

export function assertUserWorkspaceAccess(session: AuthSession): void {
  if (isAdminAccount(session.roles))
    throw new ApiError(
      403,
      "USER_WORKSPACE_NOT_ALLOWED",
      "Akun administrator hanya dapat menggunakan Admin Workspace.",
    );
}
