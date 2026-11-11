"use client";

import {
  createContext,
  useCallback,
  useContext,
  useId,
  useState,
  type ReactNode,
} from "react";
import { CheckCircle2, Info, TriangleAlert, X } from "lucide-react";
import { cn } from "@/lib/utils";

type NotificationTone = "info" | "success" | "error";
type NotificationInput = {
  title: string;
  description?: string;
  tone?: NotificationTone;
};
type Notification = NotificationInput & { id: string };
type NotificationContextValue = {
  notify: (notification: NotificationInput) => void;
};

const NotificationContext = createContext<NotificationContextValue | null>(
  null,
);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const instanceId = useId();
  const notify = useCallback(
    (notification: NotificationInput) => {
      const id = `${instanceId}-${crypto.randomUUID()}`;
      setNotifications((previous) => [
        ...previous.slice(-3),
        { ...notification, id },
      ]);
    },
    [instanceId],
  );

  return (
    <NotificationContext.Provider value={{ notify }}>
      {children}
      <div
        aria-label="Notifikasi"
        className="pointer-events-none fixed bottom-4 right-4 z-[80] flex w-[calc(100%_-_2rem)] max-w-sm flex-col gap-3"
      >
        {notifications.map(({ id, title, description, tone = "info" }) => {
          const Icon =
            tone === "success"
              ? CheckCircle2
              : tone === "error"
                ? TriangleAlert
                : Info;
          return (
            <div
              key={id}
              role={tone === "error" ? "alert" : "status"}
              className="pointer-events-auto flex gap-3 rounded-lg border border-border bg-surface p-4 shadow-[var(--shadow-popover)]"
            >
              <Icon
                aria-hidden="true"
                className={cn(
                  "mt-0.5 size-5 shrink-0",
                  tone === "success"
                    ? "text-success"
                    : tone === "error"
                      ? "text-danger"
                      : "text-info",
                )}
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground">{title}</p>
                {description && (
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    {description}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() =>
                  setNotifications((previous) =>
                    previous.filter((notification) => notification.id !== id),
                  )
                }
                className="-mr-2 -mt-2 flex size-11 shrink-0 items-center justify-center rounded-md text-subtle hover:bg-muted hover:text-foreground"
                aria-label={`Tutup notifikasi: ${title}`}
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </div>
          );
        })}
      </div>
    </NotificationContext.Provider>
  );
}

export function useNotification() {
  const context = useContext(NotificationContext);
  if (!context)
    throw new Error(
      "useNotification harus digunakan di dalam NotificationProvider.",
    );
  return context;
}
