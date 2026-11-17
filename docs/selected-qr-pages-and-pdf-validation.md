# QR pada halaman pilihan dan validasi PDF — source 0.11.0

Tanggal: 17 November 2026, Asia/Makassar. Lingkungan tetap prototipe dengan PDF sintetis.

## Perilaku baru

Penerima menentukan jumlah QR melalui halaman yang dipilih sebelum menyetujui: minimal satu QR per dokumen dan maksimal satu QR per halaman. Ini mengikuti dua jawaban eksplisit pengguna pada S-18. Tidak perlu menempatkan QR di semua halaman. Tombol penambahan, penghapusan per halaman, geser mouse/sentuhan, tombol panah dan pilihan menerapkan posisi ke semua halaman tersedia. Editor menampilkan jumlah QR serta halaman ber-QR. Penghapusan QR terakhir menonaktifkan persetujuan sampai ada QR lagi. Penolakan tetap dapat dilakukan tanpa QR.

Contoh: pilih hanya halaman 5 pada PDF lima halaman. Manifest menyimpan satu penanda dengan `page: 5`; PDF hasil tetap lima halaman dan hanya halaman 5 mendapat QR baru. Halaman bukti tambahan tidak dibuat. QR mengarah ke bukti persetujuan web yang memerlukan login peserta. Jumlah dan posisi dikunci saat keputusan tercatat.

Validasi upload kini mengizinkan `OpenAction` yang hanya mengatur tampilan awal ke halaman di PDF yang sama, termasuk tujuan bernama yang bisa diselesaikan secara aman. Sebelumnya seluruh `OpenAction` ditolak sehingga pengaturan halaman/zoom juga memicu pesan konten aktif. Pemeriksaan tetap menolak JavaScript, aksi pembukaan eksternal/berantai, lampiran, media aktif, PDF terenkripsi dan struktur tidak valid. Dictionary stream juga diperiksa. Worker tidak menjalankan aksi PDF dan tidak membersihkan atau menulis ulang sumber: byte serta hash sumber dipertahankan. PDF yang memang memuat fitur terlarang tetap memerlukan salinan statis. Tidak ada contoh PDF bermasalah milik pengguna yang diberikan, jadi perbaikan dibuktikan dengan fixture sintetis.

## Penyimpanan dan kompatibilitas

- Layout baru: `selected-pages-draggable-web-evidence-v3`. Input API hanya memuat nomor halaman serta x/y. Jumlah halaman dan geometri dihitung worker dari PDF sumber yang hash-nya diperiksa server.
- `source_page_count` terpisah dari jumlah penanda. Renderer dan finalisasi database memeriksa jumlah seluruh halaman sumber, bukan jumlah QR. Pemilihan harus terurut tanpa duplikasi, berada pada halaman yang ada, di dalam batas halaman dan tidak menutupi anotasi PDF.
- Migration **013** menambah kolom nullable pada manifest, validator khusus v3 dan RPC service-only `approve_signing_request_with_selected_pages`. Constraint versi mempertahankan validator v2. Retry mengikat versi layout, source count dan seluruh posisi; konflik tidak mengubah keputusan. HMAC tindakan baru juga mencakup versi layout dan jumlah halaman sumber.
- Receipt, manifest dan hasil v1/v2 tidak ditulis ulang. RPC lama tetap tersedia untuk klien v2 dan hanya menerima retry versi yang sesuai. Renderer/pembaca bukti mempertahankan ketiga versi. Tabel tetap immutable, peserta saja dapat membaca dan anon/admin monitoring tidak mendapat akses dokumen baru.
- Tidak ada migration 001–012 yang diubah, fixture cloud baru dibuat, atau kebijakan produksi/retensi yang diaktifkan oleh perubahan ini.

## Aktivasi deployment

Source lokal belum otomatis mengganti container pada server atau schema Supabase cloud.

1. Di Supabase project yang digunakan aplikasi, buka **SQL Editor → New query (+)** dan gunakan role **postgres**.
2. Salin **seluruh isi** [202611170013_selected_qr_pages.sql](../supabase/migrations/202611170013_selected_qr_pages.sql), lalu **Run sekali**. Hasil yang diharapkan: `Success. No rows returned`. Jangan ulangi 001–012. Migration berjalan dalam satu transaksi; bila gagal, simpan pesan error dan jangan melanjutkan deployment.
3. Jalankan preflight berikut dari mesin operator yang sudah mempunyai konfigurasi Supabase project yang benar di `.env.local`. Jangan mencetak atau membagikan nilai key. Opsi baru memakai HEAD dengan `limit=0` dan RPC actor null yang ditolak sebelum mutasi; tidak membuat akun atau dokumen:

   ```powershell
   npm run supabase:check -- --selected-qr
   ```

4. Ambil source 0.11.0 di server, lalu bangun ulang dan buat ulang container dengan konfigurasi domain prototipe yang sudah disetujui:

   ```sh
   docker compose --env-file .env.local build
   docker compose --env-file .env.local up -d --force-recreate
   ```

   Build memakai nilai publik Supabase yang benar; secret hanya diberikan pada runtime melalui konfigurasi yang sudah ada. Perubahan ini tidak memerlukan environment variable baru.

5. Login ulang atau muat ulang aplikasi. Pada permintaan PDF sintetis baru, buka halaman terakhir, letakkan satu penanda, lalu setujui. Periksa bahwa hasil memiliki semua halaman, QR hanya di halaman pilihan dan scan tetap membuka bukti privat untuk peserta.

Schema dipasang sebelum aplikasi baru agar RPC tersedia. Aplikasi lama tetap menggunakan format v2 selama transisi. Menurunkan versi aplikasi tidak berarti menghapus schema atau mengubah bukti v3; gunakan kembali source yang mendukung v3 untuk membuka bukti baru.

API key aplikasi tidak mempunyai hak DDL, sehingga langkah SQL Editor harus dilakukan operator project. Aktivasi cloud dan pengujian pada domain deployment belum diklaim berdasarkan pengujian lokal.

## Verifikasi

Semua fixture pengujian perubahan ini lokal dan sintetis. Runner cloud historis tidak dijalankan ulang.

| Pemeriksaan                                 | Hasil                                                                                                                                                           |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ESLint                                      | Lulus, tanpa warning                                                                                                                                            |
| TypeScript strict dan Next route typegen    | Lulus                                                                                                                                                           |
| Prettier seluruh cakupan konfigurasi proyek | Lulus                                                                                                                                                           |
| Unit test                                   | 1.051 lulus, 43 file                                                                                                                                            |
| PostgreSQL 17 terisolasi                    | 388 lulus, 12 file; migration 001–013 diterapkan; cluster dihentikan dan dihapus                                                                                |
| Editor QR Chromium                          | 6 lulus pada desktop/mobile, termasuk satu QR pada halaman terakhir serta menghapus QR terakhir; tampilan mobile diperiksa visual                               |
| PDF worker + raster + decoder QR independen | 5 skenario lulus: v2 empat halaman, v2 satu halaman, CropBox terpotong, v3 hanya halaman terakhir, v3 halaman 2 dan 4; QR hanya ditemukan pada halaman terpilih |
| Regresi browser production lokal            | 43 lulus, 5 dilewati (3 uji sesi cloud opt-in tidak diaktifkan dan 2 drawer khusus mobile)                                                                      |
| Production build                            | Lulus pada retry; lihat catatan keamanan di bawah                                                                                                               |
| Preservasi                                  | 41 dokumentasi/aset asli dan 5 receipt cloud tetap sama menurut SHA-256; migration historis 001–012 tidak berubah                                               |

Build pertama selesai kompilasi/typecheck/static generation, lalu CLI Next.js 16.4.3 berhenti dengan `SecurityFatalError` untuk menampilkan rekomendasi pembaruan keamanan. Retry perintah build yang sama berhasil dengan warning yang tetap ada. Dependency tidak diperbarui pada perubahan QR/PDF ini. Pembaruan keamanan Next.js masih perlu ditangani; build berhasil tidak menyelesaikan peringatan tersebut.

Docker Engine tidak tersedia pada mesin ini; image Linux/container deployment tidak dibangun atau dijalankan dalam verifikasi ini. Migration 013 belum diterapkan pada Supabase cloud dan domain deployment belum diuji dengan layout v3. Tidak ada klaim koneksi atau aktivasi baru berdasarkan hasil PostgreSQL terisolasi.

File utama: `src/features/signing/qr-placement-editor.tsx`, `decision-panel.tsx`, `evidence-view.tsx`; schema `src/lib/signing/placement.ts`/`decision-validation.ts`; worker dan orkestrasi `src/server/signing`; `src/server/documents/pdf-worker.mjs`; migration 013 serta `src/types/database.ts` yang dihasilkan dari schema lokal. Tests baru ada di `tests/unit/document-pdf-opening.test.ts` dan `tests/database/selected-qr-pages.test.ts`, dengan perluasan pengujian signing, editor dan script PDF. Preflight baru tersedia melalui `scripts/check-supabase.mjs --selected-qr`. Checklist UAT dan CSV diperbarui tanpa mengisi status manual sebagai lulus.

Kasus utama: PDF lima halaman dengan satu QR di halaman 5; pilihan halaman tidak berurutan secara fisik (misalnya 2 dan 4); penghapusan QR terakhir; duplikasi/halaman di luar PDF; anotasi, rotasi, CropBox/UserUnit; retry dan aksi bersamaan; jumlah halaman hasil salah; pembatasan peserta serta immutability; navigasi awal PDF aman versus aksi aktif yang harus ditolak.
