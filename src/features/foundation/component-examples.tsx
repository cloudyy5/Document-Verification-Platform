"use client";

import { Bell, Layers3, MousePointer2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useNotification } from "@/components/ui/notification";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
} from "@/components/ui/table";
import { ErrorState } from "@/components/ui/error-state";
import { LoadingState } from "@/components/ui/loading-state";

export function ComponentExamples() {
  const { notify } = useNotification();
  return (
    <div className="space-y-7">
      <section className="panel p-6">
        <div className="mb-6 flex items-start gap-3">
          <MousePointer2 size={19} className="mt-0.5 text-subtle" />
          <div>
            <h2 className="section-heading">Aksi & umpan balik</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Contoh interaksi lokal untuk memeriksa tampilan dan akses
              keyboard.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <Dialog>
            <DialogTrigger asChild>
              <Button>Buka contoh modal</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Contoh dialog</DialogTitle>
                <DialogDescription>
                  Pratinjau komponen modal dengan pengelolaan fokus. Tidak ada
                  perubahan data atau keputusan dokumen yang dilakukan.
                </DialogDescription>
              </DialogHeader>
              <p className="text-muted-foreground">
                Gunakan Tab untuk berpindah kontrol dan Escape untuk menutup
                dialog.
              </p>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="secondary">Selesai meninjau</Button>
                </DialogClose>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Button
            variant="secondary"
            onClick={() =>
              notify({
                title: "Notifikasi contoh",
                description:
                  "Umpan balik lokal berhasil ditampilkan. Tidak ada data dikirim ke server.",
                tone: "info",
              })
            }
          >
            <Bell size={16} /> Tampilkan notifikasi
          </Button>
          <Button
            variant="ghost"
            onClick={() =>
              notify({
                title: "Contoh tombol ghost",
                description: "Varian untuk aksi ringan dalam antarmuka.",
              })
            }
          >
            Tombol ghost
          </Button>
          <Button variant="destructive" disabled>
            Aksi destruktif (nonaktif)
          </Button>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="panel p-6">
          <h2 className="section-heading mb-2">Input berlabel</h2>
          <p className="mb-5 text-sm text-muted-foreground">
            Input ini hanya untuk mencoba komponen, tanpa penyimpanan.
          </p>
          <div className="space-y-5">
            <Input
              label="Nama komponen"
              placeholder="Misalnya, tombol utama"
              hint="Contoh input lokal; bukan formulir dokumen."
            />
            <Input
              label="Contoh validasi"
              defaultValue=""
              error="Contoh pesan error yang terhubung dengan input."
            />
            <Input
              label="Contoh read-only"
              value="Design tokens v0.1"
              readOnly
            />
          </div>
        </section>
        <section className="panel p-6">
          <h2 className="section-heading mb-2">Bahasa status</h2>
          <p className="mb-5 text-sm text-muted-foreground">
            Contoh label semantik, bukan status dokumen dari database.
          </p>
          <div className="flex flex-wrap gap-3">
            <Badge tone="warning">Menunggu review</Badge>
            <Badge tone="success">Disetujui</Badge>
            <Badge tone="info">Perlu perbaikan</Badge>
            <Badge tone="danger">Ditolak</Badge>
            <Badge tone="neutral">Dicabut</Badge>
          </div>
          <div className="mt-7 border-t border-border pt-5">
            <h3 className="mb-3 font-medium">Tipografi teknis</h3>
            <code className="rounded-md border border-border bg-muted px-3 py-2 text-xs">
              Geist Mono · ABCD-1234
            </code>
            <p className="mt-4 text-xs leading-relaxed text-subtle">
              Tulisan di atas hanya sampel tipografi. Tidak ada kode verifikasi
              atau QR yang diterbitkan.
            </p>
          </div>
        </section>
      </div>

      <section className="panel">
        <div className="flex items-center gap-3 px-6 py-5">
          <Layers3 size={18} className="text-subtle" />
          <h2 className="section-heading">Inventaris fondasi</h2>
        </div>
        <Table>
          <TableCaption>
            Inventaris komponen yang tersedia dalam source Phase 0, tanpa data
            pengguna.
          </TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>Lapisan</TableHead>
              <TableHead>Implementasi</TableHead>
              <TableHead>Cakupan</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {[
              [
                "Identitas visual",
                "Semantic CSS tokens",
                "Terang, Gelap, Sistem",
              ],
              ["Navigasi", "Sidebar & header", "User / Admin workspace"],
              ["Interaksi", "Dialog & notifikasi", "Interaksi lokal aksesibel"],
              [
                "Integrasi",
                "Supabase client factories",
                "Belum dipanggil oleh UI",
              ],
            ].map(([layer, implementation, scope]) => (
              <TableRow key={layer}>
                <TableCell className="font-medium text-foreground">
                  {layer}
                </TableCell>
                <TableCell>{implementation}</TableCell>
                <TableCell>{scope}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>
      <section className="panel p-6">
        <h2 className="section-heading mb-2">Contoh loading & error</h2>
        <p className="mb-5 text-sm text-muted-foreground">
          State komponen untuk integrasi berikutnya; bukan proses backend yang
          sedang berjalan.
        </p>
        <div className="grid gap-6 lg:grid-cols-2">
          <LoadingState label="Contoh indikator loading" />
          <ErrorState
            title="Contoh state error"
            description="Pesan error yang jelas dapat ditampilkan ketika sebuah operasi gagal."
          />
        </div>
      </section>
    </div>
  );
}
