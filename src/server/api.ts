import "server-only";
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthSession, AuthAvailabilityError } from "@/lib/auth/session";
import { getAppOrigin } from "@/lib/auth/config";
import { isAllowedAuthOrigin } from "@/lib/auth/origin";
import {
  WorkspaceAccessError,
  WorkspaceAvailabilityError,
  WorkspaceValidationError,
} from "@/server/workspace/queries";
import { ApiError } from "./errors";
import { assertUserWorkspaceAccess } from "./workspace-access";

export const privateHeaders = {
  "Cache-Control": "private, no-store",
  Vary: "Cookie",
};
export async function apiSession(scope: "account" | "user" = "account") {
  const session = await getAuthSession();
  if (!session)
    throw new ApiError(
      401,
      "UNAUTHENTICATED",
      "Silakan masuk untuk melanjutkan.",
    );
  if (scope === "user") assertUserWorkspaceAccess(session);
  return session;
}
export function assertMutationOrigin(origin: string | null) {
  if (!isAllowedAuthOrigin(origin, getAppOrigin()))
    throw new ApiError(
      403,
      "INVALID_ORIGIN",
      "Permintaan tidak dapat diproses. Buka aplikasi dari alamat yang benar.",
    );
}
export function apiFailure(error: unknown, requestId = randomUUID()) {
  let status = 500;
  let code = "INTERNAL_ERROR";
  let message = "Permintaan belum dapat diproses. Silakan coba kembali.";
  let fields: { field: string; message: string }[] = [];
  if (
    error instanceof ApiError ||
    error instanceof WorkspaceAccessError ||
    error instanceof WorkspaceAvailabilityError ||
    error instanceof WorkspaceValidationError
  ) {
    ({ status, code, message } = error);
    if ("fields" in error) fields = error.fields;
  } else if (error instanceof AuthAvailabilityError) {
    status = 503;
    code = "AUTH_UNAVAILABLE";
    message = "Layanan autentikasi sementara tidak tersedia.";
  } else if (error instanceof z.ZodError) {
    status = 422;
    code = "VALIDATION_ERROR";
    message = "Periksa kembali data yang dikirim.";
    fields = error.issues.map((issue) => ({
      field: String(issue.path[0] ?? "form"),
      message:
        issue.code === "custom"
          ? issue.message
          : "Nilai tidak valid atau melebihi batas.",
    }));
  }
  return NextResponse.json(
    { error: { code, message, fields, requestId } },
    { status, headers: privateHeaders },
  );
}
export async function apiRoute(run: () => Promise<unknown>, status = 200) {
  const requestId = randomUUID();
  try {
    const result = await run();
    if (result instanceof Response) return result;
    return NextResponse.json(
      { data: result, meta: { requestId } },
      { status, headers: privateHeaders },
    );
  } catch (error) {
    return apiFailure(error, requestId);
  }
}
