import { z } from "zod";

export const NOTIFICATION_PAGE_SIZE = 20;
export const notificationCursorSchema = z.strictObject({
  at: z.iso.datetime({ offset: true }).max(40),
  id: z.uuid(),
});
const timestamp = z.iso.datetime({ offset: true }).max(40);
const target =
  /^\/(?:requests|documents)\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Notification links do not grant access; the destination rechecks permissions. */
export function safeNotificationTarget(value: string | null): string | null {
  return value && target.test(value) ? value : null;
}

export const notificationItemSchema = z.object({
  id: z.uuid(),
  title: z.string().min(1).max(160),
  body: z.string().max(1000),
  targetPath: z.string().regex(target).nullable(),
  createdAt: timestamp,
  readAt: timestamp.nullable(),
});
export const notificationPageSchema = z
  .object({
    items: z.array(notificationItemSchema).max(NOTIFICATION_PAGE_SIZE),
    unreadCount: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
    nextCursor: z
      .string()
      .min(1)
      .max(256)
      .regex(/^[A-Za-z0-9_-]+$/)
      .nullable(),
    hasMore: z.boolean(),
  })
  .refine((page) => page.hasMore === (page.nextCursor !== null));
export const notificationReadSchema = z.object({
  id: z.uuid(),
  readAt: timestamp,
});

export type NotificationItem = z.infer<typeof notificationItemSchema>;
export type NotificationPage = z.infer<typeof notificationPageSchema>;
