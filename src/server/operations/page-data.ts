import "server-only";
import { redirect } from "next/navigation";
import { requirePlatformAdmin } from "@/lib/auth/session";
import { ApiError } from "@/server/errors";
import { getOperationsSnapshot } from "./queries";
export async function loadOperationsPage(path: string) {
  await requirePlatformAdmin(path);
  try {
    return await getOperationsSnapshot();
  } catch (error) {
    if (error instanceof ApiError && error.status === 403)
      redirect("/access-denied");
    if (error instanceof ApiError && error.status === 503) return null;
    throw error;
  }
}
