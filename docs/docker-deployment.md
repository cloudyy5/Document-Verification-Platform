# Docker dan Supabase cloud

Source **0.13.0**, **18 November 2026**, Asia/Makassar. Next.js berjalan pada Node.js 24; PostgreSQL, Auth dan Private Storage menggunakan project Supabase cloud. Compose menjalankan service `web` dan `clamav`; tidak menjalankan migration otomatis atau memasang Supabase lain.

## Konfigurasi aktif

Gunakan [panduan layanan publik](public-service-release.md) dan [.env.production.example](../.env.production.example). Isi nilai asli hanya pada file env server yang diabaikan Git. URL dan publishable key Supabase menjadi build args; secret, flow secret, mode dokumen dan kontak operator hanya runtime.

`DOCUMENT_ENVIRONMENT=production` mengaktifkan kebijakan layanan pada origin HTTPS canonical `APP_URL`. ClamAV wajib sebelum upload disimpan. Compose memberi host scanner `clamav` dan port `3310`; port tersebut tidak dipublikasikan ke host. Definisi bertahan dalam volume `clamav-signatures`. Web menunggu scanner healthy. Alokasikan RAM sesuai dokumentasi resmi scanner.

## Menjalankan

Pasang migration 015 sekali setelah migration sebelumnya, masukkan source terbaru ke server, lalu:

```sh
docker compose --env-file .env.production config --quiet
docker compose --env-file .env.production pull clamav
docker compose --env-file .env.production build --pull web
docker compose --env-file .env.production up -d --force-recreate
docker compose --env-file .env.production ps
docker compose --env-file .env.production exec -T web node scripts/check-clamav.mjs
```

Smoke scanner memeriksa penerimaan stream bersih dan deteksi pola uji EICAR dalam memori. Tidak membuat dokumen Supabase atau menyimpan file uji. Container belum siap untuk upload operasional sampai engine benar-benar lulus uji ini.

Binding web default `127.0.0.1:3000`. Letakkan reverse proxy HTTPS di depannya dan samakan Supabase Auth Site URL/redirect dengan `APP_URL` mengikuti [setup Auth](authentication-setup.md). Contact bantuan bukan pengaturan pengirim SMTP.

`docker compose restart` tidak menerapkan environment baru; gunakan recreate. Nilai `NEXT_PUBLIC_*` yang berubah memerlukan build ulang. Jangan menghapus volume hanya untuk memperbarui aplikasi. Jangan menampilkan konfigurasi terurai lengkap karena memuat secret.

## Development lokal

`docker-compose.dev.yml` menyediakan target dev, mount source, volume node_modules/.next dan hot reload. Mode development hanya untuk loopback; service scanner tetap tersedia dalam Compose. Jalankan dengan file env lokal dan override yang sesuai.

Image runtime memakai standalone output, user non-root, healthcheck, rotasi log dan tanpa memasukkan file env ke image. Docker Engine tidak tersedia pada workspace Windows tempat source ini diverifikasi; hasil `config` tidak membuktikan image/container Linux sudah berjalan. [Panduan dan laporan](public-service-release.md) membedakan pemeriksaan lokal dari aktivasi server.

[Arsip panduan Docker terdahulu](history/docker-through-0.12.md) dipertahankan sebagai riwayat. Instruksi aktif tidak memerlukan opt-in origin development lama.
