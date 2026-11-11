"use client";

import { Bell, LogOut, Menu, UserRound } from "lucide-react";
import Link from "next/link";
import { useFormStatus } from "react-dom";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { Button } from "@/components/ui/button";
import { useNotification } from "@/components/ui/notification";
import type { Workspace, WorkspaceUser } from "@/components/layout/sidebar";
import type { Ref } from "react";
import { logoutAction } from "@/app/(auth)/actions";

export function AppHeader({
  workspace,
  onOpenNavigation,
  navigationTriggerRef,
  user,
}: {
  workspace: Workspace;
  onOpenNavigation: () => void;
  navigationTriggerRef?: Ref<HTMLButtonElement>;
  user?: WorkspaceUser;
}) {
  const { notify } = useNotification();
  return (
    <header className="sticky top-0 z-30 flex min-h-14 items-center justify-between gap-2 border-b border-border bg-surface px-4 md:min-h-16 md:px-6 lg:px-8">
      <div className="flex min-w-0 items-center gap-2">
        <Button
          ref={navigationTriggerRef}
          variant="ghost"
          size="icon"
          className="-ml-2 md:hidden"
          onClick={onOpenNavigation}
          aria-label="Buka navigasi"
        >
          <Menu aria-hidden="true" />
        </Button>
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-muted-foreground sm:text-[13px]">
            {user
              ? workspace === "admin"
                ? "Admin Workspace"
                : "User Workspace"
              : "Pratinjau komponen"}
          </p>
          {user && !user.emailConfirmed && (
            <p className="mt-0.5 hidden text-xs text-warning sm:block">
              Email belum terverifikasi
            </p>
          )}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1 sm:gap-3">
        <ThemeSwitcher />
        {user && (
          <Button
            variant="ghost"
            size="icon"
            className="hidden sm:flex"
            aria-label="Buka notifikasi"
            onClick={() =>
              notify({
                title: "Notifikasi masih belum tersedia",
                description:
                  "Notifikasi dokumen akan tersedia setelah alur pengajuan dan review diaktifkan.",
                tone: "info",
              })
            }
          >
            <Bell aria-hidden="true" />
          </Button>
        )}
        {user ? (
          <div className="ml-1 flex min-w-0 items-center gap-1 border-l border-border pl-2 sm:ml-2 sm:gap-3 sm:pl-4">
            <span className="hidden size-8 shrink-0 items-center justify-center rounded-full border border-border bg-muted text-subtle sm:flex">
              <UserRound className="size-4" aria-hidden="true" />
            </span>
            <div className="hidden min-w-0 sm:block">
              <p
                className="max-w-36 truncate text-xs font-medium text-foreground"
                title={user.name}
              >
                {user.name}
              </p>
              {user.email && (
                <p
                  className="mt-0.5 max-w-36 truncate text-xs text-subtle"
                  title={user.email}
                >
                  {user.email}
                </p>
              )}
            </div>
            <form action={logoutAction}>
              <LogoutButton />
            </form>
          </div>
        ) : (
          <Button variant="ghost" asChild>
            <Link href="/login">
              <UserRound aria-hidden="true" /> Masuk
            </Link>
          </Button>
        )}
      </div>
    </header>
  );
}

function LogoutButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="ghost" disabled={pending}>
      <LogOut aria-hidden="true" />
      <span>{pending ? "Keluar…" : "Keluar"}</span>
    </Button>
  );
}
