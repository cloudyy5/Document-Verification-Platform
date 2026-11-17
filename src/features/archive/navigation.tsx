import Link from "next/link";
import type { ArchiveFilters } from "@/lib/archive/schema";

export function archiveListHref(
  filters: Partial<ArchiveFilters> = {},
  basePath = "/documents",
) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(filters))
    if (value) query.set(key, value);
  return `${basePath}${query.size ? `?${query}` : ""}`;
}
export function ArchiveHistoryTabs({
  scope = "sent",
  status = "completed",
  administrative = false,
}: {
  scope?: "sent" | "received";
  status?: ArchiveFilters["status"];
  administrative?: boolean;
}) {
  return (
    <nav aria-label="Jenis pengajuan lama" className="flex flex-wrap gap-2">
      {(
        [
          ["sent", "Pernah saya kirim"],
          ["received", "Pernah saya terima"],
          ["administrative", "Arsip pemeriksaan terdahulu"],
        ] as const
      ).map(([value, label]) => {
        const active = administrative
          ? value === "administrative"
          : value === scope;
        return (
          <Link
            key={value}
            href={
              value === "administrative"
                ? "/documents/administrative"
                : archiveListHref({ scope: value, status }, "/documents/legacy")
            }
            aria-current={active ? "page" : undefined}
            className={`inline-flex min-h-11 items-center rounded-md border px-3 py-2 text-xs font-medium ${active ? "border-primary bg-primary-soft text-primary" : "border-border bg-surface text-muted-foreground hover:bg-muted"}`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
export function ArchiveTabs({
  current,
}: {
  current: "owned" | "sent" | "received" | "legacy";
}) {
  return (
    <nav aria-label="Sumber arsip" className="flex flex-wrap gap-2">
      {(
        [
          ["owned", "Dokumen saya"],
          ["sent", "Saya kirim"],
          ["received", "Saya terima"],
          ["legacy", "Pengajuan lama"],
        ] as const
      ).map(([value, label]) => (
        <Link
          key={value}
          href={
            value === "legacy"
              ? "/documents/legacy"
              : archiveListHref({ scope: value })
          }
          aria-current={current === value ? "page" : undefined}
          className={`inline-flex min-h-11 items-center rounded-md border px-4 text-xs font-semibold ${current === value ? "border-primary bg-primary-soft text-primary" : "border-border bg-surface text-muted-foreground hover:bg-muted"}`}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}
