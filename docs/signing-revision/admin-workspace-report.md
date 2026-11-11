# Workspace admin eksklusif dan login sesuai role

Tanggal **11 November 2026**, Asia/Makassar, source **0.8.1**. Perubahan ini mengikuti permintaan pengguna: akun yang diberi akses admin hanya menggunakan Admin Workspace, dan login melalui halaman biasa mengarahkan akun ke dashboard sesuai role. Ini adalah penyempurnaan R4/S-15, bukan dimulainya R5.

## Perilaku aplikasi

| Akun                                                                  | Login biasa tanpa tujuan khusus | Akses berikutnya                                              |
| --------------------------------------------------------------------- | ------------------------------- | ------------------------------------------------------------- |
| `user`                                                                | `/dashboard`                    | User Workspace; monitoring admin tetap ditolak                |
| `platform_admin`, termasuk akun yang juga mempunyai `user`/`reviewer` | `/admin/overview`               | Admin Workspace; tidak ada tombol berpindah ke User Workspace |
| `reviewer` tanpa `platform_admin`                                     | `/admin/review-queue`           | Alur arsip yang sebelumnya sah tetap tersedia                 |

Login tetap menggunakan Supabase email/password. Role diambil dari `user_roles` melalui sesi server yang diverifikasi; input form, header atau metadata pendaftaran tidak memilih role. Tidak ada form login admin terpisah atau pilihan role pada browser. Tujuan privat yang masih diizinkan, seperti `/admin/operations`, tetap dapat dibuka setelah login; hint lama menuju `/dashboard`, dokumen, upload, request atau receipt tidak mengembalikan admin ke User Workspace.

Profil dan preferensi akun tetap berada di `/profile`. Untuk admin, halaman tersebut memakai shell, navigasi dan label Admin Workspace serta tidak memuat kartu kode penerima signing. Perubahan profil hanya menyentuh akun sendiri. Logout, pemulihan password dan tema tetap tersedia.

Halaman User Workspace menggunakan guard server per halaman; akses URL langsung oleh admin diarahkan ke `/admin/overview`. API dokumen arsip/signing, kategori, kode akun, undangan, keputusan, bukti dan PDF hasil menolak admin dengan HTTP **403 / USER_WORKSPACE_NOT_ALLOWED**, sebelum query, Storage atau tindakan bisnis. DAL owner arsip juga memeriksa batas yang sama. `/api/v1/me`, profil akun sendiri dan monitoring tetap memakai scope akun yang sesuai. `platform_admin` mempunyai prioritas meski role `user` masih tercatat.

## Implementasi

- `src/lib/auth/workspace.ts`, `redirects.ts`, `session.ts`: kebijakan role, tujuan login dan guard halaman.
- `src/server/workspace-access.ts`, `api.ts`, `workspace/queries.ts`: pemeriksaan scope server dan pengecualian sempit untuk profil akun sendiri.
- `src/server/signing/*`, `src/server/documents/{file,upload}.ts` serta handler terkait: scope User Workspace pada jalur data dan mutasi.
- Halaman dokumen/dashboard/verifikasi/signing/request/receipt memeriksa guard; layout memilih shell akun untuk pengaturan bersama.
- Sidebar desktop/mobile menyembunyikan perpindahan workspace bagi admin. Profil tidak memuat fitur kode signing admin. Copy login berlaku untuk semua akun.
- Unit menguji login biasa, hint lama, role gabungan, guard halaman, 22 handler HTTP dengan DAL asli dan SDK mock, navigasi/profil, serta preservasi akses profil sendiri. Vitest kini juga menjalankan file `.test.tsx`.

Tidak ada dependency, migration, environment variable atau role cloud baru. Migration 001–012, object/PDF sumber/hasil, role tersimpan dan riwayat tetap utuh. Pemberian/pencabutan role masih merupakan konfigurasi operator yang sudah disediakan; agen tidak menjalankan helper grant di cloud. Perubahan ini membatasi workspace serta API aplikasi, tidak merombak grant/RLS Data API langsung pada database. Tidak membatalkan undangan atau mengubah riwayat peserta lama ketika suatu akun menjadi admin.

## Validasi

Unit **850 lulus / 36 file**, ESLint dan build production lulus pada source 0.8.1. Typecheck terpisah serta TypeScript pada build juga lulus. Regresi browser production **43 lulus + 5 skip / 48**, desktop/tablet/mobile: tiga smoke sesi cloud opt-in tidak diaktifkan, dan dua tes drawer tidak berlaku pada viewport besar. Tes navigasi/profil baru memakai render komponen nyata dengan adapter framework pada unit; tes login memakai provider mock. Hasil ini belum membuktikan login admin pada cloud. Hasil 365 SQL native dan 49 probe cloud pada [laporan R4](r4-report.md) tetap merupakan bukti baseline schema 012 sebelumnya, bukan pengujian ulang sesi admin untuk perubahan ini.

[Pemeriksaan artefak/preservasi](../screenshots/r4/admin-workspace-check.json): 40 file browser diperiksa tanpa kecocokan dua nilai secret server; 41 file paket asli dan lima receipt historis tetap cocok checksum; migration 012 tidak berubah; 32 dokumen diperiksa tanpa tautan lokal rusak. Tidak ada akun/role cloud yang diubah. Pemeriksaan format juga lulus. Parser manifest lokal menghormati BOM pada file asli tanpa menulis ulang manifest atau paket sumber.

## Mencoba perubahan

1. Pastikan akun yang dipilih sudah terverifikasi emailnya dan mempunyai `platform_admin`. Jika belum, ikuti [setup admin](r4-cloud-acceptance-plan.md). Tidak perlu mengulang migration.
2. Mulai ulang server lokal yang memakai source lama, lalu jalankan `npm run dev`.
3. Buka **`http://127.0.0.1:3000/login`**, masukkan email/password akun admin. Login biasa menuju dashboard admin secara otomatis.
4. Pastikan tidak ada tombol User Workspace. Buka `/profile`: pengaturan tetap berada dalam Admin Workspace. URL `/signing/documents` atau `/dashboard` mengembalikan admin ke overview.
5. Pada sesi browser terpisah dengan akun user yang memang diizinkan, login biasa menuju `/dashboard`; akses monitoring tetap ditolak. Tidak diperlukan PDF atau transaksi baru untuk menguji pemisahan workspace.

Tidak ada credential pengguna, sesi admin cloud atau fixture tambahan yang dipakai dalam perubahan ini. Penerimaan sesi cloud dengan akun pilihan pengguna masih mengikuti [rencana uji R4](r4-cloud-acceptance-plan.md).
