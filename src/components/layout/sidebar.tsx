"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowUpFromLine,
  Activity,
  ClipboardList,
  FileCheck2,
  Files,
  History,
  House,
  Inbox,
  Layers3,
  LayoutGrid,
  PanelLeftClose,
  ScanLine,
  Send,
  ShieldCheck,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { AppRole } from "@/types/database";

export type Workspace = "user" | "admin";
export type WorkspaceUser = {
  name: string;
  email?: string;
  emailConfirmed: boolean;
  roles: AppRole[];
};

type NavigationItem = { href: string; label: string; icon: LucideIcon };

const navigation: Record<Workspace, NavigationItem[]> = {
  user: [
    { href: "/signing/documents", label: "Dokumen persetujuan", icon: Files },
    { href: "/signing/new", label: "Buat draft privat", icon: ArrowUpFromLine },
    { href: "/requests/incoming", label: "Permintaan masuk", icon: Inbox },
    { href: "/requests/outgoing", label: "Permintaan terkirim", icon: Send },
  ],
  admin: [
    { href: "/admin/overview", label: "Monitoring platform", icon: LayoutGrid },
    {
      href: "/admin/operations",
      label: "Pemantauan hasil PDF",
      icon: Activity,
    },
    {
      href: "/admin/review-queue",
      label: "Antrean arsip",
      icon: ClipboardList,
    },
    { href: "/admin/review-history", label: "Riwayat arsip", icon: History },
  ],
};

function NavigationLink({
  href,
  label,
  icon: Icon,
  mobile,
  onNavigate,
}: NavigationItem & { mobile?: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(`${href}/`);
  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      title={label}
      className={cn(
        "group relative flex min-h-11 items-center gap-3 rounded-md px-3 text-[13px] font-medium transition-colors",
        active
          ? "bg-[var(--color-sidebar-active)] text-[var(--color-sidebar-text)]"
          : "text-[var(--color-sidebar-muted)] hover:bg-[var(--color-sidebar-hover)] hover:text-[var(--color-sidebar-text)]",
        !mobile && "md:justify-center md:px-0 lg:justify-start lg:px-3",
      )}
    >
      <Icon
        className="size-[18px] shrink-0"
        strokeWidth={1.75}
        aria-hidden="true"
      />
      <span className={cn(!mobile && "md:sr-only lg:not-sr-only")}>
        {label}
      </span>
    </Link>
  );
}

export function AppSidebar({
  workspace,
  mobile = false,
  onNavigate,
  closeControl,
  user,
}: {
  workspace: Workspace;
  mobile?: boolean;
  onNavigate?: () => void;
  closeControl?: ReactNode;
  user?: WorkspaceUser;
}) {
  const canReview = user?.roles.includes("reviewer") ?? false;
  const canMonitor = user?.roles.includes("platform_admin") ?? false;
  const canUseAdmin =
    canReview || (user?.roles.includes("platform_admin") ?? false);
  const items =
    workspace === "admin" && user
      ? navigation.admin.filter((item) =>
          /^\/admin\/review-/.test(item.href) ? canReview : canMonitor,
        )
      : navigation[workspace];
  const showWorkspaceLink =
    !user || (!canMonitor && (workspace === "admin" || canUseAdmin));

  return (
    <div className="flex h-full flex-col bg-[var(--color-sidebar)] text-[var(--color-sidebar-text)]">
      <div
        className={cn(
          "flex h-16 shrink-0 items-center gap-3 border-b border-[var(--color-sidebar-border)] px-6",
          !mobile && "md:justify-center md:px-0 lg:justify-start lg:px-6",
        )}
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-[var(--color-sidebar-border)]">
          <Layers3 className="size-6" strokeWidth={1.75} aria-hidden="true" />
        </span>
        <span
          className={cn(
            "text-[13px] font-semibold leading-[18px] tracking-tight",
            !mobile && "md:hidden lg:block",
          )}
        >
          Document Verification
          <br />
          Platform
        </span>
        {closeControl}
      </div>

      <nav
        aria-label={
          workspace === "admin"
            ? "Navigasi Admin Workspace"
            : "Navigasi User Workspace"
        }
        className={cn(
          "flex-1 overflow-y-auto px-4 pb-5 pt-7",
          !mobile && "md:px-3 lg:px-4",
        )}
      >
        <p
          className={cn(
            "mb-4 px-3 text-xs font-medium uppercase tracking-[0.13em] text-[var(--color-sidebar-muted)]",
            !mobile && "md:hidden lg:block",
          )}
        >
          {workspace === "admin" ? "Admin Workspace" : "User Workspace"}
        </p>
        <div className="space-y-1">
          {items.map((item) => (
            <NavigationLink
              key={item.href}
              {...item}
              mobile={mobile}
              onNavigate={onNavigate}
            />
          ))}
        </div>

        {workspace === "user" && (
          <>
            <div className="my-6 border-t border-[var(--color-sidebar-border)]" />
            <p
              className={cn(
                "mb-3 px-3 text-xs font-medium uppercase tracking-[0.13em] text-[var(--color-sidebar-muted)]",
                !mobile && "md:hidden lg:block",
              )}
            >
              Arsip administratif
            </p>
            <NavigationLink
              href="/dashboard"
              label="Ringkasan arsip"
              icon={House}
              mobile={mobile}
              onNavigate={onNavigate}
            />
            <NavigationLink
              href="/documents"
              label="Dokumen terdahulu"
              icon={History}
              mobile={mobile}
              onNavigate={onNavigate}
            />
            <NavigationLink
              href="/verify"
              label="Verifikasi arsip"
              icon={ScanLine}
              mobile={mobile}
              onNavigate={onNavigate}
            />
          </>
        )}
        <div className="my-6 border-t border-[var(--color-sidebar-border)]" />
        <p
          className={cn(
            "mb-3 px-3 text-xs font-medium uppercase tracking-[0.13em] text-[var(--color-sidebar-muted)]",
            !mobile && "md:hidden lg:block",
          )}
        >
          Preferensi
        </p>
        <NavigationLink
          href="/profile"
          label="Profile & Settings"
          icon={UserRound}
          mobile={mobile}
          onNavigate={onNavigate}
        />
        {!canMonitor && (
          <NavigationLink
            href="/foundation"
            label="Komponen UI"
            icon={LayoutGrid}
            mobile={mobile}
            onNavigate={onNavigate}
          />
        )}
      </nav>

      <div
        className={cn(
          "mx-4 mb-5 rounded-lg border border-[var(--color-sidebar-border)] p-4",
          !mobile && "md:hidden lg:block",
        )}
      >
        {workspace === "admin" ? (
          <ShieldCheck
            className="mb-3 size-5 text-[var(--color-sidebar-muted)]"
            aria-hidden="true"
          />
        ) : (
          <FileCheck2
            className="mb-3 size-5 text-[var(--color-sidebar-muted)]"
            aria-hidden="true"
          />
        )}
        <p className="text-xs font-medium">
          {workspace === "admin"
            ? canMonitor || !user
              ? "Monitoring operasional"
              : "Arsip pemeriksaan"
            : "Dokumen bersifat privat"}
        </p>
        <p className="mt-2 text-xs leading-5 text-[var(--color-sidebar-muted)]">
          {workspace === "admin"
            ? user
              ? canMonitor
                ? "Statistik dan kondisi proses bersifat baca-saja. Isi PDF tetap mengikuti hak peserta."
                : "Akses arsip mengikuti izin reviewer yang sudah diberikan kepada akun Anda."
              : "Monitoring membutuhkan sesi dan izin platform administrator."
            : user
              ? "Draft milik Anda bersifat privat. Penerima hanya mendapat akses melalui permintaan yang sah."
              : "Masuk untuk mengakses workspace dokumen milik akun Anda."}
        </p>
      </div>

      {showWorkspaceLink && (
        <div
          className={cn(
            "border-t border-[var(--color-sidebar-border)] px-5 py-4",
            !mobile && "md:px-2 lg:px-5",
          )}
        >
          <p
            className={cn(
              "mb-2 text-xs uppercase tracking-wider text-[var(--color-sidebar-muted)]",
              !mobile && "md:hidden lg:block",
            )}
          >
            {user ? "Workspace lain" : "Pratinjau workspace"}
          </p>
          <div
            className={cn(
              "flex flex-wrap gap-2",
              !mobile && "md:justify-center lg:justify-start",
            )}
          >
            <Link
              href={
                workspace === "admin"
                  ? "/signing/documents"
                  : canMonitor || !user
                    ? "/admin/overview"
                    : "/admin/review-queue"
              }
              onClick={onNavigate}
              title={
                workspace === "admin" ? "User Workspace" : "Admin Workspace"
              }
              className="inline-flex min-h-11 items-center gap-2 rounded-md px-2 text-xs text-[var(--color-sidebar-muted)] transition-colors hover:bg-[var(--color-sidebar-hover)] hover:text-[var(--color-sidebar-text)]"
            >
              <PanelLeftClose className="size-4" aria-hidden="true" />
              <span className={cn(!mobile && "md:sr-only lg:not-sr-only")}>
                {workspace === "admin" ? "User Workspace" : "Admin Workspace"}
              </span>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
