# Notifikasi akun di dalam aplikasi

Source **0.9.0**, **16 November 2026**, Asia/Makassar. Pengguna melaporkan pengiriman/penerimaan dan persetujuan sudah bekerja pada deployment, lalu meminta penelusuran lonceng yang masih menampilkan pesan belum tersedia. Perubahan ini menghubungkan fitur akun yang sudah ada pada kontrak API asli dengan data notifikasi R2/R3. Cakupan tetap notifikasi **in-app generik**; S-10 tidak diperluas ke email, SMS, browser push atau direktori pengguna.

## Penyebab dan perilaku baru

Header sebelumnya selalu memunculkan toast statis “Notifikasi masih belum tersedia”. Tombol itu tidak membaca tabel `public.notifications`. Transaksi database yang sudah ada menyimpan notifikasi berikut:

| Peristiwa                        | Penerima notifikasi             | Arti                                                                        |
| -------------------------------- | ------------------------------- | --------------------------------------------------------------------------- |
| Permintaan persetujuan dikirim   | Akun penandatangan yang dipilih | Ada permintaan baru yang dapat dibuka sesuai hak akses                      |
| Pemilik membatalkan permintaan   | Akun penerima                   | Permintaan dibatalkan; akses PDF mengikuti pencabutan yang sudah berlaku    |
| Penerima menyetujui atau menolak | Akun pemilik                    | Tanggapan tercatat; status akhir/PDF hasil diperiksa pada detail permintaan |

Lonceng membaca notifikasi yang sudah tersimpan, termasuk riwayat yang masih ada. Upload draft saja dan pemilik menekan Kirim tidak membuat notifikasi baru untuk pemilik pada transaksi saat ini; pemilik memperoleh konfirmasi pada alur kirim dan halaman permintaan terkirim. Membuka/mengunduh PDF tidak diartikan sebagai persetujuan atau read receipt baru. Notifikasi tindakan approve tidak menyatakan PDF selesai dirender ketika proses hasil masih berjalan.

Panel tersedia pada desktop/tablet/mobile dan tema terang/gelap. Badge memakai jumlah belum dibaca dari database, dengan tampilan `99+` untuk angka di atas 99. Daftar memuat 20 item per halaman dan mendukung “Muat lebih banyak”. Membuka tautan atau tombol “Tandai dibaca” menyimpan status dibaca melalui server; retry mempertahankan timestamp yang sudah committed.

Badge diperbarui setiap **30 detik** saat tab terlihat dan panel tertutup, serta ketika tab kembali aktif. Panel membaca ulang saat dibuka dan melalui “Perbarui”. Saat panel terbuka, daftar tidak direset oleh timer agar pagination/scroll tidak terganggu. Ini polling HTTP, bukan Supabase Realtime atau notifikasi push sistem operasi. Memuat data yang gagal menampilkan error; tidak dianggap daftar kosong atau count nol. Respons sesi 401 menghapus data yang masih tersimpan pada komponen. Logout/pergantian akun membuat instance header yang baru.

## API dan batas akses

- `GET /api/v1/notifications`: cookie session wajib. Hanya menerima cursor opsional yang tervalidasi; pemanggil tidak dapat menentukan `user_id`, count atau filter pemilik lain. Respons memuat DTO tampilan, count belum dibaca, cursor dan penanda halaman berikutnya.
- `PATCH /api/v1/notifications/:notificationId/read`: cookie session dan Origin canonical wajib; body JSON harus `{}` dan dibatasi ukurannya. Timestamp dibuat server. Tidak ada API untuk mengubah judul/body/target, menghapus atau membuat notifikasi.

DAL memakai Supabase cookie client per request, tidak mengimpor privileged client. Setiap select/count/update memfilter `user_id` dari sesi; update juga memfilter ID dan `read_at IS NULL`. Record yang tidak terlihat menghasilkan 404 generik. Respons provider, count, tanggal dan kepemilikan divalidasi sebelum menjadi DTO. Count yang gagal/tidak tersedia menghasilkan 503, tanpa fallback nol. Header API selalu `private, no-store` dan `Vary: Cookie`.

RLS `notifications_select_own`, `notifications_update_own` dan grant kolom `read_at` sudah tersedia pada migration 001/003. Tidak ada migration/grant/policy baru. Hak baca ini fitur akun sendiri seperti profil: admin juga hanya dapat membaca notifikasi miliknya, tidak memperoleh daftar notifikasi global. Tautan ke User Workspace disembunyikan dari DTO admin agar batas S-15 tetap berlaku.

Tautan hanya mengizinkan `/requests/UUID` atau `/documents/UUID`; URL eksternal, `javascript:`, redirect query, fragment dan path lain dibuang. Tujuan tetap memeriksa otorisasi dokumen/permintaan pada setiap akses. Menandai notifikasi dibaca tidak mengubah dokumen, keputusan, masa undangan, bukti atau izin PDF. Judul dan body ditampilkan sebagai teks React, bukan HTML.

## File utama

- [notification-bell.tsx](../src/features/notifications/notification-bell.tsx) dan [header.tsx](../src/components/layout/header.tsx): panel, polling, badge dan penggantian placeholder.
- [notifications.ts](../src/server/notifications.ts) dan [schema.ts](../src/lib/notifications/schema.ts): DAL owner, validasi, keyset dan target privat.
- [GET](../src/app/api/v1/notifications/route.ts) dan [PATCH](../src/app/api/v1/notifications/[notificationId]/read/route.ts): kontrak HTTP.
- Unit test DAL/HTTP, harness browser sintetis pada `tests/ui/notifications`, `playwright.notifications-ui.config.ts`, serta perintah `npm run test:ui:notifications`. CI menjalankan pengujian UI ini.

Harness browser hanya berjalan pada loopback, memakai respons HTTP sintetis berlabel, dan tidak disalin ke image deployment. Ia memakai header/panel aplikasi dengan adapter navigasi dan logout lokal, bukan autentikasi Supabase nyata. Data fixture tidak digunakan sebagai fallback produk.

## Pemeriksaan

Verifikasi lokal memakai **Node.js 24.22.2**, Windows, dan **PostgreSQL 17.9** pada cluster loopback terisolasi:

| Pemeriksaan             | Hasil                                                                                                                                                                                     |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit test               | **945 lulus / 40 file**, termasuk 49 kasus DAL/HTTP notifikasi. Run memakai `--maxWorkers=2 --testTimeout=20000`                                                                          |
| Database/RLS            | **365 lulus / 11 file**, termasuk read/update notifikasi milik sendiri serta penolakan lintas akun dan perubahan kolom lain. Cluster tes dihentikan dan dihapus                           |
| Browser notifikasi      | **18 lulus**, header/panel sebenarnya pada desktop/tablet/mobile, light/dark, keyboard/focus, count, pagination, retry, polling dan pembersihan cache pada sesi 401 saat GET maupun PATCH |
| Browser production      | **43 lulus, 5 dilewati**, termasuk guest GET/PATCH endpoint notifikasi ditolak sebelum data/mutasi. Login akun cloud opt-in dinonaktifkan                                                 |
| Lint, typecheck, format | Lulus. Aturan lint penjadwalan fetch awal diperbaiki tanpa menonaktifkan rule                                                                                                             |
| Build                   | Production build biasa lulus; kedua endpoint notifikasi tercatat pada manifest server dan tetap dynamic                                                                                   |
| Compose                 | Empat skenario konfigurasi sintetis lulus; perbaikan penerusan origin prototipe tetap tersedia                                                                                            |
| Preservasi              | 41 file paket asli dan lima receipt cloud historis cocok dengan checksum; 82 tautan lokal pada dokumentasi yang diperbarui diperiksa tanpa link rusak                                     |

Harness UI client-only menampilkan warning script dari `next-themes` saat provider dirender tanpa SSR; mode visual light/dark diperiksa melalui browser/screenshot, sedangkan theme production Next.js diuji terpisah pada regresi production. Tidak ada perubahan provider tema produk atau rule lint yang dimatikan untuk melewatinya.

Pemeriksaan lokal tidak membuktikan deployment telah memakai source baru atau sesi Supabase pengguna sudah membaca/menandai riwayatnya pada cloud. Build/run image Linux belum dijalankan pada workspace ini. Tidak ada akun, PDF, undangan atau keputusan cloud yang dibuat, dan runner fixture historis tidak dijalankan ulang.

## Menerapkan ke deployment

Push source **0.9.0**, perbarui source pada server, lalu jalankan dengan file environment yang benar-benar dipakai deployment. Contoh berikut mengikuti `.env.production` pada README:

```bash
docker compose --env-file .env.production config --quiet
docker compose --env-file .env.production up -d --build --force-recreate web
```

Tidak perlu env baru, migration, seed, reset, pendaftaran Realtime, SMTP atau biaya layanan baru. Pertahankan pengaturan prototipe sintetis S-16 pada file deployment yang sudah bekerja. Jika server memakai `.env.local`, gunakan nama itu secara konsisten.

Setelah login, buka lonceng pada akun penerima/pemilik yang mempunyai notifikasi lama atau alur pengujian Anda sendiri. Periksa daftar, link detail, status dibaca dan badge setelah refresh. Notifikasi milik akun lain tidak boleh tampil. Tidak perlu mengulang runner pembuat fixture atau mengubah riwayat dokumen hanya untuk mengisi panel. Jika API gagal, periksa `/api/v1/notifications` pada sesi akun yang sama; bagikan hanya kode error jika memerlukan penelusuran, bukan cookie, token atau isi notifikasi privat.
