# Pemeriksaan aktivasi QR metadata tanpa login

Tanggal: **17 November 2026**, Asia/Makassar. Source lokal **0.12.0**. Pengguna melaporkan migration 014 berhasil dijalankan. Pemeriksaan ini membaca ketersediaan API; tidak mengambil dokumen/metadata pengguna, membuat akun/PDF/keputusan atau menulis hit limiter.

## Hasil

**Checkpoint 18 November 2026:** setelah konfirmasi pemasangan 013 oleh pengguna, preflight `--selected-qr --public-metadata` diulang dan seluruh **13 pemeriksaan lulus**. Hasil gagal 013 di bawah merupakan catatan sebelum pemasangan tersebut. Source 0.13.0 untuk pengoperasian publik dan migration 015 mengikuti [panduan layanan publik](public-service-release.md); penerapan source pada server tetap terpisah dari preflight schema.

Perintah yang dijalankan dengan Node.js 24 dan konfigurasi `.env.local` tanpa mencetak nilainya:

```powershell
npm run supabase:check -- --selected-qr --public-metadata
```

| Pemeriksaan                                                                                            | Hasil                                                |
| ------------------------------------------------------------------------------------------------------ | ---------------------------------------------------- |
| Konfigurasi, Auth settings, signup/email confirmation, tabel role `HEAD limit=0`, lookup recovery acak | 6 lulus                                              |
| 014: lookup metadata dengan ID null                                                                    | 200, null; lulus                                     |
| 014: RPC proyeksi langsung melalui anon                                                                | 401 / 42501; lulus                                   |
| 014: input limiter null ditolak sebelum mutasi                                                         | 400 / 22023; lulus                                   |
| 013: kolom `source_page_count` melalui manifest `HEAD limit=0`                                         | 400; belum tersedia melalui API                      |
| 013: approval halaman pilihan dengan actor null, melalui service/anon                                  | 404 / PGRST202; RPC belum terdeteksi di schema cache |

Total **9 lulus dan 4 perlu diperiksa**, sehingga perintah gabungan keluar dengan kode 1. Tiga pemeriksaan khusus 014 lulus; ini tidak membuktikan 013 sudah terpasang. Keberhasilan 014 tidak bergantung pada adanya kolom/RPC 013. Dari API saja belum dapat dibedakan secara mutlak antara migration 013 yang belum dijalankan, project yang berbeda, dan masalah schema cache.

Probe guest tanpa cookie ke `https://dvp.ilkomith.cloud/receipts/invalid-token` masih menghasilkan **307 menuju `/login`**, bukan landing publik invalid 404 dari source baru. Jadi perilaku source 0.12.0 **belum terlihat pada deployment** saat pemeriksaan. Tidak ada ID dokumen nyata yang dipakai. Metadata publik valid dan akses PDF peserta di domain belum diuji pada source terbaru.

## Tindak lanjut

1. Pastikan SQL Editor memakai project yang sama dengan `NEXT_PUBLIC_SUPABASE_URL` aplikasi. Jangan membagikan key.
2. Jika 013 belum pernah dijalankan pada project tersebut, jalankan seluruh [202611170013_selected_qr_pages.sql](../supabase/migrations/202611170013_selected_qr_pages.sql) sekali dengan role `postgres`. Jangan ulangi 001–012 atau 014. Jika 013 sudah pernah berhasil, gunakan [pemeriksaan katalog baca-saja](../supabase/operators/check-qr-metadata-migrations.sql) terlebih dahulu; jangan mengulang DDL untuk menutupi ketidakpastian.
3. Setelah 013 terlihat pada API, pastikan seluruh source 0.12.0 dari workspace ini sudah masuk repository/server. Working tree lokal masih memiliki perubahan yang belum di-commit saat pemeriksaan. `git pull` pada server saja tidak membawa perubahan yang belum di-push.
4. Dari direktori aplikasi pada server dengan source dan konfigurasi yang benar:

   ```sh
   docker compose --env-file .env.local build
   docker compose --env-file .env.local up -d --force-recreate
   ```

5. Ulangi scan QR melalui kamera HP/browser incognito. Landing menampilkan empat field publik tanpa login. Tombol detail peserta tetap meminta login untuk PDF. QR lama yang berisi domain aplikasi yang sama tidak perlu dibuat ulang.

Panduan, batas data, hasil pengujian lokal dan catatan keamanan build tetap ada di [kontrak metadata publik](public-qr-metadata.md). Tidak ada source aplikasi atau migration historis yang diubah oleh pemeriksaan ini.
