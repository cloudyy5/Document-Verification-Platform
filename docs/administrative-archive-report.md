# Arsip administratif yang dapat digunakan

Source **0.10.0**, **16 November 2026**, Asia/Makassar. Pengguna meminta ketiga menu Arsip Administratif tetap diadakan dan dapat dipakai. Sebelumnya Ringkasan/Dokumen terdahulu hanya membaca tabel pengajuan pemeriksaan lama, sehingga dokumen persetujuan baru tidak muncul; Verifikasi arsip masih berupa antarmuka yang dinonaktifkan.

## Perilaku ketiga menu

| Menu                             | Perilaku sekarang                                                                                                                                                                                                                                                   |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ringkasan arsip (`/dashboard`)   | Jumlah dokumen sendiri, permintaan terkirim/masuk, permintaan terkirim selesai/menunggu/ditolak, status lain dan permintaan terbaru. Seluruh angka berasal dari query sesi akun. Pengajuan lama dihitung terpisah.                                                  |
| Dokumen terdahulu (`/documents`) | Tab **Dokumen saya**, **Saya kirim**, **Saya terima**, dan **Pengajuan lama**. Dokumen sendiri dapat dicari berdasarkan judul; tab permintaan dapat difilter menurut status dan mempunyai pagination. Detail membuka sumber, hasil dan riwayat yang sudah tersedia. |
| Verifikasi arsip (`/verify`)     | Membaca QR melalui kamera opsional atau gambar, menerima ID/tautan bukti, serta mencocokkan file PDF dengan hash sumber atau hasil. Semua pembacaan bukti tetap memerlukan sesi dan akses peserta.                                                                  |

Dokumen saya mencakup draft, bukan hanya dokumen selesai. Metrik status utama menghitung permintaan **yang dikirim** akun tersebut, bukan total platform atau jumlah tanda tangan orang lain. `completed` tetap berarti persetujuan tercatat dan hasil PDF telah selesai disimpan. `consented` dipisahkan sebagai persetujuan tercatat dengan hasil belum selesai. Pending yang waktunya sudah lewat dikelompokkan sebagai kedaluwarsa tanpa mengubah row atau menghapus riwayat. Hitungan dan daftar adalah pembacaan biasa yang dapat berubah selama aktivitas berjalan, bukan snapshot transaksi seluruh platform.

Pengajuan pemeriksaan terdahulu tersedia pada `/documents/legacy`, dengan filter kategori/status/tanggal/pencarian dan pagination sebelumnya. Ringkasan khusus alur lama tersedia melalui tautan pada halaman tersebut (`/dashboard?source=legacy`). Detail `/documents/:documentId` dan tautan notifikasi lama tetap menggunakan record legacy. Tidak ada pemindahan tabel, pengubahan status approved lama menjadi signed/completed, penghapusan dokumen atau pengaktifan kembali tugas reviewer.

## Cara menggunakan verifikasi

1. Buka detail permintaan yang telah disetujui, lalu buka **Bukti persetujuan**. Halaman bukti menyediakan QR/tautan privat dan tautan **Cocokkan file dengan bukti ini**.
2. Pada Verifikasi arsip, pindai QR hasil PDF, pilih gambar QR yang jelas, atau tempel ID/tautan bukti dari aplikasi yang sama. Kode pengguna `DVP-...` adalah identifier penerima, bukan ID bukti.
3. Untuk mencocokkan file, pilih **File PDF**, isi bukti yang menjadi pembanding dan pilih file. Hasil membedakan PDF sumber, PDF hasil persetujuan, atau file yang tidak cocok.

Gambar PNG/JPEG/WebP maksimal 5 MiB dan PDF pembanding maksimal 20 MiB diproses **lokal di browser**, tanpa upload atau penyimpanan baru. Batas pembanding mengikuti ukuran maksimum PDF hasil; batas upload sumber tetap 10 MiB. SHA-256 menghitung byte file yang dipilih; file yang diedit/disimpan ulang dapat berbeda meskipun tampak sama. Pemeriksaan tidak mencari dokumen global berdasarkan hash. Kecocokan byte dan adanya catatan persetujuan tidak membuktikan keaslian penerbit, kebenaran isi, keabsahan hukum atau TTE tersertifikasi.

Kamera hanya diminta setelah menekan **Gunakan kamera**. Akses memerlukan HTTPS atau loopback dan izin browser. Stream dihentikan ketika QR terbaca, metode berpindah, tombol Hentikan ditekan, halaman ditinggalkan atau batas pemindaian 45 detik tercapai. `Permissions-Policy` mengizinkan kamera origin sendiri khusus `/verify`; mikrofon/geolokasi dan kamera halaman lain tetap dibatasi. Jika reverse proxy memasang larangan kamera yang lebih ketat, gunakan gambar/tautan atau sesuaikan hanya kebijakan halaman tersebut. Decoder [jsQR](https://github.com/cozmo/jsQR) 1.4.0 yang sudah tersedia di proyek dipindahkan menjadi dependency aplikasi; tidak memakai layanan berbayar atau CDN.

## API, privasi dan file

`GET /api/v2/archive/summary` mengembalikan ringkasan akun. DAL memakai cookie client, `apiSession("user")`, konfigurasi dokumen yang sudah berlaku, filter owner/recipient dari sesi dan RLS yang sudah ada. Tidak memakai privileged client, identifier akun dari input, RPC global atau statistik palsu. Count yang gagal/tidak tersedia menampilkan unavailable; bukan nol. Ringkasan legacy dapat tetap tampil bila hanya ringkasan signing yang gagal, dan sebaliknya.

Daftar memakai `GET /api/v2/signing-documents` dengan pencarian judul opsional `q` serta `GET /api/v2/signing-requests` dengan `scope` dan `status` tervalidasi. Filter diterapkan sebelum pagination pada query scoped, termasuk pemisahan pending/expired. Judul sumber yang sudah tidak boleh diakses penerima tetap disembunyikan. Detail/unduh tetap memeriksa akses masing-masing; status arsip tidak memberikan grant baru.

Pemeriksaan bukti memakai `GET /api/v2/signing-receipts/:receiptId` yang sudah ada. ID opaque atau URL canonical diperiksa ketat; URL origin lain, query token, fragment, path traversal dan kode akun ditolak. Tidak ada verifikasi publik, endpoint mutasi baru atau QR sebelum persetujuan. Admin tetap hanya memakai Admin Workspace, tanpa akses tambahan ke isi dokumen peserta. Respons API privat memakai `no-store` dan `Vary: Cookie`.

File utama:

- `src/features/archive/`: ringkasan, tab/daftar, pembaca QR dan UI verifikasi.
- `src/lib/archive/`: schema filter/count, parsing tautan, validasi DTO dan pencocokan hash lokal.
- [archive.ts](../src/server/archive.ts), [queries.ts](../src/server/signing/queries.ts) dan [summary/route.ts](../src/app/api/v2/archive/summary/route.ts): pembacaan data scoped.
- Halaman `/dashboard`, `/documents`, `/documents/legacy`, `/verify`, tautan detail/bukti, serta konfigurasi izin kamera pada [next.config.ts](../next.config.ts).
- Unit test, harness browser loopback `tests/ui/archive`, [konfigurasi Playwright](../playwright.archive-ui.config.ts), perintah `npm run test:ui:archive`, serta langkah CI yang baru.

## Pemeriksaan lokal

Pemeriksaan memakai Node.js **24.22.2**, Windows, PostgreSQL **17.9** dan Chromium.

- Unit test: **982 lulus / 41 file**, mencakup query/count scoped, filter, kontrak HTTP, batas admin, tautan bukti dan hash byte asli.
- Database/RLS: **365 lulus / 11 file** pada cluster PostgreSQL loopback sementara. Migration 001–012 dan seed hanya diterapkan di cluster tes, lalu cluster dihentikan/dihapus.
- Browser arsip: **24 lulus** pada desktop/tablet/mobile, termasuk terang/gelap, tab/pagination, QR gambar lokal, penolakan URL/kode pengguna, hash sumber/hasil/mismatch, akses ditolak dan penghentian stream kamera sintetis. Harness memakai komponen produk dengan data/respons sintetis yang diberi label, tanpa Supabase dan tanpa kamera fisik. Adapter navigasi digunakan khusus harness.
- Browser production: **43 lulus, 5 dilewati / 48 total**. Termasuk redirect login untuk legacy, penolakan guest pada API ringkasan dan header kamera khusus `/verify`. Tiga smoke login cloud sengaja tidak diaktifkan; dua tes drawer tidak berlaku pada desktop/tablet.
- Lint, typecheck, format dan production build: **lulus**. Route legacy, verifikasi dan API ringkasan tercatat pada manifest build.
- Compose: **4 skenario konfigurasi sintetis lulus**, tanpa Docker Engine.
- Preservasi: **41 file paket asli dan 5 receipt cloud historis** sesuai checksum. Tidak ada perubahan migration/seed/konfigurasi Docker atau file environment.

Tidak ada akun, PDF, permintaan atau keputusan cloud yang dibuat. Runner fixture lama tidak dijalankan ulang. Pemeriksaan lokal tidak membuktikan deployment sudah menggunakan source ini atau sesi pengguna pada cloud telah melewati fitur baru. Build/run image Linux belum diuji pada workspace yang tidak mempunyai Docker Engine.

## Penerapan dan pemeriksaan pengguna

Tidak ada migration, seed, environment atau paket layanan baru yang harus diaktifkan. Pertahankan konfigurasi domain prototipe sintetis yang sudah bekerja. Setelah commit/push dan source server diperbarui, rebuild container dengan file environment deployment yang benar; contoh `.env.production` mengikuti README:

```bash
docker compose --env-file .env.production config --quiet
docker compose --env-file .env.production up -d --build --force-recreate web
```

Jika server memakai `.env.local`, gunakan nama itu secara konsisten. Menyegarkan browser saja tidak mengganti source dalam image yang sudah berjalan.

Sesudah redeploy dan login sebagai user, buka ketiga menu. Pada Dokumen terdahulu, periksa tab Saya kirim/Saya terima untuk permintaan yang sudah Anda miliki. Buka bukti dari salah satu permintaan selesai dan cocokkan PDF hasil yang sama. Akun di luar peserta tetap harus ditolak walaupun mempunyai tautan QR. Pengajuan lama hanya muncul jika akun memang pernah mempunyai submission pada alur terdahulu; daftar kosong tersebut tidak diisi dengan data signing atau contoh palsu.

Ini perbaikan fungsi arsip dalam cakupan prototipe, bukan penutupan R5 atau persetujuan penggunaan dokumen nyata. Keputusan produksi/retensi/scanner tetap mengikuti S-12.
