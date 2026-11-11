# Document Verification Platform

**Source 0.8.2 — packaging Docker dengan Node.js 24 dan Supabase cloud.** [Dockerfile](Dockerfile), [.dockerignore](.dockerignore) dan [docker-compose.yml](docker-compose.yml) tersedia. Build standalone memakai dua variable publik, sedangkan secret hanya diberikan pada runtime. [Panduan Docker](docs/docker-deployment.md) menjelaskan perintah build/run, Auth URL, port, healthcheck dan batas pengujian. Gate fitur dokumen development/localhost tetap berlaku; packaging ini tidak membuka fitur dokumen produksi atau mengubah schema Supabase.

**Source 0.8.1 — login sesuai role dan workspace admin eksklusif.** Login biasa pada `/login` menuju `/admin/overview` untuk akun `platform_admin` dan `/dashboard` untuk user. Admin tidak lagi memperoleh perpindahan ke User Workspace; URL serta API dokumen pengguna juga dibatasi. Profil/tema akun sendiri tetap tersedia di shell admin. [Laporan perubahan](docs/signing-revision/admin-workspace-report.md) mencatat S-15, pengujian dan batas bukti. Tidak memerlukan migration atau perubahan `.env.local` baru.

**Source R4 v0.8.0 — monitoring admin baca-saja.** Ketiga keputusan S-11 sudah disetujui. Halaman monitoring, API dan RPC snapshot tersedia dengan agregat nyata serta metadata minimum, khusus `platform_admin`. [Laporan R4](docs/signing-revision/r4-report.md) mencatat 805 unit, 365 SQL native, enam browser komponen serta build/regresi browser production yang lulus. **Migration 012 dilaporkan berhasil dipasang dan [preflight API R4](docs/signing-revision/r4-activation-check.md) lulus 49 pemeriksaan; penerimaan sesi admin cloud belum dibuktikan.** Jangan mengulang migration 001–012 atau fixture terminal signing. [Setup akun dan uji dashboard](docs/signing-revision/r4-cloud-acceptance-plan.md) tersedia; R5 belum dimulai.

**Source R3b v0.7.0 — penerima menggeser QR pada setiap halaman sebelum menyetujui.** PDF hasil baru mempertahankan jumlah halaman sumber; bukti persetujuan ditampilkan di halaman web privat setelah QR dipindai. Editor mendukung mouse, sentuhan, tombol panah dan posisi berbeda per halaman. Posisi dikunci bersama keputusan. [Laporan perubahan QR](docs/signing-revision/qr-placement-report.md) memuat hasil pengujian dan contoh visual. **Migration 011 dilaporkan aktif dan [preflight API R3b](docs/signing-revision/qr-placement-activation-check.md) lulus 47 pemeriksaan pada 10 November 2026**. [Uji peserta cloud R3b](docs/signing-revision/qr-placement-cloud-report.md) lulus satu skenario; [rencana fixture R3b](docs/signing-revision/qr-placement-cloud-acceptance-plan.md) dan runner tersendiri tersedia. Source R4 kini terintegrasi; aktivasi cloud 012 dilaporkan berhasil dan preflight 49 lulus.

[Paket revisi](docs/signing-revision/README.md) mengikuti target yang disetujui: prototipe persetujuan internal dengan satu pengguna lain sebagai penandatangan. R2 menyediakan draft, kode penerima, undangan dan akses privat. R3 menyediakan Setujui/Tolak tanpa password ulang, alasan penolakan wajib, receipt dan PDF hasil. **Migration 010 aktif dan preflight cloud lulus 43 pemeriksaan pada 10 November 2026**; [uji peserta R3 format sebelumnya](docs/signing-revision/r3-cloud-report.md) lulus pada fixture yang sama setelah koreksi asumsi tes streaming. PDF lama dengan footer QR dan halaman bukti tambahan tetap immutable. Hasil tersebut merupakan bukti format lama, bukan uji cloud R3b.

**Migration 009 sudah diaktifkan pada Supabase development pada 9 November 2026.** Pengguna melaporkan pemasangan berhasil; [preflight API R2](docs/signing-revision/r2-activation-check.md) lulus 26 pemeriksaan tanpa membuat akun, PDF atau undangan. Uji cloud R2 telah lulus satu skenario dengan tujuh kelompok pemeriksaan: login/kode, draft, undangan, hak penerima, isolasi, preview native PDF dan pembatalan. Lihat [laporan R2](docs/signing-revision/r2-report.md) dan [hasil uji cloud R2](docs/signing-revision/r2-cloud-report.md). Data Phase 3 tetap sebagai arsip verifikasi administratif.

**R1 — fondasi upload privat telah lulus uji cloud pada 5 November 2026 (Asia/Makassar).** Satu pengajuan PDF sintetis berhasil melalui UI, tetap satu dokumen saat retry identik, menolak payload berbeda dengan key yang sama, serta lulus pemeriksaan list/detail, hash byte asli, preview/download/range, penolakan API akun lain/guest dan akses Storage langsung. Native preview diperiksa secara visual. Akun pembanding dibersihkan; satu akun pemilik dan satu PDF 2.831 byte dipertahankan sesuai persetujuan. Status `pending_review` adalah status baseline lama, bukan tanda tangan pengguna. Tidak ada credential verifikasi atau QR yang diterbitkan untuk dokumen uji. [Laporan R1](docs/signing-revision/r1-report.md) memisahkan bukti fondasi ini dari bukti model undangan R2 yang diuji terpisah.

Laporan: [R2](docs/signing-revision/r2-report.md), [Phase 0](docs/phase-0-report.md), [Phase 1](docs/phase-1-report.md), [Phase 2](docs/phase-2-report.md), [Phase 3](docs/phase-3-report.md). Setup: [User Workspace](docs/user-workspace-setup.md), [autentikasi](docs/authentication-setup.md), [database dan akses](docs/database-access-control.md).

## Menjalankan lokal

Gunakan Node.js **24 LTS** dan npm:

```powershell
cd D:\Website
npm ci
npm run auth:setup
npm run dev
```

Buka **http://127.0.0.1:3000**. `auth:setup` membuat `.env.local` dengan secret internal acak tanpa mencetak nilainya; file yang sudah ada dipertahankan. Lengkapi konfigurasi lokal melalui editor, lalu ikuti pengaturan provider, migration, dan template email pada panduan setup. Nilai secret tetap di environment lokal.

`npm ci`, `npm run dev` dan `npm run build` menyiapkan worker/font PDF.js pada `public/pdfjs/<versi>/` secara otomatis. Library disajikan dari origin aplikasi, tanpa CDN dan tanpa menyalin PDF pengguna ke folder publik. R3b tidak menambah environment variable.

Untuk menjalankan production build secara lokal:

```powershell
npm run build
npm run start
```

Konfigurasi pengajuan saat ini ditujukan untuk development loopback dengan Supabase Free. Build lokal tidak mengaktifkan pengajuan pada origin publik.

## Halaman dan API

| Route                                                               | Akses dan isi                                                                                            |
| ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `/login`, `/register`, `/forgot-password`, `/verify-email`          | Form akun publik                                                                                         |
| `/reset-password`                                                   | Password baru memerlukan token recovery terverifikasi dan grant sekali pakai                             |
| `/foundation`                                                       | Pratinjau komponen publik dan tema                                                                       |
| `/policies/submission`                                              | Kebijakan pengajuan development yang dapat dibaca sebelum consent                                        |
| `/dashboard`                                                        | Ringkasan jumlah dan pengajuan terbaru dari data akun sendiri                                            |
| `/signing/documents`, `/signing/new`                                | Draft privat model persetujuan internal; upload memakai consent development baru                         |
| `/signing/documents/[documentId]`                                   | Versi sumber, lookup satu kode penerima, consent berbagi dan pengiriman undangan                         |
| `/requests/incoming`, `/requests/outgoing`, `/requests/[requestId]` | Kotak masuk/keluar, status aktual, preview jika grant masih berlaku dan pembatalan oleh pemilik          |
| `/documents`                                                        | Daftar owner-only dengan pencarian judul, kategori, status, tanggal, dan cursor pagination               |
| `/documents/[documentId]`                                           | Metadata, status, PDF privat, snapshot versi, catatan dan checklist review                               |
| `/submit`                                                           | Pengajuan PDF dan metadata; wajib login, email terverifikasi, consent aktif, dan konfigurasi development |
| `/documents/[documentId]/resubmit`                                  | Versi baru untuk dokumen sendiri yang berstatus `revision_requested`                                     |
| `/profile`                                                          | Pembaruan nama/telepon sendiri, email readonly, pemulihan password, dan preferensi tema                  |
| `/verify`                                                           | Tiga metode ditampilkan sebagai shell; kamera, kode, upload perbandingan, dan hasil belum aktif          |
| `/admin/overview`, `/admin/operations`                              | Platform admin terverifikasi; statistik agregat dan metadata proses minimum, baca-saja                   |
| `/admin/review-queue`, `/admin/review-history`                      | Reviewer; fungsi antrean dan keputusan review belum diaktifkan                                           |
| `GET /api/v1/me`                                                    | Identitas dan role akun sendiri                                                                          |
| `GET /api/v2/me/user-code`                                          | Kode akun sendiri, tanpa direktori pengguna                                                              |
| `POST /api/v2/recipients/lookup`                                    | Pencarian exact kode pengguna lain terverifikasi; hasil hanya ID, kode dan nama tampilan                 |
| `GET/POST /api/v2/signing-documents`                                | Daftar draft sendiri atau upload draft baru                                                              |
| `GET /api/v2/signing-documents/[documentId]`                        | Metadata versi sumber yang boleh dibaca                                                                  |
| `GET /api/v2/signing-documents/[documentId]/file?versionId=UUID`    | PDF privat versi tertentu; download opsional `download=1`                                                |
| `GET/POST /api/v2/signing-requests`                                 | Daftar scoped `received`/`sent` atau kirim satu undangan dengan consent berbagi                          |
| `GET /api/v2/signing-requests/[requestId]`                          | Detail peserta dan metadata sumber hanya jika haknya masih berlaku                                       |
| `POST /api/v2/signing-requests/[requestId]/cancel`                  | Pemilik membatalkan undangan pending yang belum kedaluwarsa                                              |
| `GET /api/v1/dashboard`, `GET /api/v1/categories`                   | Data workspace/kategori untuk sesi terautentikasi                                                        |
| `GET /api/v1/documents`, `GET /api/v1/documents/[documentId]`       | Daftar/detail owner-only                                                                                 |
| `POST /api/v1/documents`                                            | Pengajuan baru melalui multipart                                                                         |
| `POST /api/v1/documents/[documentId]/resubmissions`                 | Pengajuan versi baru melalui multipart                                                                   |
| `GET /api/v1/documents/[documentId]/file?submissionId=UUID`         | Stream PDF setelah otorisasi pemilik; parameter versi opsional                                           |
| `PATCH /api/v1/profile`                                             | JSON nama/telepon sendiri; role, owner ID, dan email tidak dapat diubah                                  |

R4 menyediakan `/admin/overview`, `/admin/operations`, dan `GET /api/v2/operations/metrics`, khusus `platform_admin` terverifikasi. Reviewer tanpa role tersebut diarahkan ke arsip. Snapshot memisahkan akun, aktivitas dokumen 30 hari, dokumen/versi, completed, pending yang belum kedaluwarsa dan hasil perlu perhatian; tidak memuat nama/email pengguna lain, judul/isi PDF atau path Storage. Belum terhubung/SQL error tampil unavailable, bukan nol. [Aktivasi 012 dan setup admin awal](docs/signing-revision/r4-report.md) menjelaskan langkah operator yang diperlukan.

Halaman privat memeriksa sesi pada server. Client query tetap tunduk RLS dan filter owner; error sumber data tidak diubah menjadi statistik nol. Preview mengambil file melalui endpoint privat. Respons JSON API workspace memakai envelope `data/meta` atau `error`; PDF dikirim sebagai stream. Respons privat memakai header `private, no-store`.

Pengajuan memvalidasi PDF di server, menghitung SHA-256 dari byte asli, menyimpan file privat, dan membuat submission berstatus `pending_review`. Header `Idempotency-Key` mempertahankan identitas percobaan saat retry isian yang sama. Kegagalan atau hasil penyimpanan yang belum pasti ditampilkan sebagai error, bukan konfirmasi sukses.

Perilaku `/api/v1` di atas merupakan baseline administratif lama: revisi membuat versi baru tanpa menimpa snapshot, dan pengajuan rejected harus menjadi dokumen baru jika dicoba kembali. Roadmap review/credential lama tidak menjadi roadmap produk baru. Persetujuan administratif maupun hash yang cocok tidak menjamin keaslian penerbit atau keabsahan hukum.

R2 memakai tabel dan `/api/v2` terpisah. Kode akun bukan token akses atau tanda tangan. Undangan mengikat satu versi immutable dan kedaluwarsa setelah 168 jam. Pemilik boleh membatalkan sebelum keputusan; penerima membaca/mengunduh selama undangan aktif dan setelah selesai, dengan akses dicabut pada rejected/cancelled/expired. R2 menghasilkan pending/cancelled dan menghitung expired dari waktu; R3 menambah rejected/consented/completed setelah migration 010 diaktifkan. Persetujuan committed mendahului render; completed baru ditetapkan setelah hasil disimpan dan diperiksa. QR tidak memberikan akses publik. Satu request per dokumen; permintaan baru memakai draft baru. Tidak ada email/SMS otomatis, verifikasi publik atau akses isi khusus admin.

Pilihan tema Terang, Gelap, dan Sistem disimpan pada browser melalui `dvp-theme`. Silver/white, sidebar graphite, CTA biru, dan Geist lokal mengikuti desain yang disetujui. Daftar dokumen memakai tabel desktop dan kartu mobile; loading, empty, error, serta receipt sukses menggunakan keadaan aktual.

## Konfigurasi

| Variabel                               | Pemakaian                                                                                         |
| -------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `APP_URL`                              | Origin canonical yang persis sama dengan browser, contoh `http://127.0.0.1:3000`                  |
| `AUTH_FLOW_SECRET`                     | HMAC server untuk limiter, recovery dan binding audit keputusan; dibuat setup                     |
| `NEXT_PUBLIC_SUPABASE_URL`             | URL project development                                                                           |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Publishable key atau legacy anon                                                                  |
| `SUPABASE_SECRET_KEY`                  | Secret server-only atau legacy service_role                                                       |
| `DOCUMENT_ENVIRONMENT`                 | `development`; pengajuan juga memerlukan origin loopback                                          |
| `DOCUMENT_MAX_FILE_BYTES`              | Default `10485760` (10 MiB), integer positif yang dapat diturunkan sampai batas maksimum tersebut |

Consent legacy adalah `development-2026-11-04`; R2 memakai `internal-upload-development-2026-11-05` dan `internal-sharing-development-2026-11-05` yang telah [disetujui untuk development](docs/signing-revision/development-consent.md). Tanggal pada ID merupakan versi teks. Checkbox selalu kosong pada awal form. PDF terenkripsi/password-protected ditolak; file harus lolos pemeriksaan tipe, signature, struktur, dan batas sumber daya worker. R3 juga memakai consent tindakan `internal-action-development-2026-11-05` dan tidak memerlukan environment baru; guard development loopback dan batas maksimum 10 MiB tetap berlaku.

Registrasi memeriksa email confirmation provider. R-04 mewajibkan email terverifikasi sebelum pengajuan; guard server dan trigger database menerapkannya. Role berasal dari tabel `user_roles`. Privileged client berada pada server untuk operasi terbatas yang sudah diotorisasi, termasuk RPC keamanan/limiter dan akses private Storage; secret tidak dikirim ke browser.

Untuk project Supabase development baru, terapkan migration **001-012** sesuai urutan dan seed kategori. **Project development saat ini sudah memiliki 001-012; jangan mengulang migration atau reset database.** API key aplikasi tidak menjalankan DDL. Riwayat aktivasi tahap sebelumnya dipertahankan; [aktivasi R4](docs/signing-revision/r4-activation-check.md) lulus 49 pemeriksaan. [Setup admin awal dan uji dashboard](docs/signing-revision/r4-cloud-acceptance-plan.md) merupakan langkah berikutnya, bukan pemberian role otomatis oleh migration.

**Migration 010 sudah dijalankan menurut operator dan lulus preflight API 43 pemeriksaan.** Jangan ulangi migration yang sudah ada. [Pemeriksaan aktivasi R3](docs/signing-revision/r3-activation-check.md) mencatat hasil tabel/RPC/bucket dan batas bukti. Runner penerimaan peserta tersendiri tersedia pada [rencana cloud R3](docs/signing-revision/r3-cloud-acceptance-plan.md), sudah dijalankan sesuai persetujuan dan lulus setelah kelanjutan yang ditinjau. Jangan mengulang runner pembuat fixture. Migration ini menambah keputusan/receipt dan bucket hasil privat 20 MiB; upload sumber tetap maksimal 10 MiB.

Aktifkan Confirm email, selaraskan Site URL/redirect URL dengan `APP_URL`, dan gunakan template confirmation/recovery yang tersedia. `localhost` dan `127.0.0.1` merupakan origin berbeda. Restart dev server atau build ulang setelah konfigurasi berubah. Stack Supabase lokal penuh memerlukan Docker; runner SQL native hanya menangani pengujian database.

Pemeriksaan koneksi dasar dan ketersediaan RPC workspace:

```powershell
npm run supabase:check
npm run supabase:check -- --workspace
npm run supabase:check -- --workspace --signing
```

Operator telah melaporkan 011 berhasil. `npm run supabase:check -- --workspace --signing --signing-r3 --qr-placement` lulus **47 pemeriksaan** tanpa membuat data. [Catatan aktivasi](docs/signing-revision/qr-placement-activation-check.md) membedakan bukti ini dari [penerimaan peserta cloud R3b](docs/signing-revision/qr-placement-cloud-report.md) yang telah lulus. Jangan mengulang 011.

Perintah tersebut memeriksa konfigurasi/Auth API, tabel role, dan RPC dengan hasil yang diringkas tanpa mencetak key atau data akun. Mode `--workspace` mengharapkan penolakan anonim `401/403 + 42501` pada RPC counts dan penolakan input invalid `400 + 22023` pada RPC limiter. Input limiter sengaja ditolak sebelum perubahan counter, lock, atau cleanup; pemeriksaan tidak membuat akun, mengirim email, atau menulis pengajuan. HTTP 404 pada pemeriksaan ini berarti RPC belum dapat ditemukan melalui API dan perlu ditelusuri, sekalipun SQL sudah dilaporkan dijalankan.

Mode `--signing` menambah HEAD empat tabel R2 dengan nol baris, penolakan anon, empat RPC dengan actor null serta limiter dengan input invalid. Penolakan terjadi sebelum penulisan data/counter. Preflight ini tidak memeriksa sesi peserta, kelengkapan backfill atau alur dokumen.

Hasil preflight terakhir pada 9 November 2026: **26 pemeriksaan lulus** setelah satu kegagalan jaringan sementara dan retry. Empat tabel signing merespons service HEAD 200 dan anon 401; empat RPC menolak actor null dengan 403/42501, limiter menolak input invalid 400/22023 dan kelima RPC menolak EXECUTE anon 401/42501 dengan pesan permission denied. Auth settings, akses tabel role dan pemeriksaan recovery merespons 200; counts anonim ditolak dengan `401 / 42501`; input limiter invalid ditolak dengan `400 / 22023`. Semua sesuai kontrak. Status `LULUS` ini membuktikan koneksi dan batas pemeriksaan tersebut. Smoke browser/profil terpisah sudah lulus. Pengajuan dan preview file cloud juga lulus pada retest R1; email delivery tetap belum dibuktikan. Detail ada pada [setup User Workspace](docs/user-workspace-setup.md).

## Pemeriksaan

```powershell
npm run lint
npm run typecheck
npm test
npm run test:db
npm run test:pdf:signing
npm run test:pdf:movable
npm run test:ui:qr
npm run build
npx playwright install chromium
npm run test:e2e
npm run test:integration
npm run format:check
```

Pemeriksaan R3b: **763 unit lulus/32 file**, **340 SQL native lulus/10 file**, lint/typecheck/build lulus; browser dasar **43 lulus + 5 skip/48 total**, editor QR **4 lulus** pada desktop/mobile. Probe worker/raster PDF berhasil mendekode enam QR sesuai posisi, mencakup empat rotasi, UserUnit dan CropBox yang terpotong MediaBox; hasil tidak menambah halaman. [Laporan R3b](docs/signing-revision/qr-placement-report.md) membedakan bukti lokal, aktivasi 011 yang telah diperiksa, dan [penerimaan peserta cloud](docs/signing-revision/qr-placement-cloud-report.md) yang telah lulus. Uji cloud R3 sebelumnya pada dua dokumen dipertahankan sebagai [bukti historis](docs/signing-revision/r3-cloud-report.md); runner tersebut tidak dijalankan ulang.

Pemeriksaan R2 mencatat **648 unit lulus/23 file**, **306 SQL native lulus/8 file**, ESLint/TypeScript lulus, serta browser **43 lulus, 5 skip/48 total**. Tiga skip adalah smoke terautentikasi opt-in yang tidak dijalankan untuk menghindari akun cloud tambahan, dua skip adalah drawer yang tidak berlaku pada desktop/tablet. Build dan format akhir dicatat pada [laporan R2](docs/signing-revision/r2-report.md). Satu tes upload/file cloud R1 dan satu tes undangan/pembatalan cloud R2 telah lulus. R2 meninggalkan dua akun peserta, satu draft/versi/PDF dan satu request cancelled sesuai persetujuan; akun pembanding telah dibersihkan. Workflow CI remote dan SMTP belum dinyatakan lulus. Output browser biasa memakai test-results/browser agar receipt operator tidak dibersihkan.

Unit test menggunakan kontrak provider yang diberi label mock. Tes SQL memakai PostgreSQL native **17+** terisolasi. Playwright menjalankan production server port **3100** dan memeriksa desktop/tablet/mobile; build dahulu. Report browser berada di `playwright-report/` dan `test-results/`.

Smoke browser terautentikasi bersifat opt-in: `DVP_E2E_AUTH_ENABLED=1`, `DVP_E2E_AUTH_CONFIRM=synthetic-development-account`, serta `DVP_E2E_AUTH_EMAIL`/`DVP_E2E_AUTH_PASSWORD` untuk akun sintetis development yang telah disiapkan dan emailnya terverifikasi. Runner Playwright langsung tidak membuat akun otomatis dan secara default tidak mengubah dokumen/profil.

Helper berikut membuat satu akun sintetis terkonfirmasi melalui Auth Admin API tanpa meminta email, memeriksa role normal user/counts owner, menjalankan browser, lalu menghapus hanya akun yang cocok ID/email/run marker:

```powershell
npm run test:e2e:workspace -- --confirm-development
```

Default menjalankan smoke tiga viewport tanpa menyimpan edit profil. Tambahkan `--check-profile` untuk menguji penyimpanan nama/telepon sintetis pada desktop, reload, PATCH nama saja yang mempertahankan phone, dan penolakan perubahan email/role/owner. Tambahkan `--all` untuk menjalankan seluruh suite browser. Command berikut sudah lulus **37 tes dengan 2 skip**, dan cleanup akun berhasil:

```powershell
npm run test:e2e:workspace -- --confirm-development --check-profile --all
```

Helper memeriksa kesiapan 008 sebelum membuat akun. Trace/screenshot otomatis suite credential dimatikan; screenshot eksplisit hanya memakai akun sintetis. Pengujian tersebut tidak membuat dokumen cloud atau meminta pengiriman email. [Penerimaan upload/file cloud](docs/phase-3-cloud-acceptance-plan.md) sudah lulus satu tes pada 5 November 2026, run `845bb91e-cda5-4870-9b1a-f568c27d2e8c`. Ini memakai runner terpisah dari helper sementara. Runner cloud menolak invocation baru sebelum jaringan bila proof sebelumnya belum direkonsiliasi atau sudah mempunyai receipt; jangan menghapus/reset proof untuk membuat fixture kedua. Lihat [laporan R1](docs/signing-revision/r1-report.md).

Suite integrasi provider nyata memakai lima variabel `SUPABASE_AUTH_TEST_*` terpisah dan tanpa opt-in melewati kelima tes. Suite itu membuat/menghapus akun sintetis melalui Admin API; ia tidak membuktikan SMTP atau seluruh perjalanan browser aplikasi. Lihat [panduan autentikasi](docs/authentication-setup.md).

`test:db` mendeteksi binary Windows `C:\Program Files\PostgreSQL\17\bin`; lokasi lain memakai `PG_BIN`. Runner membuat cluster sementara, port loopback/password acak, menerapkan migration dan seed, menjalankan tes, lalu membersihkan cluster. Database/service yang sudah ada dan URL database dari environment tidak dipakai. `npm run db:types` memperbarui tipe dari cluster terisolasi yang baru dimigrasi.

## Struktur

```text
src/app/(auth)/             Form akun dan Server Actions autentikasi
src/app/auth/               Callback PKCE dan konfirmasi token provider
src/app/(public)/           Showcase /foundation
src/app/(user)/             User Workspace, pengajuan/revisi, guard, loading/error
src/app/(user)/profile/     Form profil dan updateProfileAction
src/app/(admin)/admin/      Admin Workspace dengan guard role
src/app/policies/           Kebijakan pengajuan development
src/app/api/v1/             API identitas, workspace, dokumen/file, profil
src/app/api/v2/             API kode akun, draft privat, undangan dan file terotorisasi
src/features/workspace/     Presentasi, form, status, receipt, dan DTO type-only
src/features/signing/       Draft, undangan, keputusan, bukti privat dan PDF hasil
src/components/             Auth, layout, UI reusable, dan tema
src/lib/auth/               Sesi, origin, redirect, limiter, recovery
src/lib/documents/          Validasi metadata pengajuan dan profil
src/lib/signing/            Kode akun, validasi dan versi consent development baru
src/lib/env/                Validasi konfigurasi publik/server
src/lib/supabase/           Browser, cookie-scoped server, privileged client
src/server/workspace/       Query/mapping owner-only dan kontrak DTO
src/server/documents/       Upload, PDF worker, multipart, konfigurasi development
src/server/signing/         DAL RLS, keputusan, receipt, render worker, upload/file privat
src/server/api.ts           Envelope respons, otorisasi sesi/origin, error terkontrol
src/proxy.ts                Refresh sesi dan penolakan akses tamu
src/styles/                 Token asli; tambahan terpusat pada globals.css
src/types/database.ts       Tipe database hasil generation
supabase/migrations/        Dua SQL asli + sepuluh migration tambahan (001–012); 012 cloud lulus preflight
supabase/templates/         Template email confirmation/recovery
supabase/operators/         Grant role operator dengan audit
scripts/                    Setup env, preflight, cluster SQL terisolasi, tipe
tests/                      Unit, database, browser, integrasi provider opt-in
docs/                       Keputusan, setup, preservasi, laporan tiap phase
```

Seluruh paket dokumentasi, SQL, dan tujuh gambar asli tetap di `Document_Verification_Platform_v1.0.2/document-verification-platform-v1.0.2/`. SHA-256 **41 file asli**, salinan SQL 001/002, dan design tokens diperiksa unit test. Jangan format ulang sumber yang dipertahankan. Keputusan terbaru tercatat di [decision-notes.md](docs/decision-notes.md).


## Cara Run

Lingkunagn Development
```bash
docker compose --env-file .env.local -f docker-compose.yml -f docker-compose.dev.yml up --build
```

Lingkungan Production
```bash
docker compose --env-file .env.production -f docker-compose.yml up -d --build
```