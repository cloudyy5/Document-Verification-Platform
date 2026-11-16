import { apiRoute, apiSession } from "@/server/api";
import { ApiError } from "@/server/errors";
import { getOwnNotifications } from "@/server/notifications";

export async function GET(request: Request) {
  return apiRoute(async () => {
    await apiSession("account");
    const query = new URL(request.url).searchParams;
    if (
      [...query.keys()].some((key) => key !== "cursor") ||
      query.getAll("cursor").length > 1
    )
      throw new ApiError(
        422,
        "VALIDATION_ERROR",
        "Parameter notifikasi tidak valid.",
      );
    return getOwnNotifications(
      query.has("cursor") ? { cursor: query.get("cursor")! } : {},
    );
  });
}
