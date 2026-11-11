# Laporan Phase 0

Tanggal tinjauan: **1 November 2026** (Asia/Makassar). Ruang lingkup: **Repository and Technical Foundation** saja. Aplikasi berada di `D:\Website`. Phase 1 belum dimulai; tidak ada deployment.

## 1. File dan folder

- `src/app/`: root layout, metadata, global stylesheet, redirect awal, 404; route group `(user)` dan `(admin)` dengan layout terpisah.
- User: `/dashboard`, `/foundation`, serta struktur `/documents`, `/submit`, `/verify`, `/profile`.
- Admin: `/admin/overview`, serta struktur `/admin/review-queue` dan `/admin/review-history`.
- `src/components/layout/`: `sidebar.tsx`, `header.tsx`, `workspace-shell.tsx`.
- `src/components/ui/`: `button.tsx`, `input.tsx`, `table.tsx`, `dialog.tsx`, `notification.tsx`, `badge.tsx`, `page-header.tsx`, `empty-state.tsx`, `loading-state.tsx`, `error-state.tsx`.
- `src/components/providers.tsx`, `src/components/theme-switcher.tsx`: tema dan notifikasi lokal.
- `src/features/foundation/`: contoh komponen interaktif dan halaman fitur yang belum diaktifkan.
- `src/lib/env/`: validasi publik, server, dan helper; `src/lib/supabase/`: factory browser, server per request, privileged server-only; `src/lib/utils.ts`: helper class.
- `src/server/README.md`: batas pengembangan services/repositories/policies berikutnya.
- `src/styles/design-tokens.css`: salinan byte-identik dari token desain sumber.
- `supabase/migrations/`: dua salinan SQL asli, belum dieksekusi.
- `tests/unit/`, `tests/e2e/`: pengujian fondasi.
- `.github/workflows/ci.yml`: workflow pemeriksaan dengan Node 24; belum dijalankan di GitHub.
- Konfigurasi root: `package.json`, `package-lock.json`, `tsconfig.json`, `next-env.d.ts`, `next.config.ts`, `postcss.config.mjs`, `eslint.config.mjs`, `vitest.config.ts`, `playwright.config.ts`, `.env.example`, `.nvmrc`, `.gitignore`, `.gitattributes`, `.prettierrc.json`, `.prettierignore`. `AGENTS.md` dihasilkan otomatis oleh `next dev` untuk petunjuk versi Next.js.
- `README.md`: cara menjalankan dan batas integrasi. `docs/`: laporan ini, catatan keputusan, tambahan token, dan manifest checksum original.

Semua **41 file original**—dokumentasi, tujuh gambar, SQL, dan env template—tetap di folder paket awal. Manifest SHA-256 dan unit test memverifikasi tidak ada yang berubah. Tidak ada migration, kategori, atau kebijakan baru yang diterapkan ke database.

## 2. Teknologi dan versi

| Teknologi                               | Versi terpasang  |
| --------------------------------------- | ---------------- |
| Next.js App Router                      | 16.4.3           |
| React / React DOM                       | 19.3.1           |
| TypeScript, strict                      | 6.0.3            |
| Tailwind CSS / PostCSS plugin           | 4.3.3            |
| Supabase JS / SSR                       | 2.118.0 / 0.12.7 |
| Zod                                     | 4.6.7            |
| next-themes                             | 0.4.6            |
| Geist                                   | 1.9.0            |
| Lucide React                            | 1.66.0           |
| Radix Dialog / Slot                     | 1.3.1 / 1.5.0    |
| ESLint                                  | 10.14.0          |
| TypeScript ESLint                       | 8.72.1           |
| Next ESLint plugin / React Hooks plugin | 16.4.3 / 7.1.1   |
| Prettier                                | 3.9.10           |
| Vitest                                  | 4.1.12           |
| Playwright                              | 1.64.1           |

Versi dependency dikunci tepat pada package dan lockfile. Runtime validasi lokal: Node **25.9.0**, npm **11.12.1**, Windows PowerShell. Node **24 LTS** direkomendasikan lewat `.nvmrc` dan dipakai konfigurasi CI. PostgreSQL, Auth, dan Private Storage Supabase belum diprovision atau dihubungkan.

## 3. Fondasi selesai

- App Router dan TypeScript strict, Tailwind, lint, formatter, build, serta basic CI.
- Identitas silver/white, sidebar graphite, CTA biru, Geist Sans/Mono lokal. Token sumber dipertahankan; tambahan sidebar/overlay dicatat terpisah.
- Tema Terang, Gelap, Sistem; default sistem, tersimpan lintas reload/workspace dan merespons perubahan preferensi perangkat.
- Sidebar desktop 248 px, compact tablet 72 px, drawer mobile dengan focus trap dan Escape; header dan layout responsif.
- Button variants, input berlabel/hint/error, table semantik dengan scroll terkontrol, modal, notifikasi yang dapat ditutup, badge, dan state components.
- Tiga factory Supabase terpisah. Modul cookie/secret/privileged memakai `server-only`; factory privileged belum dipanggil UI dan tidak menyimpan/refresh sesi.
- Environment validation lazy, menolak konfigurasi parsial dan jenis key yang salah, tanpa mencetak kredensial dalam error.
- Basic response headers, metadata aplikasi, dan 404.

Tidak ada statistik database, data akun contoh, login simulasi, upload, review, QR, kode verifikasi aktif, atau endpoint verifikasi publik. Halaman fase berikutnya menjelaskan bahwa fitur belum aktif. Tautan User/Admin hanya untuk meninjau shell dan tidak memberi role.

## 4. Menjalankan

```powershell
cd D:\Website
npm ci
npm run dev
```

Buka `http://127.0.0.1:3000`; tinjau `/dashboard`, `/admin/overview`, dan `/foundation`. Kredensial tidak diperlukan untuk pratinjau Phase 0.

Production lokal: `npm run build`, lalu `npm run start`.

Smoke check `npm run dev -- --port 3000` berhasil; `GET /dashboard` mengembalikan HTTP 200. Server pengujian dihentikan setelah pemeriksaan.

## 5. Hasil pemeriksaan

| Pemeriksaan              | Hasil                                                                                                     |
| ------------------------ | --------------------------------------------------------------------------------------------------------- |
| `npm ci`                 | Lulus; instalasi dari lockfile tanpa konflik peer                                                         |
| `npm run lint`           | Lulus, tanpa warning/error                                                                                |
| `npm run typecheck`      | Lulus                                                                                                     |
| `npm test`               | 30 test lulus, 2 file test                                                                                |
| `npm run build`          | Lulus, semua route fondasi dibangun                                                                       |
| `npm run test:e2e`       | 13 lulus; 2 dilewati karena drawer hanya relevan di mobile                                                |
| `npm run format:check`   | Lulus                                                                                                     |
| Preservasi sumber        | 41 hash original cocok; token dan 2 SQL mirror identik                                                    |
| Batas browser/server     | Import graph client tidak mencapai modul server-only; marker privileged tidak ditemukan di bundle browser |
| Backend pada E2E         | Tidak ada request Supabase/API dokumen dari shell                                                         |
| `npm audit --omit=dev`   | 0 vulnerabilities                                                                                         |
| Audit seluruh dependency | 12 moderate pada toolchain development; 0 high/critical                                                   |

Playwright menggunakan production server port 3100 dan Chromium pada desktop 1440×1000, tablet 768×1024, serta mobile 390×844. Cakupan: tema tersimpan, mode Sistem, modal/focus trap/Escape/focus return, toast dismiss, route placeholders, drawer keyboard mobile, dan ketiadaan overflow halaman. Screenshot light/dark ditinjau secara visual. Report browser ada di `playwright-report/`, screenshot/trace di `test-results/`.

Pengujian database, RLS, isolasi owner, sesi autentikasi, file upload, dan bisnis belum dilakukan karena integrasi tersebut di luar Phase 0. Workflow GitHub baru disiapkan, belum dijalankan secara remote.

Salinan screenshot untuk review: [User desktop light](screenshots/user-desktop-light.png), [User mobile light](screenshots/user-mobile-light.png), [Admin desktop dark](screenshots/admin-desktop-dark.png).

## 6. Masalah dan keputusan

- Workspace awal hanya berisi paket dokumentasi pada dua tingkat subfolder, tanpa aplikasi atau repository Git. Source sekarang tersedia di root workspace; dokumentasi tidak dipindah atau dihapus.
- TypeScript 7 belum kompatibel dengan parser TypeScript ESLint saat ini, sehingga dipilih versi stabil 6.0.3. Vitest 5 tidak mendukung Node 25 yang tersedia, sehingga dipilih versi stabil 4.1.12.
- Preset lint Next membawa beberapa plugin dengan peer range yang belum mencakup ESLint 10. Konfigurasi menggunakan plugin resmi Next, TypeScript, dan React Hooks langsung, tanpa memaksa resolusi peer.
- Audit melaporkan 12 moderate pada rantai dependency development lint yang berakar pada advisory minimatch `GHSA-g3hv-75wg-m249`. Tidak diterapkan `audit fix --force` yang menyarankan downgrade besar atau override lintas major. Runtime audit bersih. Pembaruan upstream perlu ditinjau sebelum release.
- Dokumen lama berbeda soal isi URL QR. Keputusan terbaru memakai opaque credential UUID; implementasi tetap ditunda ke Phase 5.
- Keputusan produk terbuka disimpan di `docs/decision-notes.md`, bukan dijadikan default bisnis aktif.

Referensi versi/integrasi: [Next.js ESLint](https://nextjs.org/docs/app/api-reference/config/eslint), [TypeScript ESLint](https://typescript-eslint.io/getting-started/), [Supabase SSR](https://supabase.com/docs/guides/auth/server-side/creating-a-client), [Vitest 4](https://v4.vitest.dev/guide/). Advisory: [minimatch](https://github.com/advisories/GHSA-g3hv-75wg-m249).

## 7. Konfigurasi pemilik proyek

Untuk melihat Phase 0 cukup menjalankan aplikasi; Supabase belum wajib. Saat integrasi dilanjutkan, salin `.env.example` ke `.env.local` dan isi **secara lokal** URL project, publishable key, serta server secret key. Jangan mengirim secret ke chat atau menaruhnya di `NEXT_PUBLIC_*`.

Setelah Phase 0 disetujui, Phase 1 perlu Supabase lokal/development, pengujian dua migration draft, private bucket, RLS, serta pengujian isolasi owner/role. Phase 2 menambahkan sesi terverifikasi, session refresh proxy, dan proteksi route server. Keberadaan env tidak membuktikan koneksi atau kontrol akses sudah aktif.

Kebijakan PDF/ukuran, kategori, reviewer scope/download, email, revocation, retensi, malware scanner, dan kebijakan privasi tetap menunggu keputusan sesuai register. Tidak ada kebijakan yang diaktifkan melalui asumsi.

**Pekerjaan berhenti pada Phase 0 dan menunggu pemeriksaan serta persetujuan pengguna sebelum Phase 1.**
