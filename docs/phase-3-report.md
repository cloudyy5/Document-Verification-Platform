# Laporan Phase 3 — User Workspace

Tanggal awal **4 November 2026**; checkpoint R1 diperbarui **5 November 2026**, Asia/Makassar. Source User Workspace development sudah tersedia. Metadata aplikasi Phase 3 memakai versi **0.4.0**. **Koneksi cloud, pembacaan workspace dan pengujian profil sintetis telah lulus pemeriksaan terbatas.** Screenshot katalog memperlihatkan view dan kedua RPC Phase 3 tersedia; preflight API lulus. Browser desktop/tablet/mobile memakai akun sintetis sementara yang kemudian berhasil dibersihkan.

**Retest fondasi upload/file cloud R1 lulus pada 5 November 2026:** satu tes nyata mencakup UI submit, receipt versi 1/pending, retry identik tanpa duplikasi, konflik payload, list/detail/hash, current/historical download/range, API akun lain 404, guest 401, penolakan revisi saat pending, Storage langsung ditolak, serta preview PDF native yang diperiksa visual. Satu akun pemilik dan PDF 2.831 byte dipertahankan; akun pembanding dibersihkan. Jumlah credential verifikasi untuk dokumen uji adalah nol. Ini tidak mengaktifkan alur tanda tangan, QR, hak penerima, atau review admin baru. SMTP dan revisi sukses pada cloud belum diuji. [Laporan R1](signing-revision/r1-report.md) memuat checkpoint revisi produk.

## 1. File dan folder

| Lokasi                                                                                                       | Isi Phase 3                                                                                                   |
| ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| `src/app/(user)/dashboard/page.tsx`                                                                          | Ringkasan dan pengajuan terbaru dari query owner                                                              |
| `src/app/(user)/documents/`                                                                                  | Daftar, filter, pagination cursor, detail, riwayat versi dan not-found                                        |
| `src/app/(user)/submit/page.tsx`                                                                             | Form pengajuan dengan konfigurasi batas dan versi persetujuan server                                          |
| `src/app/(user)/profile/`                                                                                    | Profil sendiri dan Server Action pembaruan nama/telepon                                                       |
| `src/app/(user)/verify/page.tsx`                                                                             | Antarmuka tiga metode dengan penjelasan bahwa mesin belum aktif                                               |
| `src/features/workspace/`                                                                                    | Dashboard, list/detail, form pengajuan/profil, status, format, copy hash, kebijakan development dan UI states |
| `src/server/workspace/{queries,mappers,types}.ts`                                                            | DAL user-scoped, validasi hasil, DTO tanpa storage path/credential                                            |
| `src/lib/documents/validation.ts`                                                                            | Metadata, tanggal, kategori Lainnya, persetujuan dan profil                                                   |
| `src/server/documents/`                                                                                      | Konfigurasi development, pembacaan multipart terbatas, worker PDF, upload/idempotensi dan file privat         |
| `src/server/{api,errors}.ts`                                                                                 | Sesi, pemeriksaan Origin, envelope respons privat dan error terkontrol                                        |
| `src/app/api/v1/`                                                                                            | Endpoint dashboard, kategori, dokumen/detail/file/revisi, profil dan identitas sendiri                        |
| `supabase/migrations/202611040007_owner_workspace_queries.sql`                                               | View owner-only dengan security invoker/barrier dan aggregate counts milik sendiri                            |
| `supabase/migrations/202611040008_document_upload_limiter.sql`                                               | Limiter upload gabungan atomik, RPC hanya untuk service role                                                  |
| `scripts/database-types.mjs`, `src/types/database.ts`                                                        | Dukungan view baca saja dan tipe schema hasil regenerasi                                                      |
| `tests/database/{workspace,upload-limiter}.test.ts`                                                          | Isolasi owner, current version, counts, profil dan batas upload concurrent                                    |
| `tests/unit/{workspace-*,document-*}.test.ts`                                                                | Query, API, metadata, parser, multipart, upload/idempotensi dan private-file serving                          |
| `tests/e2e/workspace.spec.ts`                                                                                | Boundary guest dan smoke akun development dengan opt-in eksplisit                                             |
| `docs/user-workspace-setup.md`                                                                               | Setup migration, batas development, pengujian dan rekonsiliasi                                                |
| `scripts/test-workspace-cloud.mjs`, `playwright.cloud.config.ts`, `tests/cloud/workspace.acceptance.spec.ts` | Uji cloud opt-in: satu tes lulus, satu fixture persisten, guard pengulangan dan rekonsiliasi                  |
| `docs/phase-3-cloud-acceptance-plan.md`, `tests/fixtures/phase-3-development.pdf`                            | Rencana penerimaan dan PDF sintetis satu halaman, 2.831 byte                                                  |

Helper `scripts/test-workspace-browser.mjs` juga ditambahkan untuk pemeriksaan opt-in dengan akun sintetis sementara. Konfigurasi worker tracing, metadata package, contoh environment dan panduan utama turut diperbarui. Paket sumber asli **41 file**, tujuh gambar, SQL 001/002 dan design tokens dipertahankan; unit preservasi memeriksa checksum/salinannya. Tidak ada statistik atau dokumen demo yang dipresentasikan sebagai data database pengguna.

## 2. Teknologi dan versi

| Teknologi                 | Versi            |
| ------------------------- | ---------------- |
| Next.js App Router        | 16.4.3           |
| React / React DOM         | 19.3.1           |
| TypeScript strict         | 6.0.3            |
| Tailwind CSS              | 4.3.3            |
| Supabase JS / SSR         | 2.118.0 / 0.12.7 |
| Zod / next-themes         | 4.6.7 / 0.4.6    |
| pdf-lib                   | 1.17.1           |
| Vitest / Playwright       | 4.1.12 / 1.64.1  |
| ESLint / Prettier         | 10.14.0 / 3.9.10 |
| PostgreSQL pengujian / pg | 17.9 / 8.23.1    |
| Supabase CLI              | 2.122.0          |

Node **24 LTS** tetap direkomendasikan. `pdf-lib` merupakan dependency baru untuk pemeriksaan struktur PDF; pemrosesan berlangsung pada worker lokal, tanpa layanan parser berbayar. Implementasi ini tidak mengaktifkan pembelian, deployment publik, atau provider/scanner berbayar.

## 3. Fitur dan batas fondasi

- Dashboard memakai counts dokumen logis milik akun dan pengajuan terbaru yang nyata. Query gagal menampilkan error layanan; kegagalan tidak diganti angka nol palsu.
- Dokumen saya menyediakan pencarian judul, status, kategori, rentang tanggal pengajuan UTC dan cursor. Limit default 20, maksimum 50. View serta query menyaring owner secara eksplisit, termasuk bila akun juga memegang reviewer/admin.
- Detail menampilkan metadata current version, hash, file privat, versi pengajuan dan snapshot keputusan yang dapat dibaca owner. Kategori yang sudah tidak terlihat melalui RLS tidak menghilangkan dokumen milik pengguna.
- Profil hanya mengubah `fullName` dan `phone`. Email ditampilkan dari sesi terverifikasi dan tidak dapat diubah lewat endpoint profil. Field role/owner/status ditolak; phone yang tidak dikirim tidak dihapus otomatis.
- Pengajuan memerlukan sesi, role normal user, email verified dan Origin canonical. Kategori hanya klasifikasi; Lainnya membutuhkan jenis khusus. Field opsional tetap opsional. Checkbox persetujuan awal tidak dicentang; server memeriksa versi `development-2026-11-04` dan database menyimpan timestamp persetujuan.
- Batas yang disetujui adalah **10 MiB / 10.485.760 byte**. Environment dapat menurunkannya. Pengajuan aktif hanya ketika `APP_URL` merupakan loopback dan `DOCUMENT_ENVIRONMENT=development`.
- Server membatasi total body, termasuk bila Content-Length tidak ada, dengan tenggat baca 30 detik. File diperiksa ekstensi, MIME, signature/footer dan struktur; file kosong, rusak, terenkripsi/password, serta indikator konten aktif/attachment yang dideteksi ditolak. SHA-256 dihitung dari byte asli pada server.
- Worker memisahkan parser dari environment aplikasi, memiliki timeout 10 detik dan batas heap V8. Batas itu **bukan sandbox memori proses penuh** dan tidak menggantikan scanner malware/CDR. Scanner belum dikonfigurasi; penggunaan produksi tetap diblokir.
- File ditulis ke bucket privat dengan path ID buatan server dan `upsert:false`. Initial submission dibuat sebagai `pending_review`. Revisi hanya setelah `revision_requested`, menciptakan versi immutable baru pada dokumen yang sama. Pengajuan setelah rejected dibuat sebagai dokumen baru.
- Idempotency-Key UUID menghasilkan ID UUIDv8 deterministik yang terikat owner/operasi/dokumen. Retry membandingkan metadata yang dinormalisasi, nama/ukuran file, policy version dan hash; key yang dipakai untuk payload berbeda menerima 409. Retry tetap melalui rate limit, validasi file, kategori aktif dan kebijakan saat ini. Mekanisme ini tidak menjanjikan replay tanpa batas setelah kategori/policy berubah.
- Jika hasil RPC tidak pasti, server memeriksa receipt yang benar-benar tersimpan. Cleanup hanya menyasar object yang dibuat request tersebut setelah error rollback yang dikenali dan pembacaan sukses memastikan receipt tidak ada. Kegagalan jaringan seperti EPIPE diperlakukan tidak pasti. File privat yang belum dapat dipastikan statusnya dipertahankan untuk rekonsiliasi operator; request yang kalah race tidak menghapus object request lain.
- Limiter SQL menerima maksimum 10 attempt per user dan 50 global dalam window 15 menit, dengan HMAC digest dan keputusan gabungan yang diserialisasi. Permintaan yang ditolak tidak membuat baris identitas baru setelah cap global. Guard proses membatasi dua upload aktif pada satu instance; batas ini bukan limiter concurrent global seluruh deployment.
- File endpoint memeriksa owner/current atau historical submission, mengambil object melalui server, dan memverifikasi ukuran/hash sebelum mengirim byte. Respons memakai private/no-store, nosniff, nama file terenkode, same-origin framing/CSP, serta single byte range yang valid. Tidak ada public/signed Storage URL yang diberikan.
- Identitas silver/white, sidebar graphite, CTA biru, Geist, responsive layout serta Light/Dark/System dipertahankan. Halaman Verify hanya menyediakan UI metode yang dinonaktifkan; **kode, QR dan pencocokan file Phase 5 belum diterbitkan/diaktifkan**. Operasi review administrator baseline belum aktif; roadmap revisi persetujuan internal tidak otomatis melanjutkan Phase 4 review lama.

## 4. Menjalankan aplikasi

```powershell
cd D:\Website
npm ci
npm run auth:setup
npm run dev
```

`auth:setup` tidak menimpa `.env.local` yang sudah tersedia. Buka **http://127.0.0.1:3000/login** menggunakan origin yang sesuai `APP_URL`. Script dev/start mengikat server ke loopback. Halaman utama User Workspace adalah `/dashboard`, `/documents`, `/submit`, `/documents/<UUID>`, `/profile` dan `/verify`.

Production build lokal dapat diperiksa dengan `npm run build`, kemudian `npm run start`. Penggunaan command build tidak memberikan izin rilis publik; upload tetap dibatasi konfigurasi development.

## 5. Hasil pemeriksaan

| Pemeriksaan                             | Hasil terakhir yang sudah diketahui                                                                            |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `npm run lint`                          | Lulus                                                                                                          |
| `npm run typecheck`                     | Lulus                                                                                                          |
| `npm test`                              | **435 lulus**, 18 file                                                                                         |
| `npm run db:types`                      | Lulus, delapan migration + seed pada cluster baru; view/RPC masuk tipe generated                               |
| `npm run test:db`                       | **254 lulus**, 7 file; cluster terisolasi dihentikan dan dihapus                                               |
| `npm run build`                         | Lulus                                                                                                          |
| Browser lengkap dengan helper opt-in    | **37 lulus, 2 dilewati**, tiga viewport Chromium; termasuk smoke autentikasi dan profil sintetis               |
| Regresi header API privat               | **3 lulus**, server nyata setelah penyesuaian header PDF                                                       |
| `npm run test:integration`              | **5 dilewati**; integrasi provider opt-in belum dijalankan                                                     |
| `npm audit --omit=dev`                  | **0 vulnerability runtime**                                                                                    |
| `npm run supabase:check -- --workspace` | Semua pemeriksaan lulus; Auth/role/recovery 200, counts anonim 401/42501, limiter invalid 400/22023            |
| Browser/profil cloud sintetis           | Login, pembacaan workspace, tema/logout tiga viewport serta update profil desktop lulus; cleanup akun berhasil |
| Integrasi upload/file cloud             | **1 tes lulus**, 5 November 2026; fixture pending legacy dipertahankan, akun pembanding dibersihkan            |
| Preservasi sumber                       | Checksum/copy pada unit suite lulus                                                                            |

Unit HTTP/query/Storage memakai mock yang ditandai jelas. Parser tests menjalankan worker terhadap fixture PDF. Tes database memakai PostgreSQL nyata dengan metadata Auth/Storage khusus cluster uji, tanpa GoTrue/PostgREST/SMTP/Storage HTTP. Dua skip browser adalah drawer mobile pada viewport desktop/tablet. Tiga smoke akun terautentikasi yang sebelumnya dilewati sudah dijalankan dan lulus melalui helper opt-in. Lima skip suite integrasi provider terpisah bukan hasil lulus. Regresi argumen startup worker lulus melalui subprocess Node nyata, dan regresi payload yang dibungkus Turbopack juga lulus; checkpoint penuh adalah 435 unit test dan build lulus. Angka unit/SQL/browser baseline tersebut dipisahkan dari satu tes cloud R1 yang baru lulus.

E2E guest tidak membuat akun, mengirim email atau menyimpan dokumen. Helper `npm run test:e2e:workspace -- --confirm-development --check-profile --all` sudah lulus dan cleanup akun berhasil. Helper memeriksa 008 sebelum membuat akun terkonfirmasi melalui Admin API tanpa meminta email, memastikan role normal user dan counts owner, menjalankan browser tiga viewport, lalu memeriksa ID/email/run marker sebelum cleanup. Flag `--check-profile` menguji penyimpanan nama/telepon sintetis pada desktop, reload, PATCH nama saja yang mempertahankan phone, serta respons 422 untuk email/role/owner. Flag `--all` menjalankan seluruh 39 tes browser; default helper hanya menjalankan smoke workspace dan tidak menyimpan edit profil. Trace/screenshot otomatis suite credential dimatikan. Pengujian ini tidak membuat dokumen cloud dan tidak membuktikan pengiriman email maupun upload cloud.

## 6. Masalah dan batas yang ditemukan

Worker PDF memakai `env: {}` dan `execArgv: []`. Argumen startup induk seperti `--env-file` atau preload tidak diwariskan, sehingga worker tidak memuat ulang credential server. Regresi juga memastikan induk dengan `--input-type=module` tetap dapat memvalidasi PDF melalui worker file.

Header endpoint PDF diselaraskan pada konfigurasi Next agar aturan global tidak menimpa `no-referrer` dan `SAMEORIGIN` dari handler. Regresi browser memeriksa header melalui server nyata serta memastikan guest tetap ditolak sebelum akses file. Halaman dan API lain mempertahankan `DENY`.

Pemeriksaan awal sempat menerima **404 / PGRST202** ketika object Phase 3 belum ditemukan. Setelah penerapan migration 007/008 dikonfirmasi, tiga object pada katalog tidak lagi NULL dan seluruh preflight workspace lulus. Masalah keterlihatan schema tersebut sudah terselesaikan. Preflight sendiri tidak mencakup upload/file; penerimaan cloud R1 yang terpisah kini telah lulus. Secret API aplikasi tidak dapat dipakai untuk menjalankan DDL migration melalui endpoint REST.

[Penerimaan cloud](phase-3-cloud-acceptance-plan.md) lulus pada retest run `845bb91e-cda5-4870-9b1a-f568c27d2e8c`, tanggal lokal 5 November 2026. Percobaan pertama `c35e4f04-609d-4c1c-b071-22fdbb21ce22` gagal sebelum penyimpanan akibat payload worker pada build production, lalu direkonsiliasi dengan nol dokumen/submission/object dan kedua akun dibersihkan. Perbaikan menempatkan byte PDF pada envelope nested agar transformasi worker tidak mengubah typed array menjadi object biasa. Pada retest, satu fixture pending legacy kini benar-benar tersimpan; itu bukan record signing atau persetujuan penerima.

Review memperbaiki pencampuran error jaringan dengan rollback SQL, pembacaan multipart yang dapat tertahan, phone PATCH yang terhapus saat tidak dikirim, klasifikasi encrypted PDF dan deteksi attachment/annotation tertentu. Worker parser tetap tidak membuktikan file bebas malware. Batas sumber daya, quota cloud, scanner, kebijakan produksi, retensi/penghapusan, admin MFA dan hardening deployment masih memiliki gate sesuai fase rilis.

Pada kegagalan hasil commit yang tidak pasti, object privat dapat tertinggal. Operator harus membandingkan object terhadap metadata sebelum membersihkan; tidak ada job retensi atau penghapusan otomatis yang diasumsikan. Kebijakan persetujuan development tidak berlaku sebagai persetujuan hukum/privasi produksi.

## 7. Konfigurasi berikutnya

1. Pastikan tiga field Supabase, `APP_URL` dan `AUTH_FLOW_SECRET` tersedia secara lokal/server. Jangan mengirim nilainya ke chat, browser, screenshot atau source control.
2. Untuk project baru, terapkan 001–008 lalu seed; project yang sudah memiliki 001–006 hanya memakai 007 lalu 008. Project development yang diperiksa kini sudah memiliki object 007/008. Jangan reset atau menjalankan ulang migration yang sudah ada.
3. Gunakan `DOCUMENT_ENVIRONMENT=development`, origin loopback, dan `DOCUMENT_MAX_FILE_BYTES=10485760` atau nilai lebih kecil yang positif.
4. Gunakan `npm run supabase:check -- --workspace` untuk preflight. Login/workspace/profil sintetis sudah diuji melalui helper; hasil ini terpisah dari penerimaan upload/file.
5. Penerimaan fixture persisten sudah lulus; jangan mengulang runner untuk membuat fixture kedua. Proof lokal mencatat receipt dan pemilik yang dipertahankan. Guard runner menolak proof belum direkonsiliasi/yang sudah mempunyai receipt sebelum jaringan; jangan reset proof secara buta. Revisi sukses tetap memerlukan fixture sah dan belum dibuktikan oleh tes ini.
6. Ikuti [panduan User Workspace](user-workspace-setup.md), [setup autentikasi](authentication-setup.md), dan [roadmap revisi](signing-revision/implementation-roadmap.md). Arah produk kini persetujuan internal dengan satu penandatangan; Phase 4 review lama tidak otomatis dilanjutkan.
