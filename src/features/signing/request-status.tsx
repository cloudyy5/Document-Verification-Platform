import { Badge, type BadgeTone } from "@/components/ui/badge";
import type { SigningRequestStatus } from "./types";

const statuses: Record<
  SigningRequestStatus,
  { label: string; tone: BadgeTone }
> = {
  pending: { label: "Menunggu penerima", tone: "warning" },
  expired: { label: "Kedaluwarsa", tone: "neutral" },
  cancelled: { label: "Dibatalkan", tone: "neutral" },
  rejected: { label: "Ditolak", tone: "danger" },
  consented: { label: "Persetujuan dicatat", tone: "info" },
  completed: { label: "Selesai", tone: "success" },
};

export function SigningStatusBadge({
  status,
}: {
  status: SigningRequestStatus | "draft";
}) {
  const value =
    status === "draft"
      ? { label: "Draft privat", tone: "neutral" as const }
      : statuses[status];
  return <Badge tone={value.tone}>{value.label}</Badge>;
}
