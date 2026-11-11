# Database dan akses — Phase 1

Schema ditargetkan ke PostgreSQL 17 melalui Supabase. Tidak ada kredensial cloud atau sesi pengguna yang dipasang oleh pekerjaan ini. UI tetap menampilkan status belum terhubung.

## Migration dan schema

Terapkan seluruh urutan migration pada project development kosong, bukan hanya dua draft pertama:

1. `202611010001_initial_schema.sql`: tabel, role enums, trigger profil, RLS awal, private bucket, kategori.
2. `202611010002_workflow_rpcs.sql`: workflow RPC privileged dan immutable audit/review.
3. `202611010003_access_control_foundation.sql`: reset ACL, pembatasan owner/reviewer, constraints, private-storage restrictions.
4. `202611010004_owner_approved_configuration.sql`: persetujuan pengguna untuk antrean reviewer bersama dan sembilan kategori aktif.
5. `202611010005_future_object_privileges.sql`: objek baru memerlukan grant eksplisit.

File 001/002 dan paket dokumentasi/aset asli tetap byte-identik. Seluruh perbaikan dibuat pada migration tambahan. Migration 003 belum pernah diterapkan ke lingkungan bersama; pengujian menggunakan cluster sementara baru.

Tabel aplikasi: `profiles`, `user_roles`, `document_categories`, `documents`, `document_submissions`, `review_decisions`, `verification_credentials`, `notifications`, `audit_logs`, `verification_events`. Seluruh tabel public aplikasi memiliki RLS. `private.access_control_settings` menyimpan gate review dan tidak diberikan kepada role API. Schema private tidak diekspos konfigurasi Data API.

## Matriks akses efektif

| Data/operasi                    | Anon    | Pengguna                                   | Reviewer                                        | Admin tanpa reviewer        | Service/operator                                  |
| ------------------------------- | ------- | ------------------------------------------ | ----------------------------------------------- | --------------------------- | ------------------------------------------------- |
| Dokumen/submission sendiri      | Ditolak | Baca milik sendiri                         | Baca milik sendiri                              | Baca milik sendiri          | Server wajib memeriksa izin                       |
| Antrean akun lain               | Ditolak | Ditolak                                    | Baca current pending sesuai gate yang disetujui | Ditolak                     | Server terotorisasi                               |
| Versi historis akun lain        | Ditolak | Ditolak                                    | Ditolak                                         | Ditolak                     | Server terotorisasi                               |
| Riwayat keputusan               | Ditolak | Keputusan untuk dokumen sendiri            | Tambahan keputusan yang dibuatnya sendiri       | Dokumen sendiri             | Server terotorisasi                               |
| Profil dan daftar role          | Ditolak | Milik sendiri                              | Milik sendiri                                   | Milik sendiri               | Pemeriksaan server/operator                       |
| Edit profil                     | Ditolak | Hanya nama/telepon/avatar milik sendiri    | Sama                                            | Sama                        | Operator/server                                   |
| Notifikasi                      | Ditolak | Baca sendiri; hanya `read_at` dapat diubah | Sama                                            | Sama                        | Server                                            |
| State dokumen/review/credential | Ditolak | Tidak bisa menulis langsung                | Tidak bisa menulis langsung                     | Tidak bisa menulis langsung | RPC server-only dengan validasi                   |
| Credential digest dan audit     | Ditolak | Ditolak                                    | Ditolak                                         | Ditolak                     | Server-only                                       |
| File PDF via Storage langsung   | Ditolak | Ditolak                                    | Ditolak                                         | Ditolak                     | Endpoint server terotorisasi pada fase berikutnya |
| Grant role privileged           | Ditolak | Ditolak                                    | Ditolak                                         | Ditolak melalui API         | SQL operator tepercaya + audit                    |

Reviewer tetap memegang role normal `user` untuk dokumen miliknya. `platform_admin` tidak mengimplikasikan `reviewer`. Akses role admin lintas akun dinonaktifkan karena user management R-16 belum disetujui.

Tidak ada API role mendapat `TRUNCATE`. Grant tabel lama dibersihkan sebelum grant kolom dipasang; RLS sendiri tidak membatasi kolom dan tidak melindungi `TRUNCATE`. Default privilege objek baru ditutup untuk role pembuat migration. Default global EXECUTE function ke PUBLIC juga dicabut, karena revoke per-schema saja tidak dapat mengurangi default global. Role pembuat lain harus dikelola terpisah; migration tidak mengubah default milik role sistem Auth/Storage. [PostgreSQL default privileges](https://www.postgresql.org/docs/17/sql-alterdefaultprivileges.html), [Supabase column security](https://supabase.com/docs/guides/database/postgres/column-level-security).

## Integritas data

- Profil dan role normal dibuat dari trigger `auth.users`; input metadata tidak dapat memberikan role reviewer/admin.
- Identitas owner submission harus sesuai owner dokumen melalui composite FK.
- Dokumen harus menunjuk versi submission yang ada; FK deferred mendukung transaksi insert dokumen + versi pertama.
- Path file harus owner-scoped, bucket tetap `document-submissions`, tanpa segmen traversal.
- Checklist wajib tepat empat nilai boolean; key hilang, JSON null, atau key tambahan ditolak.
- Approval mengharuskan seluruh checklist lulus; revision/reject membutuhkan kegagalan dan catatan.
- Metadata/file-version, review decision, dan audit dilindungi dari update/delete biasa. Service role juga dibatasi ACL; operator berhak superuser tetap secara teknis dapat mengubah schema/menonaktifkan trigger.
- Credential hanya dapat dibuat setelah dokumen dan current submission berstatus approved. Digest tetap server-only; tidak ada QR/kode pengguna diterbitkan oleh UI Phase 1.
- Perubahan review memakai RPC service-only dan transaksi, dengan lock/status check. Helper internal tidak dapat dipanggil role API.
- Bucket privat dan kebijakan restrictive mencegah policy Storage permissive lain membuka file dokumen. File belum disajikan melalui endpoint aplikasi.

## Pengujian lokal tanpa Docker

```powershell
npm ci
$env:PG_BIN = 'C:\Program Files\PostgreSQL\17\bin'
npm run test:db
```

`PG_BIN` opsional untuk instalasi Windows default. Pada Linux/macOS, arahkan ke direktori native yang berisi `postgres`, `initdb`, `pg_ctl`, dan `psql`. Jalankan sebagai pengguna biasa; `initdb` menolak root pada Unix.

Runner membuat cluster di `.postgres-test/<UUID>` dengan port loopback acak dan password acak di memori. Password initdb diberikan lewat named pipe Windows atau stdin Unix. Tidak memakai `DATABASE_URL`, `PGHOST`, kredensial Supabase, atau service PostgreSQL yang sudah berjalan. Cluster dihentikan dan dihapus di `finally`, dengan verifikasi UUID, marker, dan realpath. Jika proses dihentikan paksa, gunakan perintah aman yang ditampilkan runner:

```powershell
node scripts/test-database.mjs --cleanup-run <UUID-yang-dicetak-runner>
```

Pembersihan hanya menerima UUID direktori task dengan marker kepemilikan yang cocok; tidak melakukan pencarian atau penghapusan database lain.

`tests/database/bootstrap.sql` adalah fixture metadata khusus cluster kosong, bukan migration aplikasi. Ia membuat role dan schema minimum Auth/Storage, termasuk default grants yang sengaja permisif agar hardening benar-benar diuji. PostgreSQL menjalankan RLS, FK, constraints, trigger, role switching, dan SQL asli. Tes tidak memverifikasi JWT signature, GoTrue, PostgREST, atau Storage HTTP. Pengujian role SQL mengikuti [panduan Supabase](https://supabase.com/docs/guides/database/postgres/testing-row-level-security).

## Tipe schema

```powershell
npm run db:types
```

Perintah ini membuat cluster terisolasi baru, menerapkan migration/seed, membaca katalog schema, dan menulis `src/types/database.ts`. Generator menolak tipe PostgreSQL yang belum memiliki mapping eksplisit; tidak memakai `any` sebagai fallback. File menyertakan tabel, kolom, enums, relasi, dan signature RPC. Factory browser/server/privileged memakai `Database` generic. Pengujian drift membandingkan hasil generator dengan file source. Tipe bukan pengganti otorisasi database.

## Supabase development lengkap

CLI proyek tersedia melalui `npx supabase`. Untuk menjalankan seluruh stack diperlukan Docker atau container runtime kompatibel. Setelah runtime disediakan:

```powershell
npm run supabase:start
npm run supabase:status
```

Perintah ini belum dijalankan di komputer saat pengerjaan Phase 1. Jangan menganggap test native sebagai bukti seluruh layanan Supabase sudah terhubung. Gunakan development project terpisah, terapkan kelima migration sebelum menghubungkan pengguna, dan ulangi pengujian layanan/Storage/Auth pada stack tersebut. `supabase/config.toml` menutup auto-exposure objek baru, memakai PostgreSQL 17, menyediakan seed yang disetujui, serta menonaktifkan sign-up sampai Phase 2. Batas ukuran PDF produk belum diputuskan dan tidak diambil dari default ceiling provider.

Jika development project sebelumnya sudah berisi data, tinjau constraint tambahan dan lakukan backup sebelum menerapkan migration; jangan menjalankan reset/push pada production sebagai bagian dari setup ini. Seluruh aksi yang dieksekusi selama pekerjaan hanya mengenai cluster task sementara.

## Operator role

Gunakan `supabase/operators/grant-role.sql` hanya melalui koneksi SQL `postgres` atau `supabase_admin` yang dikendalikan operator tepercaya. Siapkan koneksi libpq service atau prompt password lokal; jangan menaruh password dalam source/argv. Tiga input: `target_user_id`, `granted_role` (`reviewer`/`platform_admin`), dan `operator_user_id` (akun operator yang benar-benar melakukan tindakan).

```powershell
psql 'service=dvp-development' -v target_user_id=UUID_TARGET -v granted_role=reviewer -v operator_user_id=UUID_OPERATOR -f supabase/operators/grant-role.sql
```

Target dan operator harus akun Auth yang sudah ada. Privilege koneksi SQL mengotorisasi tindakan; UUID operator hanya atribusi audit yang harus diisi dengan benar, bukan bukti sesi web. Grant dan audit disimpan atomik. Pengulangan grant tidak mengubah `granted_by` atau membuat audit duplikat. Tes menjalankan psql nyata untuk kasus berhasil, input salah, role API ditolak, dan transaksi gagal. Tidak ada endpoint atau UI pengelolaan role.

Phase 2 nantinya harus memverifikasi sesi di server, mengambil identitas dari sesi tersebut, serta memeriksa role/owner sebelum pemanggilan privileged. Tidak ada caller UI privileged di Phase 1.
