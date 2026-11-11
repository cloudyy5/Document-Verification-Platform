import Link from "next/link";
import { ArrowLeft, ArrowRight, Construction } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export function PlaceholderPage({
  title,
  description,
  phase,
  admin = false,
}: {
  title: string;
  description: string;
  phase: string;
  admin?: boolean;
}) {
  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow={admin ? "Admin workspace" : "User workspace"}
        title={title}
        description={description}
        actions={<Badge tone="neutral">Fitur belum aktif</Badge>}
      />
      <section className="panel">
        <EmptyState
          icon={Construction}
          title="Ruang ini sedang dipersiapkan"
          description={`Akses akun telah diperiksa. Fitur ini dijadwalkan pada ${phase} dan belum diaktifkan.`}
        >
          <div className="flex flex-wrap justify-center gap-3">
            <Button variant="secondary" asChild>
              <Link href={admin ? "/admin/overview" : "/dashboard"}>
                <ArrowLeft size={16} /> Kembali ke ringkasan
              </Link>
            </Button>
            <Button asChild>
              <Link href="/foundation">
                Tinjau komponen <ArrowRight size={16} />
              </Link>
            </Button>
          </div>
        </EmptyState>
      </section>
      <p className="max-w-2xl text-sm text-muted-foreground">
        Sesi dan pemeriksaan akses sudah diterapkan. Halaman ini belum mengambil
        atau menyimpan dokumen.
      </p>
    </div>
  );
}
