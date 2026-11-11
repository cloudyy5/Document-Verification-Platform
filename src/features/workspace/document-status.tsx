import { Ban, Check, Clock3, RotateCcw, X } from "lucide-react";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import type { DocumentStatus } from "@/types/database";

export const documentStatusLabels: Record<DocumentStatus, string> = {
  pending_review: "Menunggu review",
  revision_requested: "Perlu revisi",
  approved: "Disetujui",
  rejected: "Ditolak",
  revoked: "Dicabut",
};

const presentation = {
  pending_review: { icon: Clock3, tone: "warning" },
  revision_requested: { icon: RotateCcw, tone: "info" },
  approved: { icon: Check, tone: "success" },
  rejected: { icon: X, tone: "danger" },
  revoked: { icon: Ban, tone: "neutral" },
} satisfies Record<DocumentStatus, { icon: typeof Check; tone: BadgeTone }>;

export function DocumentStatusBadge({ status }: { status: DocumentStatus }) {
  const { icon: Icon, tone } = presentation[status];
  return (
    <Badge tone={tone} className="whitespace-nowrap">
      <Icon size={13} aria-hidden="true" />
      {documentStatusLabels[status]}
    </Badge>
  );
}
