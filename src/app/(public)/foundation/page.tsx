import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { ComponentExamples } from "@/features/foundation/component-examples";
import { WorkspaceShell } from "@/components/layout/workspace-shell";

export const metadata: Metadata = { title: "Fondasi & komponen" };

export default function FoundationPage() {
  return (
    <WorkspaceShell workspace="user">
      <div className="space-y-7">
        <PageHeader
          eyebrow="Design system"
          title="Fondasi & komponen"
          description="Tinjau elemen dasar, tema, dan interaksi yang akan digunakan di seluruh workspace."
          actions={<Badge tone="info">Pratinjau komponen</Badge>}
        />
        <ComponentExamples />
      </div>
    </WorkspaceShell>
  );
}
