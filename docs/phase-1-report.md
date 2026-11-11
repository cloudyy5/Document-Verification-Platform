# Laporan Phase 1 — Database and Access Control

Penyelesaian: **3 November 2026**, Asia/Makassar. Versi proyek **0.2.0**. Ruang lingkup tetap Phase 1; Phase 2 belum dikerjakan dan tidak ada deployment.

## 1. File dan folder

File baru:

- `supabase/config.toml`: konfigurasi development PostgreSQL 17 dan Supabase CLI; auto-exposure objek baru serta sign-up dinonaktifkan.
- `supabase/migrations/202611010003_access_control_foundation.sql`: hardening grant, RLS, constraints, scope reviewer, private Storage, dan credential guard.
- `supabase/migrations/202611010004_owner_approved_configuration.sql`: mengaktifkan antrean bersama reviewer dan sembilan kategori sesuai persetujuan pengguna.
- `supabase/migrations/202611010005_future_object_privileges.sql`: menutup default privilege objek berikutnya, sehingga migration baru harus memberi grant eksplisit.
- `supabase/seed.sql`: kategori yang disetujui, idempotent, tanpa akun atau dokumen contoh.
- `supabase/operators/grant-role.sql`: prosedur operator tepercaya dengan validasi input, transaksi, dan audit.
- `scripts/test-database.mjs`: PostgreSQL uji terisolasi dan pembersihan cluster task.
- `scripts/database-types.mjs`, `scripts/database-types.d.mts`: generator tipe dari metadata PostgreSQL.
- `src/types/database.ts`: schema bertipe untuk ketiga client Supabase.
- `vitest.database.config.ts` dan `tests/database/`: bootstrap metadata khusus tes, test RLS/access control, default grants, operator psql, dan drift tipe schema.
- `docs/database-access-control.md`: panduan migration, matriks akses, setup, serta batas validasi.
- Laporan ini.

File diperbarui: tiga factory di `src/lib/supabase/`, `package.json`, `package-lock.json`, `.gitignore`, `.prettierignore`, `eslint.config.mjs`, `.github/workflows/ci.yml`, `README.md`, dan `docs/decision-notes.md`.

Seluruh **41 file asli**, termasuk dokumentasi, gambar, dan SQL 001/002, tetap byte-identik. Perubahan dilakukan melalui migration tambahan. Tampilan yang disetujui pada Phase 0 dipertahankan.

## 2. Teknologi dan versi

Tambahan Phase 1:

| Teknologi                         | Versi   |
| --------------------------------- | ------- |
| PostgreSQL native untuk pengujian | 17.9    |
| Driver `pg`                       | 8.23.1  |
| `@types/pg`                       | 8.23.1  |
| Supabase CLI lokal proyek         | 2.122.0 |

Stack aplikasi tetap Next.js 16.4.3, React 19.3.1, TypeScript 6.0.3 strict, Tailwind CSS 4.3.3, Supabase JS 2.118.0 / SSR 0.12.7, Vitest 4.1.12, Playwright 1.64.1, ESLint 10.14.0, dan Prettier 3.9.10. Pemeriksaan lokal memakai Node 25.9.0 / npm 11.12.1; Node 24 LTS tetap direkomendasikan.

## 3. Hasil implementasi

- Schema profil, role, dokumen, versi submission, review, credential, notifikasi, audit, dan verification events tersedia melalui migration.
- Trigger akun baru memberikan role `user` saja; metadata browser tidak dapat memberi role privileged.
- Semua tabel public aplikasi memakai RLS. Pengguna hanya membaca data miliknya; role tidak dapat dinaikkan melalui client.
- Reviewer memperoleh antrean bersama yang telah disetujui, terbatas ke dokumen pending dan submission versi current. Dokumen historis akun lain tidak terbuka melalui queue.
- `platform_admin` tanpa reviewer tidak menerima akses dokumen orang lain. Daftar role melalui client juga dibatasi ke akun sendiri, karena user management belum disetujui.
- Grant tabel lama dibersihkan sebelum grant kolom minimum. Pengguna hanya dapat mengubah field profil yang diizinkan dan `notifications.read_at` miliknya.
- API roles tidak menerima `TRUNCATE`. Service role hanya membaca `user_roles`; perubahan role memerlukan operator SQL tepercaya dan audit.
- Private bucket `document-submissions` serta restrictive Storage policies mencegah policy permissive lain membuka dokumen.
- Checklist harus tepat empat boolean; metadata submission, review decision, dan audit dilindungi. Composite owner FK dan deferred current-version FK menjaga konsistensi data.
- Credential ditolak sebelum dokumen/current submission approved. RPC workflow tetap server-only; tidak ada QR/kode pengguna, API bisnis, atau operasi dokumen yang diaktifkan di UI.
- Tipe Database dihasilkan dari cluster yang telah dimigrasi, dipakai ketiga factory Supabase, dan diuji agar tidak tertinggal dari schema.
- Runner database membuat cluster baru dengan port loopback/password acak, menerapkan lima migration dan seed, menguji SQL nyata, lalu membersihkannya. Database/service PostgreSQL yang sudah ada tidak digunakan atau diubah.

## 4. Perintah

Menjalankan website:

```powershell
cd D:\Website
npm ci
npm run dev
```

Buka `http://127.0.0.1:3000`. Tampilan tetap jujur menyebut backend belum terhubung. Tidak perlu kredensial untuk melihat shell.

Menguji database tanpa Docker:

```powershell
$env:PG_BIN = 'C:\Program Files\PostgreSQL\17\bin'
npm run test:db
```

Lokasi PostgreSQL Windows default dideteksi otomatis; `PG_BIN` diperlukan jika binary ada di tempat lain. Untuk memperbarui tipe setelah perubahan schema: `npm run db:types`. Perintah ini selalu memakai cluster sementara baru dan tidak menerima URL database eksternal.

Konfigurasi Supabase development lengkap tersedia melalui `npm run supabase:start`, setelah container runtime kompatibel disediakan. Stack tersebut belum dijalankan saat pekerjaan ini.

## 5. Hasil pengujian

| Pemeriksaan            | Hasil                                                                     |
| ---------------------- | ------------------------------------------------------------------------- |
| `npm run lint`         | Lulus, tanpa warning/error                                                |
| `npm run typecheck`    | Lulus                                                                     |
| `npm test`             | 30 test lulus, 2 file                                                     |
| `npm run test:db`      | 183 test lulus, 4 file                                                    |
| `npm run db:types`     | Tipe berhasil dihasilkan dari schema yang dimigrasi                       |
| `npm run build`        | Lulus, seluruh route fondasi dibangun                                     |
| `npm run test:e2e`     | 13 lulus; 2 drawer test dilewati karena tidak relevan pada desktop/tablet |
| `npm run format:check` | Lulus                                                                     |
| Preservasi sumber      | 41 hash asli cocok; kedua SQL asli dan token mirror tetap identik         |
| Bundle browser         | Tidak ditemukan marker secret/privileged client                           |
| Audit runtime          | 0 vulnerabilities                                                         |
| Audit semua dependency | 12 moderate pada toolchain development; 0 high/critical                   |

Test database menjalankan query dan penolakan SQL nyata di PostgreSQL 17.9: owner A/B, anon/authenticated CRUD/TRUNCATE, metadata role spoofing, kolom profil/notifikasi, reviewer scope ON/OFF, admin tanpa reviewer, service-only RPC, approval/rollback, private bucket, immutability, constraint checklist/credential, role operator beserta audit/idempotensi, serta privilege objek masa depan. Regresi terakhir memeriksa service role tidak dapat INSERT, UPDATE, atau DELETE role.

Playwright kembali memeriksa tema, persistensi preferensi, navigasi, modal/fokus, notifikasi, drawer mobile, ketiadaan overflow, serta tidak adanya request API dokumen dari shell. Workflow CI diperbarui untuk memasang PostgreSQL 17 pada Ubuntu 24.04 dan menjalankan suite database; workflow remote belum dijalankan.

## 6. Masalah dan batas validasi

- Draft SQL memberi grant sempit tanpa mencabut grant bawaan Supabase yang lebih luas. Migration 003 kini membersihkan ACL sebelum memberikan hak minimum, termasuk menutup `TRUNCATE` yang tidak dilindungi RLS.
- Draft CHECK checklist dapat menerima key hilang karena SQL `NULL` dianggap lolos. Constraint baru menolak checklist tidak lengkap, JSON null, serta key tambahan.
- Hak reviewer pada draft terlalu luas. Akses kini mengikuti antrean current pending dan keputusan reviewer sendiri, dengan gate yang diaktifkan sesuai persetujuan R-05.
- Role inspection admin dan mutation role melalui service tidak diperlukan untuk scope yang disetujui; keduanya dipersempit. Prosedur operator yang disediakan mencatat grant dan audit secara atomik.
- Pada percobaan awal Windows, proses server turunan menahan pipe milik `pg_ctl`. Runner diperbaiki; cluster percobaan telah dibersihkan dan pengujian berikutnya berhasil. Tidak ada cluster task tersisa setelah validasi.
- Docker/container runtime dan `.env.local` Supabase belum tersedia. Pengujian memakai metadata fixture Auth/Storage pada PostgreSQL native. Ini memverifikasi schema, ACL, RLS, trigger, constraint, dan transaksi PostgreSQL, **bukan** validasi JWT GoTrue, PostgREST, atau Storage HTTP. Fixture tidak boleh dijalankan pada project Supabase.
- Audit masih melaporkan 12 temuan moderate pada dependency development lint yang berakar pada advisory minimatch. Audit runtime bersih. Tidak diterapkan downgrade paksa atau override lintas major.

Tidak ada migration yang diterapkan ke project cloud, staging, production, atau cluster PostgreSQL pengguna yang sudah berjalan. Tidak ada deployment, data pribadi, statistik palsu, maupun public verification yang dibuat.

## 7. Konfigurasi berikutnya

Untuk integrasi layanan, sediakan project Supabase development atau container runtime lokal, lalu isi URL project, publishable key, dan server secret melalui `.env.local` secara lokal. Jangan mengirim secret ke chat. Terapkan seluruh urutan migration pada development dan ulangi validasi layanan sebelum menghubungkan data pengguna.

Keputusan **R-05** dan **R-13** sudah diterapkan sesuai persetujuan: antrean reviewer bersama serta kategori Pendidikan, Pekerjaan, Organisasi, Administrasi, Keuangan, Kesehatan, Hukum, Pribadi, dan Lainnya aktif. Kebijakan lain tetap mengikuti register; ukuran/encrypted PDF, email verification, reviewer download, revocation, retensi, dan perluasan admin tidak diputuskan secara diam-diam.

Phase 2 nantinya menambahkan login/registrasi/logout, sesi terverifikasi, refresh proxy, dan proteksi route server. Server harus mengambil owner/reviewer ID dari sesi yang diverifikasi sebelum memakai privileged client. Pekerjaan saat ini berhenti pada **Phase 1**.

Panduan rinci: [database-access-control.md](database-access-control.md). Referensi: [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [pengujian RLS](https://supabase.com/docs/guides/database/postgres/testing-row-level-security), [column security](https://supabase.com/docs/guides/database/postgres/column-level-security), [default privileges PostgreSQL](https://www.postgresql.org/docs/17/sql-alterdefaultprivileges.html).
