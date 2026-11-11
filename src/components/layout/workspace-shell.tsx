"use client";

import { useRef, useState, type ReactNode } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { AppHeader } from "@/components/layout/header";
import {
  AppSidebar,
  type Workspace,
  type WorkspaceUser,
} from "@/components/layout/sidebar";

export function WorkspaceShell({
  workspace,
  children,
  user,
}: {
  workspace: Workspace;
  children: ReactNode;
  user?: WorkspaceUser;
}) {
  const [navigationOpen, setNavigationOpen] = useState(false);
  const navigationTriggerRef = useRef<HTMLButtonElement>(null);

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <a
        href="#main-content"
        className="sr-only fixed left-4 top-4 z-[100] rounded-md bg-surface px-4 py-3 text-sm font-medium shadow-[var(--shadow-popover)] focus:not-sr-only"
      >
        Lewati ke konten utama
      </a>
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[72px] md:block lg:w-[248px]">
        <AppSidebar workspace={workspace} user={user} />
      </aside>

      <DialogPrimitive.Root
        open={navigationOpen}
        onOpenChange={setNavigationOpen}
      >
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-[var(--color-overlay)]" />
          <DialogPrimitive.Content
            className="fixed inset-y-0 left-0 z-50 w-[min(320px,calc(100%_-_48px))] overflow-y-auto bg-[var(--color-sidebar)] shadow-[var(--shadow-modal)]"
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              navigationTriggerRef.current?.focus();
            }}
          >
            <DialogPrimitive.Title className="sr-only">
              Navigasi{" "}
              {workspace === "admin" ? "Admin Workspace" : "User Workspace"}
            </DialogPrimitive.Title>
            <DialogPrimitive.Description className="sr-only">
              {user
                ? "Navigasi workspace akun Anda."
                : "Navigasi pratinjau komponen Document Verification Platform."}
            </DialogPrimitive.Description>
            <AppSidebar
              workspace={workspace}
              user={user}
              mobile
              onNavigate={() => setNavigationOpen(false)}
              closeControl={
                <DialogPrimitive.Close
                  className="ml-auto flex size-11 shrink-0 items-center justify-center rounded-md text-[var(--color-sidebar-muted)] hover:bg-[var(--color-sidebar-hover)]"
                  aria-label="Tutup navigasi"
                >
                  <X className="size-4" aria-hidden="true" />
                </DialogPrimitive.Close>
              }
            />
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>

      <div className="min-w-0 md:pl-[72px] lg:pl-[248px]">
        <AppHeader
          workspace={workspace}
          user={user}
          onOpenNavigation={() => setNavigationOpen(true)}
          navigationTriggerRef={navigationTriggerRef}
        />
        <main
          id="main-content"
          tabIndex={-1}
          className="mx-auto w-full max-w-[1440px] min-w-0 px-4 py-6 outline-none md:px-6 md:py-8 lg:px-8"
        >
          {children}
        </main>
        <footer className="mx-auto flex w-full max-w-[1440px] flex-col gap-2 px-4 pb-6 pt-2 text-xs text-subtle sm:flex-row sm:items-center sm:justify-between md:px-6 lg:px-8">
          <span>Document Verification Platform</span>
          <span>
            {user
              ? workspace === "admin"
                ? "Ruang kerja administrasi"
                : "Ruang kerja dokumen privat"
              : "Pratinjau komponen · Tanpa data akun"}
          </span>
        </footer>
      </div>
    </div>
  );
}
