# Laporan R1 — fondasi upload privat

Tanggal: **5 November 2026**, Asia/Makassar. **R1 lulus untuk cakupan fondasi upload privat legacy yang dipakai kembali.** Ini bukan pengaktifan permintaan tanda tangan, delegasi akses penerima, atau penerbitan QR persetujuan internal V1.

## Hasil utama

Runner `npm run test:cloud:workspace -- --confirm-persistent-fixture` menyelesaikan satu skenario cloud penuh: **1 passed**, sembilan kelompok pemeriksaan. Run marker: `845bb91e-cda5-4870-9b1a-f568c27d2e8c`. Preflight Supabase dan production build lokal juga lulus pada checkpoint ini.

| Pemeriksaan aktual       | Hasil                                                                                                                     |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| Login dan baseline owner | Akun normal `user`, email confirmed, counts/list awal nol dari database                                                   |
| Upload lewat UI          | Satu PDF sintetis 2.831 byte tersimpan sebagai versi 1, receipt aktual `pending_review`                                   |
| Idempotensi              | Key dan payload sama menghasilkan receipt yang sama; judul berbeda dengan key sama ditolak 409; jumlah dokumen tetap satu |
| Daftar/detail/filter     | Metadata, kategori, versi, consent version dan timestamp sesuai record sebenarnya                                         |
| File privat              | Current version, historical submission, download attachment dan range 206 memberi byte/hash yang cocok                    |
| Pemisahan akun           | Akun B mendapat 404 pada detail/file/revisi A; counts/list B tetap nol; guest file mendapat 401                           |
| Pembatasan revisi lama   | Dokumen pending tidak dapat direvisi tanpa state yang sesuai, 409                                                         |
| Storage langsung         | Public URL dan SDK pengguna biasa tidak memberi byte PDF                                                                  |
| Preview PDF              | Popup file dibuka melalui UI pada full Chromium dan screenshot diperiksa secara visual                                    |
| Penerbitan kode/QR       | Pemeriksaan privileged terotorisasi memastikan nol `verification_credentials` untuk dokumen uji                           |

Fixture berlabel `DEVELOPMENT TEST ONLY`, tanpa data pribadi, satu halaman. SHA-256 byte asli: `6cc3a629004962b6b8df8755a1ca56c5e41cdee0dc991ea3af44617a79e8c0cc`. Ukuran ini merupakan kasus cloud yang diuji; hasil tersebut tidak mengklaim semua PDF atau deployment publik telah diuji.

## Artefak dan data yang dipertahankan

Satu akun pemilik dan satu dokumen/submission/PDF sintetis sengaja dipertahankan sesuai persetujuan pengguna. Akun pembanding telah dibersihkan setelah ID/email/run marker cocok dan tidak ada dokumen/submission miliknya. Tidak ada perubahan schema, grant, role reviewer, keputusan admin atau publikasi website pada pengujian ini.

Record operator lokal berada di `test-results/cloud-workspace-run.json` dan file per-run; folder tersebut diabaikan source control. Record berisi ID sintetis dan hasil pemeriksaan, tanpa password, token, secret atau path Storage. Receipt bertimestamp `2026-11-04T16:55:25.32621+00:00`, yaitu **5 November 2026 00:55:25 WITA**. Gunakan tanggal client tersebut untuk checkpoint, bukan tanggal UTC yang terlihat pada receipt.

Pemeliharaan pada **9 November 2026** menemukan output tes browser umum dapat membersihkan direktori induk `test-results`. Output tersebut sekarang dibatasi ke `test-results/browser`. Receipt R1 yang hilang dipulihkan dari laporan ini dan rekonsiliasi cloud baca saja terhadap ID owner/document/submission lama, status pending_review, byte/hash serta nol verification_credentials. Catatan pemulihan mencatat provenance; ini tidak merekonstruksi hasil browser yang baru atau membuat fixture tambahan. Suite umum kemudian lulus 43 tes/5 skip dan keempat receipt R1/R2 tetap byte-identik. Smoke kedua runner menolak pengulangan dengan nol network. Rincian ada pada [hasil cloud R2](r2-cloud-report.md).

Screenshot sintetis yang dapat ditinjau: [preview PDF privat](../screenshots/r1/private-pdf-preview.png). Tidak ada credential pada screenshot ini.

## Perbaikan yang diverifikasi

Percobaan awal pada 4 November gagal 422 sebelum Storage. Build Turbopack menyebarkan payload worker, sehingga typed array di tingkat atas menjadi object biasa. Payload sekarang memakai envelope `{ bytes }`; worker membaca `workerData.bytes`. Regresi unit dan probe factory/worker hasil build nyata lulus. Worker tetap tidak menerima environment aplikasi atau argumen startup induk.

Headless-shell tidak mendukung preview native PDF seperti full Chromium. Config cloud menggunakan `channel: "chromium"`; header CSP/private-file tidak diturunkan untuk membuat preview bekerja.

Setelah hasil sukses, runner diperketat agar eksekusi ulang tidak diam-diam membuat fixture permanen kedua. Bukti run sebelumnya diperiksa sebelum network/account creation. Hanya run dengan kedua akun yang diketahui sudah dibersihkan dapat menjadi dasar percobaan baru. Smoke lokal dengan fetch diblokir membuktikan record sukses saat ini ditolak dengan **0 request network**. Proof JSON tidak dihapus untuk melewati guard. Cleanup juga memerlukan hasil query array kosong secara eksplisit.

## Pemeriksaan dan batas bukti

| Lapisan                      | Status                                                                                                        |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Preflight Supabase workspace | Lulus pada 5 November; Auth/role/recovery tersedia, anon counts ditolak, input limiter invalid ditolak        |
| Production build             | Lulus pada 5 November                                                                                         |
| Cloud acceptance R1          | 1 lulus, tanpa retry otomatis                                                                                 |
| Unit suite                   | 435 lulus pada pemeriksaan akhir 5 November, termasuk parser dan preservasi sumber                            |
| SQL native baseline          | 254 lulus pada migration 001–008; tidak ada SQL baru pada R1 ini                                              |
| Browser baseline             | 37 lulus, 2 skip khusus drawer pada viewport lain, termasuk login/profil sementara pada checkpoint sebelumnya |

Tes cloud ini tidak menguji SMTP/pengiriman email, registrasi self-service lengkap, recovery provider, happy path revisi setelah permintaan reviewer, scanning malware produksi, atau alur signing baru. Account creation memakai Auth Admin API untuk akun sintetis terkonfirmasi; tidak ada permintaan pengiriman email. Scanner, retensi, admin MFA dan gate rilis lain tetap mengikuti register yang belum ditutup.

## Tahap berikutnya

Pemeriksaan akhir pada 5 November juga menjalankan `npm run lint` dan `npm run typecheck`, keduanya lulus. Tidak ada pengajuan cloud ulang untuk menjalankan unit/lint atau memeriksa guard.

R2 membangun kode akun dan undangan privat pada model baru sesuai [roadmap](implementation-roadmap.md). `pending_review` pada fixture di atas tetap status legacy; tidak dianggap persetujuan/tanda tangan. Pada checkpoint 9 November, pengguna telah menyetujui S-06/S-07/S-08 untuk akses, lifecycle dan consent development. Source R2 memakai lookup exact serta notifikasi in-app minimum tanpa direktori atau kanal eksternal tambahan. Lihat [laporan R2](r2-report.md) untuk source, pengujian dan aktivasi migration 009. S-05/S-09 tetap menjadi gate aksi persetujuan/QR pada R3.
