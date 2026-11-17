# Document Verification Platform

Layanan dokumen privat dengan permintaan persetujuan kepada satu pengguna lain, penempatan QR pada halaman pilihan, notifikasi, arsip, dan monitoring admin. Source saat ini **0.13.0**.

QR menampilkan status, waktu persetujuan, nama penandatangan dan judul dokumen tanpa login. PDF serta rincian lain tetap memerlukan login peserta. Catatan platform bukan sertifikat tanda tangan elektronik.

## Teknologi

Next.js **16.4.6** App Router, Node.js **24**, TypeScript strict, Tailwind CSS, Supabase PostgreSQL/Auth/Private Storage, Vitest, Playwright dan ClamAV **1.4** melalui Docker.

## Menjalankan lokal

1. Gunakan Node.js 24 dan jalankan `npm ci`.
2. Jalankan `npm run auth:setup` dan isi konfigurasi Supabase pada `.env.local`. Jangan membagikan atau commit nilainya.
3. Untuk mode lokal, gunakan `APP_URL=http://127.0.0.1:3000` dan `DOCUMENT_ENVIRONMENT=development`.
4. Jalankan `npm run dev`.

Pemindaian dapat ditiadakan hanya pada development loopback. Upload pada domain publik atau mode production selalu memerlukan ClamAV.

## Deployment publik

Ikuti [panduan layanan publik](docs/public-service-release.md). Migration 001–014 dipertahankan; migration **015** menambahkan kebijakan penggunaan terbaru tanpa menulis ulang bukti lama. Jangan menjalankan ulang migration yang sudah berhasil.

Salin [template konfigurasi server](.env.production.example) ke `.env.production` pada server dan isi nilainya secara langsung. Gunakan `DOCUMENT_ENVIRONMENT=production` serta `APP_URL` HTTPS yang benar.

```sh
docker compose --env-file .env.production config --quiet
docker compose --env-file .env.production pull clamav
docker compose --env-file .env.production build --pull web
docker compose --env-file .env.production up -d --force-recreate
docker compose --env-file .env.production exec -T web node scripts/check-clamav.mjs
```

ClamAV hanya tersedia di jaringan container, tanpa port host. Upload baru ditolak bila deteksi menemukan ancaman atau scanner tidak tersedia. Definisi disimpan pada volume tersendiri. Alokasikan RAM scanner sesuai [persyaratan resmi ClamAV](https://docs.clamav.net/manual/Installing/Docker.html#memory-ram-requirements).

Dokumen/riwayat tetap disimpan tanpa hapus otomatis. Penghapusan diproses melalui prosedur pengelola; tidak ada tombol hapus bukti atau auto-purge. Kontak publik: **KPILKOMITH**, **kp.ilkomith@gmail.com**. Nilai kontak dapat diganti melalui environment server.

## Pemeriksaan

```sh
npm run lint
npm run typecheck
npm test
npm run test:db
npm run build
npm run test:e2e
npm run test:docker:config
```

Preflight schema tanpa mengambil dokumen: `npm run supabase:check -- --selected-qr --public-metadata --service-policy`. Pemindaian nyata pada server memakai perintah Docker di atas; hasil unit test protokol lokal tidak menggantikan uji engine tersebut.

[Alur UAT](docs/alur-pengujian-manual.md), [database dan akses](docs/database-access-control.md), [setup autentikasi](docs/authentication-setup.md), [panduan Docker](docs/docker-deployment.md), serta [register keputusan](docs/signing-revision/decision-register.md) tersedia.

Dokumentasi sumber, gambar desain, SQL historis dan bukti pengujian dipertahankan. [Catatan source hingga 0.12.0](docs/history/source-through-0.12.md) menyimpan informasi rilis terdahulu; pengoperasian saat ini mengikuti panduan layanan publik di atas.
