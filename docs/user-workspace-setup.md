# Setup User Workspace — Phase 3

User Workspace menggunakan Supabase Auth, PostgreSQL dan Private Storage yang sama dengan Phase 2. Source menyediakan pembacaan data owner, pengajuan/revisi PDF development, file privat dan pembaruan profil. Mesin verifikasi kode/QR/hash Phase 5 serta operasi reviewer Phase 4 belum diaktifkan.

**Status cloud terbaru, 5 November 2026 (Asia/Makassar):** preflight dan smoke workspace/profil lulus; retest R1 juga lulus satu tes upload/file cloud dengan fixture yang sudah disetujui. Satu pengajuan pending/version 1 dan PDF privat 2.831 byte dipertahankan bersama akun pemilik; akun pembanding dibersihkan. Retry tidak membuat duplikat, API akun lain/guest dan Storage langsung ditolak, serta preview native berhasil diperiksa. Ini belum mengaktifkan undangan, persetujuan penerima atau QR produk baru. Tidak ada pembelian, migration baru atau layanan berbayar yang diaktifkan pada retest.

## 1. Environment dan server lokal

Gunakan Node 24 LTS. Untuk checkout baru:

```powershell
cd D:\Website
npm ci
npm run auth:setup
```

`auth:setup` hanya membuat file yang belum ada. Isi konfigurasi melalui editor lokal; pertahankan secret yang sudah disiapkan:

| Variabel                               | Kebutuhan                                                           |
| -------------------------------------- | ------------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`             | URL project development yang sama dengan target migration           |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Publishable key project; legacy anon kompatibel                     |
| `SUPABASE_SECRET_KEY`                  | Secret server-only project; legacy service_role kompatibel          |
| `APP_URL`                              | Origin canonical, misalnya `http://127.0.0.1:3000`                  |
| `AUTH_FLOW_SECRET`                     | Secret server minimal 32 karakter; dipakai untuk HMAC counter/proof |
| `DOCUMENT_ENVIRONMENT`                 | `development`; nilai lain membuat upload tidak tersedia             |
| `DOCUMENT_MAX_FILE_BYTES`              | Integer positif maksimum `10485760` (10 MiB); boleh diturunkan      |

HTTP hanya diterima untuk loopback pada konfigurasi origin. `localhost` dan `127.0.0.1` adalah origin berbeda. Buka origin yang sama dengan `APP_URL`; mutation memeriksa Origin. Restart dev server setelah env berubah. Nilai `NEXT_PUBLIC_*` memerlukan build ulang untuk build production lokal.

```powershell
npm run dev
```

Buka `/login`, lalu `/dashboard`, `/documents`, `/submit` dan `/profile`. Script dev/start mengikat alamat `127.0.0.1`. Production build lokal memakai `npm run build` lalu `npm run start`; command ini tidak menghapus gate development upload.

## 2. Menerapkan schema pada Supabase development

Pilih project development yang benar di Dashboard. Gunakan SQL Editor dengan role **postgres**/operator tepercaya. Jalankan isi file lengkap termasuk BEGIN/COMMIT, satu file per eksekusi, dan periksa keberhasilan sebelum melanjutkan.

Project baru yang belum memiliki schema aplikasi:

1. `supabase/migrations/202611010001_initial_schema.sql`
2. `supabase/migrations/202611010002_workflow_rpcs.sql`
3. `supabase/migrations/202611010003_access_control_foundation.sql`
4. `supabase/migrations/202611010004_owner_approved_configuration.sql`
5. `supabase/migrations/202611010005_future_object_privileges.sql`
6. `supabase/migrations/202611030006_authentication_security.sql`
7. `supabase/migrations/202611040007_owner_workspace_queries.sql`
8. `supabase/migrations/202611040008_document_upload_limiter.sql`
9. `supabase/seed.sql`

Jika project yang sama sudah memiliki 001–006, jalankan **007 lalu 008 saja**. Migration tambahan memakai CREATE/ALTER dan bukan script yang dapat dijalankan ulang sembarang. Bila riwayat penerapan tidak jelas, periksa katalog terlebih dahulu. Jangan memakai reset, menghapus tabel, atau menjalankan fixture `tests/database/bootstrap.sql` di Supabase.

Migration 005 mengatur default privilege milik role pembuat; gunakan role operator yang konsisten untuk migration. Schema ditargetkan/diperiksa pada PostgreSQL 17. Migration 001 membuat bucket `document-submissions` sebagai **private**; 003 memperkuat pembatasan Storage. Jangan membuat bucket publik atau menambahkan policy allow-all agar browser dapat mengakses PDF langsung. Schema `private` tetap tidak diekspos ke Data API.

007 menyediakan view `public.workspace_documents` dengan security invoker/barrier dan filter `auth.uid()`, serta fungsi `public.get_own_workspace_counts()`. Keduanya untuk sesi authenticated. 008 menyediakan `public.consume_document_upload_limit(text,text)` yang hanya dapat dipanggil service role dari server. Key aplikasi REST tidak menyediakan akses DDL; penerapan migration dilakukan operator melalui SQL Editor atau alur migration tepercaya.

SQL Editor manual tidak otomatis menjadi catatan migration CLI. Simpan catatan file yang berhasil dijalankan. Jika project memiliki data, tinjau perubahan dan backup sebelum perubahan schema. Buat akun uji setelah schema siap; trigger pembuatan profil/role tidak melakukan backfill otomatis terhadap akun Auth yang dibuat sebelumnya.

## 3. Memeriksa schema dan koneksi

Pemeriksaan CLI berikut tidak menampilkan key atau mengambil baris data akun:

```powershell
npm run supabase:check -- --workspace
```

Pemeriksaan tersebut membaca Auth settings, memeriksa akses database, memanggil pemeriksaan recovery dengan token acak dan menguji kehadiran RPC workspace. Probe upload memakai input invalid yang ditolak sebelum lock/cleanup/perubahan counter. Pemeriksaan ini tidak mengirim email, membuat akun, mengunggah PDF atau mengonsumsi quota upload dengan input valid.

Hasil terakhir seluruhnya lulus: Auth settings, akses tabel role dan pemeriksaan recovery merespons 200; counts anonim ditolak dengan **401 / 42501**; limiter dengan digest invalid ditolak dengan **400 / 22023**. Penolakan terakhir merupakan hasil yang diharapkan. Screenshot katalog juga memperlihatkan tiga object di bawah tidak NULL. Masalah 404/PGRST202 pada pemeriksaan awal sudah terselesaikan.

Jika RPC baru tetap 404 setelah laporan migration berhasil, pastikan URL `.env.local` dan project SQL Editor benar-benar sama. Jalankan pemeriksaan katalog **baca saja** pada SQL Editor:

```sql
select
  to_regclass('public.workspace_documents') as workspace_view,
  to_regprocedure('public.get_own_workspace_counts()') as counts_rpc,
  to_regprocedure('public.consume_document_upload_limit(text,text)') as upload_limit_rpc;
```

Nilai null menunjukkan object tidak ditemukan pada database yang diperiksa. Bila object ada tetapi REST masih 404, periksa project tujuan, schema Data API dan cache schema melalui operator; jangan langsung mengulang CREATE migration atau memperluas grant. Hasil Auth 200/RPC recovery 200 sendiri tidak memastikan kehadiran 007/008. Respons generic error/503 dari workspace tetap merupakan kegagalan layanan, bukan dashboard kosong yang sudah berhasil dibaca.

## 4. Pengajuan PDF development

Pengguna menyetujui maksimum 10 MiB, penolakan PDF terenkripsi/password, revisi sebagai versi immutable baru, serta pengajuan baru untuk dokumen rejected. Versi persetujuan development adalah **`development-2026-11-04`**. Gunakan PDF sintetis tanpa data pribadi nyata. Teks dapat dibaca dari form; persetujuan harus diberikan aktif dan timestamp berasal dari database.

Form memakai judul, kategori, jenis khusus bila Lainnya, file PDF, tanggal opsional, instansi opsional, deskripsi opsional dan consent. Server memeriksa ulang field, kategori aktif, policy version, MIME/signature/struktur dan ukuran. SHA-256 berasal dari byte asli. File rusak, terenkripsi dan indikator konten aktif/attachment yang dideteksi ditolak; lolos parser tidak menyatakan file bebas malware.

Upload menerima body terbatas dengan tenggat 30 detik. Worker parser memiliki timeout 10 detik dan limit heap V8, serta tidak menerima environment credential aplikasi. Limit V8 tidak membatasi seluruh native/ArrayBuffer memory dan bukan pengganti isolasi/scan malware produksi. Tidak ada scanner malware/CDR yang dipasang. Upload di luar origin loopback development gagal tertutup sampai kebutuhan produksi disetujui dan diimplementasikan.

RPC limiter mengizinkan paling banyak 10 attempt per identitas dan 50 global per 15 menit. Identitas/global key disimpan sebagai HMAC digest; counter dibaca/diperbarui atomik. Dua request aktif juga menjadi batas memory concurrency per proses, bukan batas seluruh instance server. Penolakan quota menghasilkan 429; slot proses penuh menghasilkan UPLOAD_BUSY/503. Tidak perlu menaikkan batas untuk menyelesaikan uji fungsional kecil.

Bucket privat tidak dibuka melalui URL publik. Sukses upload/commit menghasilkan receipt dokumen/submission, versi, timestamp dan status pending review. QR/kode belum diterbitkan. Perubahan status review belum tersedia melalui UI administrator Phase 3.

## 5. Retry, konflik dan rekonsiliasi

Browser mempertahankan Idempotency-Key UUID untuk retry payload yang sama pada form tersebut. ID server dihasilkan deterministik dari owner, key dan operasi; revisi juga terikat dokumen target. Key dengan metadata/hash berbeda ditolak 409. Metadata dinormalisasi sebelum dibandingkan dan file disimpan dengan `upsert:false`; server tidak menimpa file versi sebelumnya.

Kegagalan respons tidak selalu berarti transaksi gagal. Bila receipt sudah tersimpan dan fingerprint cocok, retry mengembalikan receipt aktual. Retry masih dapat terkena rate limit, validasi PDF, kategori yang tidak aktif, atau policy version yang berubah; setelah perubahan tersebut periksa Dokumen Saya sebelum mengirim pengajuan baru. Me-refresh browser atau mengubah field dapat menghasilkan key baru; hindari pengajuan berulang tanpa memeriksa hasil sebelumnya.

Server menghapus object hasil request hanya sesudah error rollback yang dikenali dan lookup database berhasil memastikan receipt tidak ada. Untuk kegagalan jaringan/hasil commit tidak pasti, object privat dipertahankan. Jangan menghapus object tersebut hanya berdasarkan pesan error atau umur file. Operator harus memastikan tidak ada metadata submission yang mereferensikannya, memeriksa kemungkinan request masih berjalan, lalu menangani rekonsiliasi pada lingkungan development. Tidak ada otomasi retensi/penghapusan yang diaktifkan.

## 6. Uji penerimaan dan perintah pemeriksaan

Login, pembacaan workspace dan update profil sintetis sudah diuji seperti rincian helper di bawah. [Penerimaan cloud R1](phase-3-cloud-acceptance-plan.md) juga lulus pada **5 November 2026 (Asia/Makassar)** dengan satu PDF sintetis 2.831 byte: UI submit, receipt pending/version 1, list/filter/detail/hash, current/historical preview/download/range, retry idempotensi, konflik payload, API akun lain 404, guest 401, serta penolakan Storage langsung. Preview native diperiksa secara visual. Satu akun pemilik dan satu pengajuan dipertahankan; akun pembanding dibersihkan. Percobaan awal 422 sebelumnya telah direkonsiliasi dengan nol artefak dan kedua akun dibersihkan. Ini membuktikan fondasi legacy, bukan fitur signing baru; lihat [laporan R1](signing-revision/r1-report.md).

Revisi hanya dapat diuji pada record development yang sah berstatus revision_requested. Jangan menambahkan endpoint approval/reject atau memberikan role tambahan hanya untuk melewati prasyarat pengujian; fitur reviewer berada pada Phase 4.

```powershell
npm run lint
npm run typecheck
npm test
npm run test:db
npm run build
npm run test:e2e
npm run format:check
```

Tes database menjalankan PostgreSQL native terisolasi dan tidak memigrasikan project cloud. `npm run db:types` menghasilkan tipe dari schema cluster uji baru, termasuk view baca saja, tanpa membaca data pengguna cloud. Metadata fixtures pada tes bukan layanan GoTrue/Storage HTTP.

Playwright memakai port **3100**, origin test yang sesuai, tiga viewport Chromium dan production build lokal. Guest suite tidak membuat akun atau mengirim file. Smoke login asli memerlukan environment proses lokal berikut:

| Variabel                | Nilai                                                |
| ----------------------- | ---------------------------------------------------- |
| `DVP_E2E_AUTH_ENABLED`  | `1`                                                  |
| `DVP_E2E_AUTH_CONFIRM`  | `synthetic-development-account`                      |
| `DVP_E2E_AUTH_EMAIL`    | Email akun development sintetis yang sudah disiapkan |
| `DVP_E2E_AUTH_PASSWORD` | Password akun tersebut, diisi lokal tanpa dicetak    |

Smoke ini secara default membaca workspace melalui sesi nyata tanpa menyimpan perubahan dokumen/profil. Pemeriksaan profil memerlukan flag helper terpisah dan hanya menerima akun sementara milik helper. Trace/screenshot otomatis suite credential dimatikan; screenshot eksplisit tetap hanya untuk akun sintetis. Jangan mengaktifkannya dengan akun pribadi/data sensitif. Suite provider Phase 2 menggunakan opt-in terpisah yang dijelaskan pada [setup autentikasi](authentication-setup.md); hasil skip bukan hasil lulus.

### Helper akun development sementara

Setelah migration cloud benar dan build lokal tersedia, operator dapat menjalankan:

```powershell
npm run build
npm run test:e2e:workspace -- --confirm-development
```

Command default hanya menjalankan smoke workspace pada desktop/tablet/mobile, tanpa menyimpan edit profil. Flag tambahan:

| Flag              | Perilaku                                                                                                                                                                                              |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--check-profile` | Pada desktop dan hanya akun sementara helper, menyimpan nama/telepon sintetis lewat UI, reload, PATCH nama saja sambil memastikan phone tetap tersimpan, lalu memeriksa email/role/owner ditolak 422. |
| `--all`           | Menjalankan seluruh suite browser, termasuk guest, layout, tema dan smoke terautentikasi; tidak dengan sendirinya mengaktifkan penulisan profil.                                                      |

Pemeriksaan lengkap berikut sudah dijalankan: **37 lulus, 2 dilewati**, lalu akun sintetis berhasil dibersihkan. Dua skip adalah drawer mobile pada viewport desktop/tablet.

```powershell
npm run test:e2e:workspace -- --confirm-development --check-profile --all
```

Helper memuat konfigurasi lokal dan memerlukan origin loopback, `DOCUMENT_ENVIRONMENT=development`, URL HTTPS project `*.supabase.co`, serta key publik/server. Flag `--confirm-development` merupakan opt-in untuk **membuat dan menghapus satu akun Auth sintetis pada project tersebut**; helper ini bukan pemeriksaan yang seluruhnya baca saja. Jangan menjalankannya terhadap production atau project yang belum dipastikan tujuannya.

Urutannya mengikuti `scripts/test-workspace-browser.mjs`:

1. Memanggil limiter 008 dengan digest invalid. Respons `22023` harus diterima sebelum akun dibuat. Jika 008 belum siap, helper berhenti sebelum pembuatan akun.
2. Membuat email sintetis `@example.invalid` dan password acak hanya untuk run tersebut melalui Auth Admin API, dengan email sudah dikonfirmasi. Tidak ada permintaan pengiriman email. Akun hasilnya harus memegang **role normal user**, bukan reviewer/platform_admin.
3. Login dengan client pengguna dan membaca counts owner dari 007 serta role sendiri. Kegagalan pada tahap ini menghentikan smoke dan masuk cleanup akun yang sudah diketahui ID-nya.
4. Menjalankan smoke browser login, workspace, tema dan logout pada desktop/tablet/mobile. Jika diminta, `--check-profile` menulis profil sintetis pada desktop dan `--all` memperluas run ke seluruh suite. Password diberikan melalui environment proses, tidak disimpan dalam source/argumen perintah atau dicetak; trace dan screenshot otomatis suite credential dimatikan.
5. Pada cleanup, membaca kembali akun berdasarkan ID yang dibuat dan memastikan email serta `dvp_test_run` sama dengan run marker. Hanya akun yang cocok yang dihapus. Jika pemeriksaan atau penghapusan gagal, helper melaporkan perlunya tinjauan operator tanpa menghapus akun lain secara luas.

Helper tidak membuat dokumen atau mengunggah PDF. Default tidak menulis profil; flag `--check-profile` menyimpan perubahan terbatas pada akun sintetis sementara, dan cleanup akun juga menghapus profil akun tersebut. Login tetap menggunakan layanan sesi dan counter autentikasi. Keberhasilan run ini membuktikan cakupan browser/profil yang dijalankan, sedangkan SMTP, upload/revisi/file cloud, idempotensi dan akses ke record pengguna lain belum diuji olehnya.

### Uji upload cloud dengan fixture persisten

Rencana lengkap, riwayat gagal 422 yang direkonsiliasi, serta hasil retest ada di [penerimaan cloud](phase-3-cloud-acceptance-plan.md). Runner terpisah telah lulus **satu tes** pada 5 November 2026, run `845bb91e-cda5-4870-9b1a-f568c27d2e8c`. Proof lokal mencatat receipt pending/version 1, sembilan kelompok pemeriksaan, `verificationCredentials: none_issued`, akun pembanding `cleaned_up`, dan pemilik yang sengaja dipertahankan.

Command berikut merupakan invocation yang sudah digunakan untuk fixture yang disetujui, bukan instruksi untuk menjalankannya ulang:

```powershell
npm run test:cloud:workspace -- --confirm-persistent-fixture
```

Flag tersebut mengizinkan dua akun sintetis dan satu pengajuan berlabel UJI DEVELOPMENT. Akun pemilik, PDF dan riwayat pengajuan tetap disimpan setelah browser dapat mengirim pengajuan; hasil gagal atau respons hilang tidak dianggap bukti rollback. Akun pembanding hanya dihapus setelah ID/email/run marker cocok dan query berhasil membuktikan tidak ada dokumen/submission miliknya. Runner tidak mengubah keputusan review atau membuat kode/QR.

Pengujian dijalankan sekali pada desktop dengan full Chromium untuk native PDF, tanpa retry otomatis, dan menggunakan fixture yang ukuran/hash-nya diperiksa sebelum akun dibuat. Rekaman operator tanpa credential disimpan di `test-results/cloud-workspace-run.json` serta file per-run pada folder yang diabaikan source control. Runner kini memeriksa proof lokal **sebelum jaringan**: proof yang belum direkonsiliasi atau telah mempunyai receipt menolak run baru. Jangan menghapus, mengubah atau me-reset proof untuk melewati guard; tinjau record yang mungkin committed dan gunakan pemeriksaan record yang ada. Akun kosong hanya dibersihkan setelah query berhasil menghasilkan array kosong secara eksplisit serta ID/email/run marker cocok. Screenshot preview hanya memuat PDF sintetis dan disimpan lokal.

## 7. Batas sebelum rilis

Cakupan fondasi upload/file/idempotensi dan penolakan API akun lain telah lulus pada retest R1. SMTP, revisi sukses pada cloud, akses penerima undangan, consent signing, QR dan seluruh alur produk baru belum dibuktikan oleh tes legacy ini. Status `pending_review` tidak berarti dokumen telah ditandatangani. Hasil aktual serta batasnya tercatat pada [laporan Phase 3](phase-3-report.md) dan [laporan R1](signing-revision/r1-report.md).

Sebelum publikasi diperlukan pemilihan scanner/isolasi yang tepat, kebijakan konten/privasi produksi dan retensi/penghapusan yang disetujui, pengujian Supabase/Auth/Storage sesuai cakupan rilis, abuse control deployment, admin MFA, backup/restore dan gate rilis lain pada dokumentasi keamanan. Kebijakan development tidak memberi kewenangan admin baru dan tidak menetapkan masa retensi. Implementasi berikutnya mengikuti roadmap revisi persetujuan internal; Phase 4 review administratif dan Phase 5 lama tidak otomatis diaktifkan.
