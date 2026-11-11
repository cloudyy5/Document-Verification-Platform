# R4 — persiapan tampilan dan kontrak monitoring

**Catatan historis:** laporan ini mencatat checkpoint sebelum jawaban S-11 diterima pada 11 November 2026. Ketiga pilihan kemudian disetujui dan source terintegrasi v0.8.0 telah disiapkan. Status terbaru berada pada [laporan R4](r4-report.md); keterangan “belum dijawab/belum dibuat” di bawah berlaku pada checkpoint persiapan ini.

Tanggal **11 November 2026**, Asia/Makassar. **R4 sudah dimulai pada komponen presentasi dan validasi data; integrasi server/database serta akses global belum diaktifkan.** Tiga pertanyaan S-11 telah diajukan dan belum mendapat jawaban. Arahan pengguna meminta keputusan yang belum ditentukan dicatat, tanpa membuat asumsi yang berdampak pada keamanan/alur bisnis. [Kontrak R4](r4-implementation-contract.md) mencatat cakupan yang diusulkan dan pekerjaan setelah keputusan tersedia.

Ini bukan laporan R4 selesai. Aplikasi utama masih memakai source R3b v0.7.0 serta schema 001–011; migration 012, RPC metrik, endpoint dan pengalihan navigasi belum dibuat/diaktifkan. Tidak ada akun, role, dokumen atau data cloud baru dalam pekerjaan ini. Fixture terminal R1/R2/R3/R3b tetap dipertahankan.

## Hasil yang sudah dapat ditinjau

- Enam kartu indikator, daftar hasil yang perlu perhatian, konteks versi/arsip yang terpisah, waktu snapshot, label development serta penjelasan isi PDF tetap privat.
- Tampilan desktop/tablet/mobile dan Light/Dark mengikuti token yang sudah ada. Tabel berubah menjadi kartu pada mobile; tidak ada grafik/tren rekaan atau tautan membuka PDF peserta.
- Keadaan sumber/error menampilkan **Belum tersedia**, dibedakan dari nol yang sah. Sumber aktivitas yang belum disetujui/tersedia dapat tetap null, tanpa diganti nol.
- Kontrak DTO ketat menolak field tak diharapkan seperti email, judul, owner, path, hash sumber dan token. Total, angka aman, deduplikasi referensi, status proses serta jendela 720 jam divalidasi sebelum presentasi.
- Tombol Muat ulang melakukan reload halaman agar snapshot berikutnya tidak hanya memakai navigasi ke URL yang sama.

Angka contoh **hanya berada pada harness pengujian yang terisolasi**, dengan banner `UJI LOKAL · DATA SINTETIS · RANCANGAN R4 · BELUM TERHUBUNG KE DATABASE`. Tidak ada angka sintetis yang dipasang sebagai statistik aplikasi atau diklaim berasal dari Supabase.

## File yang ditambahkan

| File                                         | Peran                                                                           |
| -------------------------------------------- | ------------------------------------------------------------------------------- |
| `src/features/operations/overview.tsx`       | Komponen presentasi yang belum dihubungkan ke halaman aktif                     |
| `src/features/operations/refresh-button.tsx` | Tombol reload tanpa secret atau aksi data                                       |
| `src/lib/operations/schema.ts`               | Validasi snapshot/metadata minimum dan tipe TypeScript                          |
| `tests/unit/operations-schema.test.ts`       | 13 tes konsistensi dan penolakan field sensitif                                 |
| `tests/ui/operations.spec.ts`                | Tes visual/interaksi pada tiga viewport dan dua tema                            |
| `tests/ui/operations/`                       | Harness sintetis dan adapter anchor khusus tes; bukan mock autentikasi/database |
| `scripts/serve-operations-ui.mjs`            | Host Vite loopback port 3202, tanpa pembacaan `.env.local` atau Supabase client |
| `playwright.operations-ui.config.ts`         | Suite terpisah, satu worker, nol retry, environment browser disaring            |
| `package.json`                               | Menambah `test:ui:operations`; tidak menambah dependency                        |
| `docs/screenshots/r4-draft/`                 | Contoh visual berlabel sintetis                                                 |

## Pemeriksaan

| Pemeriksaan           | Hasil                                                                                                                                                             |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ESLint                | Lulus, nol warning                                                                                                                                                |
| Typecheck             | Lulus                                                                                                                                                             |
| Unit seluruh repo     | **776 lulus / 33 file**, termasuk 13 tes DTO baru                                                                                                                 |
| Browser komponen      | **6 lulus**: desktop/tablet/mobile, masing-masing mencakup Light/Dark dan sumber unavailable/aktivitas null; tidak ada overflow horizontal atau kontrol akses PDF |
| Build Next production | Lulus; source aplikasi/route/permission aktif tetap R3b                                                                                                           |

Percobaan browser awal menemukan bahwa `next/link` membutuhkan runtime Next pada host Vite. Adapter anchor dibatasi ke harness tes; source aplikasi tetap memakai `next/link`. Enam tes berikutnya lulus setelah isolasi ini diperbaiki. Browser komponen tidak membuktikan routing Next, autentikasi admin, RLS, data Supabase atau statistik nyata. Tes SQL lama tidak diulang karena schema/database tidak diubah. Build tidak mengaktifkan monitoring global.

## Meninjau lokal

- [Desktop Light](../screenshots/r4-draft/desktop-light.png), [desktop Dark](../screenshots/r4-draft/desktop-dark.png), [tablet](../screenshots/r4-draft/tablet-light.png), dan [mobile Dark](../screenshots/r4-draft/mobile-dark.png).
- `npm run test:ui:operations` menguji komponen secara lokal, lalu menutup server milik tes.
- Untuk membuka harness sendiri, jalankan `node scripts/serve-operations-ui.mjs`, lalu buka `http://127.0.0.1:3202/?issues=1`. Tambahkan `&theme=dark` untuk tema gelap. Ini adalah rancangan sintetis, bukan aplikasi yang terhubung ke database. Hentikan server dengan Ctrl+C setelah selesai.

## Keputusan yang masih diperlukan

1. S-11 akses: baca-saja khusus `platform_admin`, statistik agregat dan metadata proses yang minimum, tanpa nama/email/judul/isi PDF; reviewer tidak mendapat akses monitoring global.
2. Basis aktif 30 hari: aktivitas dokumen committed dengan label jelas, atau tampilkan belum tersedia sambil menunggu sumber login lengkap.
3. Indikator perlu perhatian: hasil PDF yang saat ini gagal/melewati batas waktu, satu per hasil dan keluar dari hitungan setelah retry berhasil; tidak disebut sebagai seluruh error platform.

Jawaban tidak dianggap diterima hanya karena waktu berlalu. Setelah keputusan tersedia, pekerjaan berlanjut ke RPC baca sempit, guard halaman/API, migration additive, tes SQL/RLS, integrasi halaman dan penerimaan cloud yang diperlukan. Tidak ada perluasan wewenang admin atau pengulangan fixture cloud yang dilakukan dalam persiapan ini.
