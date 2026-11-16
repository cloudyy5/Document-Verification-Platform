import "server-only";
import { z } from "zod";
import { AuthAvailabilityError, type AuthSession } from "@/lib/auth/session";
import { isAdminAccount } from "@/lib/auth/workspace";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  NOTIFICATION_PAGE_SIZE,
  notificationCursorSchema,
  notificationPageSchema,
  notificationReadSchema,
  safeNotificationTarget,
} from "@/lib/notifications/schema";
import { apiSession } from "./api";
import { ApiError } from "./errors";

type Context = {
  session: AuthSession;
  client: Awaited<ReturnType<typeof createSupabaseServerClient>>;
};
const timestamp = z.iso.datetime({ offset: true }).max(40);
const rowSchema = z.object({
  id: z.uuid(),
  user_id: z.uuid(),
  title: z.string().min(1).max(160),
  body: z.string().max(1000),
  target_path: z.string().nullable(),
  created_at: timestamp,
  read_at: timestamp.nullable(),
});
const readRowSchema = rowSchema.pick({
  id: true,
  user_id: true,
  read_at: true,
});
const fields = "id,user_id,title,body,target_path,created_at,read_at";
const readFields = "id,user_id,read_at";
const listSchema = z.strictObject({
  cursor: z
    .string()
    .min(1)
    .max(256)
    .regex(/^[A-Za-z0-9_-]+$/)
    .optional(),
});

function unavailable() {
  return new ApiError(
    503,
    "NOTIFICATIONS_UNAVAILABLE",
    "Notifikasi belum dapat dimuat. Silakan coba kembali.",
  );
}
async function withAccount<T>(
  run: (context: Context) => Promise<T>,
): Promise<T> {
  try {
    // Shared account feature, like profile; never global admin monitoring.
    const session = await apiSession("account");
    const client = await createSupabaseServerClient();
    return await run({ session, client });
  } catch (error) {
    if (error instanceof ApiError || error instanceof AuthAvailabilityError)
      throw error;
    throw unavailable();
  }
}

export async function getOwnNotifications(input: unknown = {}) {
  return withAccount(async ({ client, session }) => {
    const parameters = listSchema.safeParse(input);
    if (!parameters.success)
      throw new ApiError(
        422,
        "VALIDATION_ERROR",
        "Parameter notifikasi tidak valid.",
      );
    let after: z.infer<typeof notificationCursorSchema> | undefined;
    if (parameters.data.cursor) {
      try {
        after = notificationCursorSchema.parse(
          JSON.parse(
            Buffer.from(parameters.data.cursor, "base64url").toString("utf8"),
          ),
        );
      } catch {
        throw new ApiError(
          422,
          "VALIDATION_ERROR",
          "Halaman notifikasi tidak valid.",
        );
      }
    }
    let query = client
      .from("notifications")
      .select(fields)
      .eq("user_id", session.user.id)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(NOTIFICATION_PAGE_SIZE + 1);
    if (after)
      query = query.or(
        `created_at.lt.${after.at},and(created_at.eq.${after.at},id.lt.${after.id})`,
      );
    const [list, unread] = await Promise.all([
      query,
      client
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", session.user.id)
        .is("read_at", null),
    ]);
    if (list.error || unread.error || !list.data) throw unavailable();
    const rows = z
      .array(rowSchema)
      .max(NOTIFICATION_PAGE_SIZE + 1)
      .parse(list.data);
    if (rows.some((row) => row.user_id !== session.user.id))
      throw unavailable();
    const visible = rows.slice(0, NOTIFICATION_PAGE_SIZE);
    const last = visible.at(-1);
    const hasMore = rows.length > NOTIFICATION_PAGE_SIZE;
    return notificationPageSchema.parse({
      items: visible.map((row) => ({
        id: row.id,
        title: row.title,
        body: row.body,
        // Admins keep their own history without links into User Workspace.
        targetPath: isAdminAccount(session.roles)
          ? null
          : safeNotificationTarget(row.target_path),
        createdAt: row.created_at,
        readAt: row.read_at,
      })),
      unreadCount: unread.count,
      hasMore,
      nextCursor:
        hasMore && last
          ? Buffer.from(
              JSON.stringify({ at: last.created_at, id: last.id }),
            ).toString("base64url")
          : null,
    });
  });
}

export async function markOwnNotificationRead(notificationId: string) {
  return withAccount(async ({ client, session }) => {
    if (!z.uuid().safeParse(notificationId).success)
      throw new ApiError(
        422,
        "VALIDATION_ERROR",
        "Referensi notifikasi tidak valid.",
      );
    const id = notificationId.toLowerCase();
    const selectOwn = () =>
      client
        .from("notifications")
        .select(readFields)
        .eq("id", id)
        .eq("user_id", session.user.id)
        .maybeSingle();
    const before = await selectOwn();
    if (before.error) throw unavailable();
    if (!before.data)
      throw new ApiError(404, "NOT_FOUND", "Notifikasi tidak ditemukan.");
    const current = readRowSchema.parse(before.data);
    if (current.id !== id || current.user_id !== session.user.id)
      throw unavailable();
    if (current.read_at)
      return notificationReadSchema.parse({ id, readAt: current.read_at });
    const updated = await client
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", session.user.id)
      .is("read_at", null)
      .select(readFields)
      .maybeSingle();
    if (updated.error) throw unavailable();
    // A second tab can win the conditional update; preserve its timestamp.
    const result = updated.data ? updated : await selectOwn();
    if (result.error || !result.data) throw unavailable();
    const row = readRowSchema.parse(result.data);
    if (row.id !== id || row.user_id !== session.user.id || !row.read_at)
      throw unavailable();
    return notificationReadSchema.parse({ id, readAt: row.read_at });
  });
}
