# R4 — penerimaan sesi admin development

Disusun **11 November 2026**, source **0.8.0**. Migration 012 dilaporkan berhasil dipasang dan [preflight API](r4-activation-check.md) **49 pemeriksaan lulus**. Langkah di bawah belum dijalankan dengan sesi admin cloud. Ini adalah uji baca-saja menggunakan akun yang dipilih operator; tidak membutuhkan PDF, undangan, keputusan atau akun sintetis baru.

## Menyiapkan akun

1. Gunakan akun development milik Anda sendiri atau akun uji yang memang boleh digunakan. Email harus sudah terverifikasi. Jangan mengirim password, key, token sesi atau seluruh isi `.env.local` melalui chat.
2. Login ke aplikasi dan buka `/api/v1/me` di tab browser yang sama. Periksa sendiri bahwa `data.user.emailConfirmed` adalah `true` dan `data.roles` memuat `platform_admin`. Respons memuat identitas akun sendiri; tidak perlu menyalinnya ke chat. Pendaftaran dan pemasangan migration 012 tidak otomatis memberi role tersebut.
3. Jika role belum ada dan Anda memang memilih akun ini sebagai admin, buka Supabase **Authentication → Users** untuk mendapatkan UUID akun. Di **SQL Editor → New query**, gunakan role **postgres**, salin [helper setup admin](../../supabase/operators/grant-platform-admin-dashboard.sql), lalu ganti kedua placeholder. `PASTE_TARGET_USER_UUID` adalah akun yang akan menjadi admin; `PASTE_OPERATOR_USER_UUID` adalah akun orang yang menjalankan konfigurasi. Jika Anda melakukan bootstrap akun sendiri, kedua UUID boleh sama. Tinjau lalu Run. Ini memberikan role dengan audit; bukan migration dan tidak dijalankan otomatis oleh aplikasi/agen.
4. Hasil helper yang diharapkan `ROLE_GRANTED` atau `ROLE_ALREADY_PRESENT` tanpa error. Muat ulang aplikasi dan periksa kembali `/api/v1/me`. Pada source 0.8.1, keluar lalu login melalui `/login` biasa: role admin otomatis menuju dashboard admin. Tidak memerlukan alamat login atau pilihan role terpisah.

## Menjalankan aplikasi

```powershell
cd D:\Website
npm run dev
```

Buka `http://127.0.0.1:3000` atau alamat lokal yang sudah dikonfigurasi. Jika server lama masih berjalan, hentikan melalui terminalnya terlebih dahulu lalu mulai source terbaru. Tidak perlu mengulang migration 001–012, seed atau fixture cloud sebelumnya.

## Daftar pemeriksaan

**S-15/source 0.8.1:** sebelum pemeriksaan monitoring, uji login biasa tanpa parameter `next`. Admin menuju `/admin/overview`, user menuju `/dashboard`. Akun admin tidak memperoleh tombol User Workspace; membuka URL pengguna mengembalikannya ke overview. Profil akun sendiri tetap tersedia dengan shell admin, tanpa kartu kode signing. [Laporan workspace](admin-workspace-report.md) mencatat 22 endpoint aplikasi yang menolak admin, termasuk saat role `user` masih tercatat. Pemeriksaan cloud tersebut belum dijalankan dengan akun pilihan pengguna.

| Langkah                                                                                     | Hasil yang diharapkan                                                                                                                                                                                              |
| ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Admin terverifikasi membuka `/admin/overview`                                               | Enam indikator terisi dari database serta timestamp/window yang jelas. Tidak tampil “Belum tersedia” jika sumber berhasil. Nol sah bila hasil query memang nol; akun/dokumen uji lama termasuk cakupan development |
| Admin membuka `/admin/operations`                                                           | Daftar kosong yang jelas atau maksimal 20 hasil terbaru dengan total sebenarnya; hanya referensi tersamarkan, status, kategori aman, waktu dan percobaan                                                           |
| Buka `/api/v2/operations/metrics` dalam sesi admin                                          | HTTP 200, `data.version=operations-v1`, `activeBasis=document-events`; tidak ada nama/email peserta, judul PDF, ID receipt asli, path Storage atau token. Jangan membagikan respons mentah                         |
| Periksa respons API melalui Network browser                                                 | `Cache-Control: private, no-store` dan `Vary` mencakup Cookie                                                                                                                                                      |
| Buka `/api/v2/operations/metrics?role=platform_admin` sebagai admin                         | HTTP 422/VALIDATION_ERROR: endpoint tidak menerima identitas/filter dari browser                                                                                                                                   |
| Klik Muat ulang, ubah Light/Dark, periksa desktop/mobile                                    | Snapshot diminta kembali dan layout terbaca tanpa scroll horizontal; preferensi tema bekerja                                                                                                                       |
| Buka halaman/API dari jendela privat tanpa login                                            | Halaman menuju login; API HTTP 401/UNAUTHENTICATED. Tidak ada angka snapshot pengguna lain                                                                                                                         |
| Jika tersedia akun user/reviewer uji yang sudah diizinkan, gunakan konteks browser terpisah | `/admin/overview` dan `/admin/operations` ditolak; API HTTP 403/OPERATIONS_NOT_ALLOWED. Reviewer saja tetap memperoleh menu arsip sesuai role lama. Jangan memberikan role baru hanya untuk menyelesaikan cek ini  |

Pengecekan angka membandingkan kartu dengan field API yang sesuai pada snapshot/waktu yang sama; jangan menentukan angka harapan dari screenshot sintetis. Definisi hitungan pada [kontrak R4](r4-implementation-contract.md) membedakan dokumen, versi, arsip dan hasil ready. Tidak perlu membuat transaksi bisnis baru agar angka berubah. Revokasi role, provider ban/delete, expiry, pemulihan retry, batas 20 serta isolasi PDF sudah mempunyai bukti lokal SQL/unit; skenario tersebut tidak diubah di cloud dalam uji baca-saja ini.

Catat lulus/gagal per baris dan waktu pemeriksaan. Cukup sampaikan status atau pesan error yang telah dibersihkan dari data akun; jangan mengirim credential. Jika tidak tersedia akun pembanding yang diizinkan, tandai cek user/reviewer **belum diuji cloud**, tanpa menganggap preflight service/anon sebagai penggantinya. Login/refresh sesi dapat menghasilkan log Auth dan counter keamanan normal, tetapi uji ini tidak menulis dokumen, keputusan atau role. Setup role opsional di atas adalah operasi operator tersendiri dan menghasilkan audit.

Uji otomatis dengan credential akun yang dipilih pengguna, fixture baru, elevasi/pencabutan role, atau pembacaan PDF milik pihak lain memerlukan cakupan dan akses yang jelas sebelum dijalankan. Rencana ini tidak mengizinkan memakai service key untuk mengambil statistik atau menghidupkan ulang runner fixture signing yang sudah terminal. R5 tetap menunggu peninjauan R4.
