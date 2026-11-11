# Menjalankan aplikasi dengan Docker dan Supabase cloud

Source **0.8.2**, 11 November 2026, Asia/Makassar. Container menjalankan aplikasi Next.js App Router dengan **Node.js 24**. PostgreSQL, Supabase Auth dan Private Storage menggunakan project Supabase cloud yang sudah dikonfigurasi. Docker Compose menyediakan satu service `web`; tidak memasang database/Auth lain dan tidak menjalankan migration otomatis.

## File yang disediakan

- [Dockerfile](../Dockerfile): image `node:24-bookworm-slim`, tahap dependencies/build/runtime, `npm ci`, output standalone serta user `node` non-root. Hook PDF.js disalin sebelum `npm ci`; public assets dan static bundle disertakan pada runtime. Tracing worker PDF, font dan dependency yang sudah tersedia dipertahankan.
- [.dockerignore](../.dockerignore): hanya mengizinkan source serta konfigurasi build yang diperlukan. `.env*`, key/certificate privat, dependency host, cache, fixture, dokumen produk, SQL dan PDF uji tidak dikirim ke build context. Dokumen/SQL tetap berada di workspace.
- [docker-compose.yml](../docker-compose.yml): build args publik, environment server saat runtime, port, restart, init, penghentian dengan jeda dan rotasi log. Nilai wajib yang kosong ditolak saat konfigurasi Compose dievaluasi.
- [check-docker-public-env.mjs](../scripts/check-docker-public-env.mjs): memakai validator URL/key publik proyek untuk menolak URL tidak aman, key kosong atau secret/service-role key pada build publik. Error hanya mencetak nama field. Pemeriksaan tidak menghubungi Supabase.
- `next.config.ts`: output standalone hanya ketika `NEXT_OUTPUT_STANDALONE=1` pada tahap builder Docker. `npm run build`/`npm run start` lokal tetap memakai mode server Next.js biasa.

## Persiapan

Gunakan Docker Engine dengan Linux containers dan Compose v2 atau lebih baru. Pada Windows, Docker Desktop harus berjalan dalam mode Linux containers. Node host tidak menentukan versi Node dalam container; Dockerfile menetapkan versi mayor 24.

Isi `.env.local` milik host mengikuti [.env.example](../.env.example). Nilai yang diperlukan:

| Variable                               | Waktu penggunaan  | Keterangan                                                                                                       |
| -------------------------------------- | ----------------- | ---------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`             | Build dan runtime | URL project Supabase cloud yang sama                                                                             |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Build dan runtime | Publishable key; legacy anon diterima oleh validator. Field ini akan berada pada bundle browser                  |
| `APP_URL`                              | Runtime           | Origin yang benar-benar dibuka pengguna. Lokal `http://127.0.0.1:3000`; domain menggunakan `https://domain-anda` |
| `AUTH_FLOW_SECRET`                     | Runtime           | Nilai acak server-only, minimal 32 karakter; dipertahankan antar-restart                                         |
| `SUPABASE_SECRET_KEY`                  | Runtime           | Secret key backend dari project yang sama                                                                        |
| `DOCUMENT_ENVIRONMENT`                 | Runtime           | Default `development`, mengikuti gate produk yang sudah ada                                                      |
| `DOCUMENT_MAX_FILE_BYTES`              | Runtime           | Default `10485760` (10 MiB), tetap dibatasi validator aplikasi                                                   |

Isi credential langsung di file host. Gunakan pengganti untuk secret yang sebelumnya terungkap. `.env.local` tidak disalin atau di-mount ke image; Compose meneruskan field yang disebutkan saja. Jangan menggunakan secret/service-role key untuk variable `NEXT_PUBLIC_*`, ARG Docker, `next.config.env` atau source. Jalankan `config --quiet`, karena `config` biasa dan `docker inspect` dapat menampilkan environment container.

Untuk project Supabase development yang sudah digunakan, migration 001–012 telah dilaporkan terpasang dan preflight 49 pemeriksaan lulus pada tahap sebelumnya. Docker tidak membuktikan schema/koneksi tersebut kembali. Ikuti [setup Auth](authentication-setup.md) dan laporan tahap terkait untuk project baru; jangan mengulang migration/fixture pada project saat ini.

## Build dan jalankan

Dari folder utama proyek:

```powershell
docker compose --env-file .env.local config --quiet
docker compose --env-file .env.local build --pull
docker compose --env-file .env.local up -d
docker compose --env-file .env.local ps
```

Buka **http://127.0.0.1:3000/login** untuk konfigurasi lokal. Login biasa memakai Supabase Auth dan role database menentukan workspace. Port di dalam container selalu 3000 dengan listener `0.0.0.0`; default binding host adalah **127.0.0.1:3000**.

Variable Compose opsional dapat ditambahkan pada file env host:

```dotenv
DOCKER_BIND_ADDRESS=127.0.0.1
DOCKER_PORT=3000
```

Untuk domain publik, tempatkan reverse proxy HTTPS di depan binding lokal tersebut dan isi `APP_URL` dengan origin publik, bukan alamat internal container. Proxy harus meneruskan Host/forwarded host dan protokol yang sesuai agar pemeriksaan origin login/Server Actions bekerja. Bila memang memerlukan akses langsung dari jaringan, binding `0.0.0.0` harus dipilih operator secara eksplisit. Sesuaikan port dan `APP_URL` jika port host diubah.

Pada Supabase Auth, sesuaikan Site URL serta daftar redirect dengan origin aplikasi mengikuti [authentication-setup.md](authentication-setup.md), termasuk alur `/auth/confirm` dan `/auth/callback` yang sudah dipakai proyek. Gunakan origin yang konsisten untuk link email serta tautan QR baru. Delivery email tetap bergantung pada konfigurasi Supabase/SMTP yang tersedia, bukan pada status container.

## Batas fitur dokumen pada domain publik

**Packaging Docker ini tidak mengaktifkan kebijakan produksi.** `src/server/documents/config.ts` saat ini mensyaratkan origin localhost/loopback dan `DOCUMENT_ENVIRONMENT=development` untuk fitur dokumen/signing. Mengisi `APP_URL` dengan domain publik membuat fitur yang bergantung pada konfigurasi tersebut tetap merespons unavailable sesuai gate, walaupun container, login dan monitoring dapat berjalan. `NODE_ENV=production` di image merupakan mode runtime Next.js dan tidak menggantikan kebijakan dokumen itu.

Pekerjaan ini mempertahankan gate, consent development, scanner/retensi yang belum ditetapkan, akses privat serta riwayat immutable. Dockerfile bukan klaim bahwa seluruh fitur sudah siap digunakan untuk dokumen produksi. Pengaktifan dokumen di domain publik memerlukan keputusan kebijakan yang sesuai sebelum kode gate diubah.

## Mengubah konfigurasi dan menghentikan

Perubahan URL Supabase atau publishable key memerlukan build ulang karena nilai publik dibekukan pada bundle browser:

```powershell
docker compose --env-file .env.local up -d --build
```

Perubahan secret server atau `APP_URL` memerlukan container baru dengan environment baru:

```powershell
docker compose --env-file .env.local up -d --force-recreate
```

Lihat status/log aplikasi dan hentikan service:

```powershell
docker compose --env-file .env.local ps
docker compose --env-file .env.local logs --tail=100 web
docker compose --env-file .env.local down
```

Tidak ada volume database/dokumen lokal. Menghentikan atau membuat ulang container web tidak menjalankan penghapusan data Supabase. Jangan menyalin respons Auth, token, environment lengkap atau isi PDF privat ke log/chat.

## Validasi dan batas bukti

Docker Engine/Docker Desktop tidak tersedia pada workspace saat persiapan ini. Compose CLI resmi **v5.7.0** diunduh ke cache lokal dan checksum SHA-256 dicocokkan dengan release resmi. `config --quiet` lulus tanpa membuat container atau mencetak nilai environment. Binary/cache tersebut tidak masuk build context dan tidak mengubah instalasi sistem.

Runtime **Node.js v24.22.2** digunakan untuk pengujian Windows berikut. [Hasil terstruktur](docker-validation.json) membedakan pengujian lokal dari pengujian container.

| Pemeriksaan           | Hasil                                                                                                                                                                                                                         |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Compose CLI resmi     | Konfigurasi aktual lulus `config --quiet`; template dengan nilai wajib kosong ditolak. Tidak mencetak credential                                                                                                              |
| Unit Node 24          | **857 lulus / 37 file**, termasuk 7 tes validasi build publik. Run final menggunakan `--maxWorkers=2 --testTimeout=20000` untuk proses Windows; batas parser/render aplikasi tetap sama                                       |
| Lint dan typecheck    | Lulus pada Node 24                                                                                                                                                                                                            |
| Build Next.js         | Standalone serta build biasa lulus pada Node 24; mode build lokal dipulihkan ke biasa setelah smoke artefak                                                                                                                   |
| Smoke standalone      | **10 kelompok lulus**: login HTTP 200, JS/PDF.js HTTP 200, API guest 401/no-store, admin guest menuju login, parser PDF terpaket, layout QR, render baru dua halaman, render legacy/font tiga halaman serta pemindaian secret |
| Artefak               | **3.287 file teks** standalone diperiksa: nol kecocokan dua nilai secret server dan nol file dotenv                                                                                                                           |
| Build/run image Linux | **Belum dijalankan**, karena Docker Engine tidak tersedia                                                                                                                                                                     |

Pengujian paralel awal mengalami timeout proses Windows dan satu kesalahan tipe pada environment tes baru. Tipe diperbaiki; verifikasi akhir dijalankan dengan kapasitas worker/waktu tes di atas. Tidak ada guard, assertion, batas waktu parser/render, permission atau kebijakan produk yang dilonggarkan. Smoke awal juga dilanjutkan setelah environment OS yang diperlukan proses anak Windows diteruskan; credential runtime smoke tetap sintetis.

Ini tidak menggantikan build/run image Linux dengan Docker Engine. Docker healthcheck hanya memeriksa HTTP `/login`; status healthy tidak membuktikan koneksi Supabase, email, sesi admin atau fitur produksi. Tidak ada credential hardcoded, akun, role, dokumen, keputusan, migration atau object cloud yang dibuat oleh penyiapan Docker ini.

## Acuan

- [Next.js standalone output](https://nextjs.org/docs/app/api-reference/config/next-config-js/output) dan guide yang dibundel pada `node_modules/next/dist/docs/`.
- [Docker multi-stage builds](https://docs.docker.com/build/building/multi-stage/).
- [Compose environment interpolation dan --env-file](https://docs.docker.com/compose/how-tos/environment-variables/variable-interpolation/).
- [Image Node.js resmi](https://github.com/nodejs/docker-node).
