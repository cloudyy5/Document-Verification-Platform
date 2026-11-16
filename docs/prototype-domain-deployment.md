# Uji prototipe pada domain HTTPS

Tanggal: **12 November 2026**, Asia/Makassar. Source **0.8.3**, keputusan **S-16**. Pengguna menyetujui `https://dvp.ilkomith.cloud` untuk **uji prototipe dengan PDF sintetis**, bukan dokumen nyata. [Register keputusan](signing-revision/decision-register.md) mempertahankan batas consent development dan keputusan produksi yang terpisah.

## Perbaikan setelah merge Docker — 16 November 2026/source 0.8.4

Repository pada commit merge `2dd062f` masih memuat validator origin dari 0.8.3, tetapi `docker-compose.yml` tidak lagi meneruskan `DOCUMENT_DEVELOPMENT_ORIGIN` ke service `web`. Fallback `DOCUMENT_ENVIRONMENT` juga berubah menjadi `production`. File `.env.local` yang benar tetap tidak cukup: `--env-file` menyediakan nilai untuk interpolasi Compose, sedangkan container hanya menerima nilai yang diteruskan oleh konfigurasi service.

Keduanya menjelaskan mengapa login berhasil tetapi kode akun dan daftar dokumen masih gagal: `getSigningUserCode()` dan daftar dokumen memakai gate konfigurasi yang sama sebelum query data. Source **0.8.4** memulihkan mapping berikut pada `services.web.environment` sambil mempertahankan pilihan image/target, override development, dan fallback production dari branch Docker:

```yaml
DOCUMENT_ENVIRONMENT: ${DOCUMENT_ENVIRONMENT:-production}
DOCUMENT_DEVELOPMENT_ORIGIN: ${DOCUMENT_DEVELOPMENT_ORIGIN:-}
```

Isi `DOCUMENT_ENVIRONMENT=development` pada file environment server untuk prototipe yang disetujui. `NODE_ENV=production` dan build target `runner` tetap sesuai untuk menjalankan Next.js hasil build; keduanya tidak menentukan kebijakan dokumen. Jangan mengubah nama variabel origin menjadi `NEXT_PUBLIC_` atau menyalin secret ke build argument.

Pemeriksaan `npm run test:docker:config` baru menolak konfigurasi hasil merge sebelum mapping diperbaiki. Script hanya mengevaluasi Compose dengan nilai sintetis, tanpa Engine, container atau Supabase. Setelah perbaikan, **empat skenario lulus**: penerusan origin runner, default dokumen belum aktif, pewarisan origin override dev, dan nilai production eksplisit yang tetap dipertahankan. CI juga akan menjalankan pemeriksaan ini.

Verifikasi lokal **16 November 2026**, Node.js **24.22.2**, Windows: 896 unit test/38 file lulus; lint, typecheck, build production biasa serta format lulus. File override dev hanya diberi newline akhir yang diperlukan pemeriksaan format, tanpa perubahan perilaku. Checksum 41 file paket asli dan lima receipt cloud historis tetap cocok; 58 tautan lokal pada tiga dokumen yang diperbarui diperiksa. Tidak ada perubahan kode aplikasi, SQL, RLS, data cloud atau credential. Penerapan server, perjalanan user pada deployment dan build/run image Linux belum diperiksa; label lulus source tidak membuktikan container cloud sudah diperbarui.

## Penyebab error dan perubahan

Source sebelumnya membatasi `getSubmissionConfiguration()` pada loopback. Konfigurasi signing memakai fungsi yang sama: daftar dokumen, draft, undangan, keputusan dan bukti yang bergantung padanya ditolak sebelum operasi terkait dijalankan. Karena itu login dapat berhasil tetapi `/signing/documents` menampilkan layanan belum tersedia dan `/submit` menampilkan error workspace setelah `APP_URL` diubah menjadi domain deployment.

Source 0.8.3 mempertahankan loopback sebagai default dan menambahkan **satu origin HTTPS yang diizinkan eksplisit** pada server melalui `DOCUMENT_DEVELOPMENT_ORIGIN`. Nilainya dibandingkan dengan origin canonical `APP_URL`; tulis tanpa slash akhir, path, query, fragment, credential atau wildcard. Domain lain, subdomain lain, port lain dan daftar beberapa domain tidak ikut diizinkan. Nilai `DOCUMENT_ENVIRONMENT` selain `development` tetap ditolak, termasuk `production`.

Variabel baru dibaca saat request pada server. Nilai itu tidak menjadi build argument Docker, tidak memakai prefix `NEXT_PUBLIC_`, dan tidak ditambahkan pada konfigurasi form yang dikirim ke browser. `NODE_ENV=production` tetap benar untuk menjalankan image Next.js; nilai tersebut berbeda dari kebijakan dokumen `DOCUMENT_ENVIRONMENT`.

## Konfigurasi pada server deployment

Perbarui file environment **di server tempat container berjalan**, sambil mempertahankan credential Supabase yang sudah diisi secara privat:

Gunakan file yang benar-benar disebut pada perintah deployment. README branch Docker memakai `--env-file .env.production` untuk runner deployment, sedangkan contoh panduan ini memakai `.env.local`. Jika server Anda memakai `.env.production`, isi nilai berikut pada file itu dan ganti seluruh `--env-file .env.local` pada perintah di bawah menjadi `--env-file .env.production`. Mengedit `.env.local` tidak mengubah nilai yang Compose baca dari `.env.production`.

```dotenv
APP_URL=https://dvp.ilkomith.cloud
DOCUMENT_ENVIRONMENT=development
DOCUMENT_DEVELOPMENT_ORIGIN=https://dvp.ilkomith.cloud
DOCUMENT_MAX_FILE_BYTES=10485760
```

Jangan menyalin seluruh `.env.local` ke chat atau GitHub. File `.env.example` hanya menyediakan template; mengeditnya saja tidak mengubah environment deployment. `.env.local` pada komputer developer dapat tetap memakai loopback dan membiarkan `DOCUMENT_DEVELOPMENT_ORIGIN` kosong.

Pada Supabase Authentication → URL Configuration, gunakan Site URL `https://dvp.ilkomith.cloud` dan izinkan kedua callback berikut:

```text
https://dvp.ilkomith.cloud/auth/callback
https://dvp.ilkomith.cloud/auth/confirm
```

Reverse proxy harus meneruskan host dan protokol HTTPS yang sesuai. Pemeriksaan Origin mutation tetap memakai `APP_URL`, bukan nilai Host yang dipasok pemanggil secara bebas.

## Terapkan source dan konfigurasi

Salin atau tarik source **0.8.4** ke server melalui alur deployment yang sudah digunakan. Source baru mencakup pemulihan penerusan opt-in pada `docker-compose.yml`; image aplikasi harus sudah mendukung pembacaan opt-in dari 0.8.3 atau lebih baru. Menampilkan versi package 0.8.3 saja tidak membuktikan Compose hasil merge masih meneruskan nilainya.

Dari folder proyek di server:

```bash
docker compose --env-file .env.local config --quiet
docker compose --env-file .env.local up -d --build --force-recreate web
docker compose --env-file .env.local ps
```

`config --quiet` memeriksa struktur tanpa mencetak credential. Perubahan ini tidak memerlukan migration, SQL baru, seed atau reset database. Jangan menjalankan ulang migration 001–012 atau runner pembuat fixture historis.

Setelah Compose 0.8.4 dan image yang mendukung opt-in sudah diterapkan, perubahan pada opt-in runtime cukup diterapkan dengan `up -d --force-recreate web`. `docker compose restart` saja tidak membuat ulang environment container. Mengosongkan `DOCUMENT_DEVELOPMENT_ORIGIN` menonaktifkan fitur yang bergantung pada konfigurasi ini di domain setelah container dibuat ulang; data dan riwayat tidak dihapus. Mengubah domain tidak mengubah URL QR yang sudah tertanam pada PDF lama.

## Pemeriksaan setelah redeploy

1. Masuk melalui `/login` memakai akun user dengan email terverifikasi.
2. Buka `/signing/documents`, `/signing/new`, `/requests/incoming` dan `/requests/outgoing`. Daftar kosong merupakan hasil yang valid jika akun belum mempunyai data.
3. Untuk alur persetujuan terbaru, gunakan **Buat draft privat** pada `/signing/new`. `/submit` tetap merupakan alur pengajuan administratif lama.
4. Jika menguji upload secara manual, gunakan PDF sintetis tanpa data pribadi, maksimal 10 MiB, dan baca consent development. Upload/persetujuan membuat riwayat yang tetap tersimpan.
5. Kirim hanya kepada akun penguji yang dipilih melalui kode exact, atur posisi QR sebagai penerima, lalu periksa hasil dan bukti web privat melalui domain yang sama. Penempatan/keputusan yang sudah tersimpan tidak diubah.

Jika error masih muncul, periksa bahwa image dan Compose terbaru benar-benar diterapkan serta kedua nilai origin identik. Operator dapat memeriksa tiga nilai non-secret di container tanpa mencetak seluruh environment:

```bash
docker compose --env-file .env.local exec -T web node -e 'console.log(JSON.stringify({APP_URL:process.env.APP_URL,DOCUMENT_ENVIRONMENT:process.env.DOCUMENT_ENVIRONMENT,DOCUMENT_DEVELOPMENT_ORIGIN:process.env.DOCUMENT_DEVELOPMENT_ORIGIN}))'
```

Hasil yang diharapkan, tanpa secret:

```json
{
  "APP_URL": "https://dvp.ilkomith.cloud",
  "DOCUMENT_ENVIRONMENT": "development",
  "DOCUMENT_DEVELOPMENT_ORIGIN": "https://dvp.ilkomith.cloud"
}
```

Jika origin development tidak muncul/kosong, mapping Compose atau container yang berjalan belum diperbarui. Jika environment dokumen masih `production`, periksa file env yang dipakai serta override environment shell/deployment. Jika tiga nilai sudah sesuai tetapi UI masih gagal, saat sedang login buka `/api/v2/me/user-code` pada domain yang sama dan lihat hanya `error.code`: `UPLOAD_UNAVAILABLE` mengarah ke gate konfigurasi, sedangkan `SIGNING_UNAVAILABLE` memerlukan pemeriksaan query/schema/koneksi berikutnya. Jangan membagikan cookie/token atau hasil `data.code` pengguna untuk diagnosis.

Jika ketiganya sesuai tetapi error berlanjut, periksa log aplikasi secara privat dan status migration pada project Supabase yang dipakai image. Jangan mengirim token, password, secret, cookie atau metadata/PDF privat ke chat. Error umum pada UI dapat mewakili kegagalan lain; aktivasi origin tidak membuktikan koneksi database atau Storage.

## Batas perubahan dan bukti pengujian

Consent tetap khusus development/sintetis. Batas ukuran, penolakan PDF terenkripsi, pemeriksaan PDF, email terverifikasi, konfirmasi aksi, pembatasan workspace admin, RLS, private Storage, scope peserta dan riwayat immutable tetap berlaku. QR bukan endpoint verifikasi publik. Kebijakan produksi/retensi/scanner S-12 belum diaktifkan. Opt-in domain merupakan konfigurasi lingkungan dan tidak dapat mendeteksi sendiri apakah isi PDF benar-benar sintetis.

Pemeriksaan lokal dijalankan dengan **Node.js 24.22.2 pada Windows**:

| Pemeriksaan       | Hasil                                                                                                                                                                                        |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit test         | **896 lulus / 38 file**, termasuk **39 kasus konfigurasi dokumen**. Perintah Vitest memakai `--maxWorkers=2 --testTimeout=20000` sesuai kebutuhan proses Windows pada pemeriksaan sebelumnya |
| Batas konfigurasi | Local default dan satu origin HTTPS explicit lulus; origin lain, wildcard, path, credential, port berbeda, HTTP publik, mode dokumen selain development dan limit di atas 10 MiB ditolak     |
| Lint              | Lulus, nol warning                                                                                                                                                                           |
| Typecheck         | `next typegen` dan `tsc --noEmit` lulus                                                                                                                                                      |
| Build Next.js     | Build biasa production lulus; halaman dokumen/signing tetap dynamic sehingga konfigurasi dibaca pada request                                                                                 |
| Compose           | CLI `config --quiet` lulus dengan credential sintetis; hasil normalisasi membuktikan opt-in diteruskan pada runtime dan tidak menjadi build argument                                         |
| Format            | Pemeriksaan Prettier lulus                                                                                                                                                                   |
| Preservasi        | 41 file paket asli dan 5 receipt cloud historis cocok dengan checksum; 72 tautan dokumentasi lokal diperiksa tanpa link rusak                                                                |

Penerapan pada server `dvp.ilkomith.cloud`, sesi user pada deployment, upload cloud dan build/run image Linux belum dijalankan oleh perubahan ini. Tidak ada perubahan data Supabase atau pemanggilan runner pembuat fixture. Pemeriksaan source ini tidak menyatakan bahwa error lain dari koneksi/migration/Storage sudah diuji pada server deployment.
