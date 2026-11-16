"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  Bell,
  Check,
  LoaderCircle,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  notificationPageSchema,
  notificationReadSchema,
  type NotificationItem,
  type NotificationPage,
} from "@/lib/notifications/schema";

const endpoint = "/api/v1/notifications";
const dateFormat = new Intl.DateTimeFormat("id-ID", {
  dateStyle: "medium",
  timeStyle: "short",
});

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<NotificationPage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [readingId, setReadingId] = useState<string | null>(null);
  const active = useRef(false);
  const openRef = useRef(false);
  const sequence = useRef(0);
  const pending = useRef<AbortController | null>(null);
  const cancelPending = useCallback(() => {
    ++sequence.current;
    pending.current?.abort();
  }, []);

  const load = useCallback(async (cursor?: string) => {
    const request = ++sequence.current;
    pending.current?.abort();
    const controller = new AbortController();
    pending.current = controller;
    try {
      const response = await fetch(
        cursor ? `${endpoint}?cursor=${encodeURIComponent(cursor)}` : endpoint,
        {
          credentials: "same-origin",
          cache: "no-store",
          signal: AbortSignal.any([
            controller.signal,
            AbortSignal.timeout(15_000),
          ]),
        },
      );
      if (response.status === 401) {
        if (active.current && request === sequence.current) setData(null);
        throw new Error(
          "Sesi Anda telah berakhir. Masuk kembali untuk membaca notifikasi.",
        );
      }
      if (!response.ok)
        throw new Error("Notifikasi belum dapat dimuat. Silakan coba kembali.");
      const body: unknown = await response.json();
      const page = notificationPageSchema.parse(
        typeof body === "object" && body !== null && "data" in body
          ? body.data
          : null,
      );
      if (!active.current || request !== sequence.current) return;
      setData((previous) => ({
        ...page,
        items:
          cursor && previous
            ? [
                ...previous.items,
                ...page.items.filter(
                  (item) => !previous.items.some((old) => old.id === item.id),
                ),
              ]
            : page.items,
      }));
      setError(null);
    } catch (failure) {
      if (
        !active.current ||
        request !== sequence.current ||
        controller.signal.aborted
      )
        return;
      setError(
        failure instanceof Error && failure.message.startsWith("Sesi Anda")
          ? failure.message
          : "Notifikasi belum dapat dimuat. Silakan coba kembali.",
      );
    } finally {
      if (active.current && request === sequence.current) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  }, []);

  useEffect(() => {
    active.current = true;
    const initialLoad = window.setTimeout(() => void load(), 0);
    const refreshVisible = () => {
      if (document.visibilityState === "visible" && !openRef.current)
        void load();
    };
    const timer = window.setInterval(refreshVisible, 30_000);
    window.addEventListener("focus", refreshVisible);
    document.addEventListener("visibilitychange", refreshVisible);
    return () => {
      active.current = false;
      cancelPending();
      window.clearTimeout(initialLoad);
      window.clearInterval(timer);
      window.removeEventListener("focus", refreshVisible);
      document.removeEventListener("visibilitychange", refreshVisible);
    };
  }, [load, cancelPending]);

  async function markRead(item: NotificationItem) {
    if (item.readAt || readingId) return;
    setReadingId(item.id);
    cancelPending();
    try {
      const response = await fetch(`${endpoint}/${item.id}/read`, {
        method: "PATCH",
        credentials: "same-origin",
        cache: "no-store",
        keepalive: true,
        headers: { "Content-Type": "application/json" },
        body: "{}",
        signal: AbortSignal.timeout(15_000),
      });
      if (response.status === 401) {
        if (active.current) setData(null);
        throw new Error("SESSION_EXPIRED");
      }
      if (!response.ok) throw new Error("Read failed");
      const body = await response.json();
      const result = notificationReadSchema.parse(body.data);
      if (result.id !== item.id) throw new Error("Read confirmation mismatch");
      if (active.current) {
        setData(
          (previous) =>
            previous && {
              ...previous,
              items: previous.items.map((old) =>
                old.id === result.id ? { ...old, readAt: result.readAt } : old,
              ),
            },
        );
        // Obtain the actual count again, including activity from another tab.
        await load();
      }
    } catch (failure) {
      if (active.current)
        setError(
          failure instanceof Error && failure.message === "SESSION_EXPIRED"
            ? "Sesi Anda telah berakhir. Masuk kembali untuk membaca notifikasi."
            : "Status dibaca belum dapat disimpan. Silakan coba kembali.",
        );
    } finally {
      if (active.current) {
        setReadingId(null);
        setLoading(false);
        setLoadingMore(false);
      }
    }
  }

  const count = data && !error ? data.unreadCount : null;
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        openRef.current = value;
        setOpen(value);
        if (value) {
          setLoading(true);
          void load();
        }
      }}
    >
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={
            count !== null
              ? `Buka notifikasi, ${count} belum dibaca`
              : "Buka notifikasi"
          }
        >
          <Bell aria-hidden="true" />
          {count !== null && count > 0 && (
            <span
              aria-hidden="true"
              className="absolute right-0 top-0 min-w-4 rounded-full bg-primary px-1 text-[10px] font-semibold leading-4 text-primary-foreground"
            >
              {count > 99 ? "99+" : count}
            </span>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="p-0 sm:max-w-lg">
        <DialogHeader className="m-0 border-b border-border px-5 pb-4 pt-5">
          <DialogTitle>Notifikasi</DialogTitle>
          <DialogDescription>
            Permintaan dan tanggapan untuk akun Anda.
          </DialogDescription>
        </DialogHeader>
        <div className="flex min-h-14 items-center justify-between gap-3 border-b border-border px-5 py-2">
          <p className="text-xs text-muted-foreground" role="status">
            {error
              ? "Data belum diperbarui"
              : data
                ? `${data.unreadCount} belum dibaca`
                : "Memuat notifikasi…"}
          </p>
          <Button
            variant="ghost"
            size="sm"
            disabled={loading || loadingMore || readingId !== null}
            onClick={() => {
              setLoading(true);
              void load();
            }}
          >
            {loading ? (
              <LoaderCircle className="animate-spin" aria-hidden="true" />
            ) : (
              <RefreshCw aria-hidden="true" />
            )}{" "}
            Perbarui
          </Button>
        </div>
        <div className="max-h-[65dvh] overflow-y-auto overscroll-contain">
          {error && (
            <p
              role="alert"
              className="border-b border-border bg-danger/5 px-5 py-4 text-sm leading-6 text-danger"
            >
              {error}
            </p>
          )}
          {!data && !error && (
            <p
              role="status"
              className="px-5 py-10 text-center text-sm text-muted-foreground"
            >
              Memuat notifikasi…
            </p>
          )}
          {data && data.items.length === 0 && !error && (
            <div className="px-5 py-10 text-center">
              <Bell
                className="mx-auto mb-3 size-6 text-subtle"
                aria-hidden="true"
              />
              <p className="text-sm font-semibold">Belum ada notifikasi</p>
              <p className="mt-2 text-xs leading-6 text-muted-foreground">
                Permintaan masuk, pembatalan, dan tanggapan akan tampil di sini.
              </p>
            </div>
          )}
          {data?.items.map((item) => (
            <article
              key={item.id}
              className="border-b border-border px-5 py-4 last:border-b-0"
            >
              <div className="flex items-start gap-3">
                <span
                  aria-hidden="true"
                  className={`mt-2 size-2 shrink-0 rounded-full ${item.readAt ? "bg-border" : "bg-primary"}`}
                />
                <div className="min-w-0 flex-1">
                  <h3 className="break-words text-sm font-semibold leading-6">
                    {item.title}
                  </h3>
                  <p className="mt-1 break-words text-xs leading-6 text-muted-foreground">
                    {item.body}
                  </p>
                  <time
                    dateTime={item.createdAt}
                    className="mt-2 block text-xs text-subtle"
                  >
                    {dateFormat.format(new Date(item.createdAt))}
                  </time>
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                    {item.targetPath && (
                      <Link
                        href={item.targetPath}
                        className="inline-flex min-h-11 items-center gap-1 text-xs font-semibold text-primary hover:underline"
                        onClick={() => {
                          openRef.current = false;
                          setOpen(false);
                          void markRead(item);
                        }}
                      >
                        Buka dokumen{" "}
                        <ArrowUpRight className="size-3.5" aria-hidden="true" />
                      </Link>
                    )}
                    {item.readAt ? (
                      <span className="inline-flex min-h-11 items-center gap-1 text-xs text-subtle">
                        <Check className="size-3.5" aria-hidden="true" /> Sudah
                        dibaca
                      </span>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={readingId !== null}
                        aria-label={`Tandai dibaca: ${item.title}`}
                        onClick={() => void markRead(item)}
                      >
                        {readingId === item.id ? (
                          <LoaderCircle
                            className="animate-spin"
                            aria-hidden="true"
                          />
                        ) : (
                          <Check aria-hidden="true" />
                        )}{" "}
                        Tandai dibaca
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </article>
          ))}
          {data?.hasMore && !error && (
            <div className="border-t border-border p-4 text-center">
              <Button
                variant="secondary"
                size="sm"
                disabled={loading || loadingMore || readingId !== null}
                onClick={() => {
                  if (data.nextCursor) {
                    setLoadingMore(true);
                    void load(data.nextCursor);
                  }
                }}
              >
                {loadingMore && (
                  <LoaderCircle className="animate-spin" aria-hidden="true" />
                )}{" "}
                Muat lebih banyak
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
