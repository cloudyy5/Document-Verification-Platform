import { z } from "zod";
import { apiRoute, apiSession, assertMutationOrigin } from "@/server/api";
import { readSmallJson } from "@/server/json";
import { markOwnNotificationRead } from "@/server/notifications";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ notificationId: string }> },
) {
  return apiRoute(async () => {
    await apiSession("account");
    assertMutationOrigin(request.headers.get("origin"));
    z.strictObject({}).parse(await readSmallJson(request));
    const { notificationId } = await context.params;
    return markOwnNotificationRead(notificationId);
  });
}
