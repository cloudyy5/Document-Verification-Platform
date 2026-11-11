# R4 — monitoring admin baca-saja

**Addendum source 0.8.1:** [workspace admin eksklusif dan login sesuai role](admin-workspace-report.md) mengikuti permintaan S-15. Login biasa memilih dashboard, admin tidak lagi berpindah ke User Workspace, dan pengaturan akun sendiri tetap memakai shell admin. Tidak memerlukan migration tambahan; checkpoint 0.8.0 berikut tetap menjadi riwayat implementasi monitoring.

Checkpoint **11 November 2026**, Asia/Makassar, source **v0.8.0**. **S-11 sudah disetujui dan integrasi source/lokal selesai:** halaman, API, RPC serta migration 012 tersedia; pengujian unit, SQL native, build dan browser lokal lulus. **Operator melaporkan migration 012 berhasil dipasang; [preflight API R4](r4-activation-check.md) lulus 49 pemeriksaan, exit code 0.** Perjalanan sesi admin cloud dan pembacaan agregat sebagai admin belum dibuktikan. R5 belum dimulai.

## Keputusan dan hasil source

Pengguna menyetujui ketiga pilihan: **“Setujui batas akses tersebut”**, **“Setujui aktivitas dokumen”**, dan **“Setujui indikator hasil PDF”**. [Kontrak R4](r4-implementation-contract.md) serta [register keputusan](decision-register.md) menjadi acuan; laporan persiapan sebelumnya dipertahankan sebagai checkpoint historis.

- `/admin/overview` menampilkan enam indikator dari snapshot database: akun terdaftar, aktivitas dokumen 30 hari, dokumen diunggah, dokumen selesai, permintaan pending yang belum kedaluwarsa, dan hasil PDF perlu perhatian.
- `/admin/operations` menampilkan metadata maksimal 20 hasil terbaru dengan total sebenarnya. Hanya reference proses yang disamarkan, status, kategori kegagalan yang aman, waktu dan jumlah percobaan; tanpa identitas peserta, judul/isi PDF atau tautan membuka dokumen.
- `GET /api/v2/operations/metrics` menggunakan client cookie pengguna dan RPC **tanpa argumen** `get_operations_snapshot()`. Tidak menerima actor, role, owner, query SQL atau jendela waktu dari browser; tidak menggunakan service key untuk membaca statistik.
- Server dan database memerlukan role authoritative `platform_admin` dan email terverifikasi. Database menolak akun yang sedang diblokir/soft-deleted serta memeriksa ulang role saat membaca. Reviewer saja diarahkan ke arsip, bukan monitoring. Role campuran memperoleh hak masing-masing yang sebelumnya sah; tidak ada role baru diberikan otomatis.
- UI memakai silver/white, graphite pada shell, CTA/style yang sudah tersedia dan Light/Dark. Keadaan error menampilkan **Belum tersedia**, tidak menjadi nol. Nol hanya berasal dari query yang berhasil. Timestamp, jendela waktu dan lingkungan development ditampilkan; tidak ada grafik/tren rekaan.

Aktif 30 hari adalah `COUNT DISTINCT actor_id` dari event transaksi signing `draft_created`, `request_sent`, `approved`, `rejected`, dalam 720 jam terakhir sampai waktu database. Ini bukan statistik login, polling atau refresh token. Akun terdaftar menghitung baris Auth yang masih tercatat, seluruh role dan status; termasuk unverified/nonaktif/soft-deleted yang masih mempunyai record, terpisah dari hak akses dashboard.

Dokumen logis, versi sumber dan arsip administratif dipisahkan. Completed mensyaratkan persetujuan committed dan artefak ready. Hasil consented/processing belum selesai. Hasil gagal atau processing dengan lease hilang/kedaluwarsa menjadi perlu perhatian; proses retry aktif dan hasil ready dibedakan, tanpa melabeli seluruh error platform sebagai kegagalan permanen.

## File dan folder

| Kelompok           | File utama                                                                                                                                                                                                       |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Schema             | [012_operations_monitoring.sql](../../supabase/migrations/202611110012_operations_monitoring.sql): indeks aktivitas/pending/perhatian serta RPC read-only yang tidak mengubah RLS/grant tabel peserta            |
| DAL/API            | `src/server/operations/queries.ts`, `page-data.ts`, `src/app/api/v2/operations/metrics/route.ts`                                                                                                                 |
| Halaman            | `src/app/(admin)/admin/overview/page.tsx`, `admin/operations/page.tsx`, redirect admin root                                                                                                                      |
| Presentasi         | `src/features/operations/overview.tsx`, `refresh-button.tsx`, schema/tipe pada `src/lib/operations/schema.ts`                                                                                                    |
| Identitas/navigasi | `src/lib/auth/session.ts`, `redirects.ts`, sidebar role-aware; caption ringkasan arsip diperbarui agar tidak lagi menyatakan QR belum aktif                                                                      |
| Types              | `src/types/database.ts`, diregenerasi dari schema 001–012 PostgreSQL terisolasi                                                                                                                                  |
| Operator           | [check_operations.sql](../../supabase/operators/check_operations.sql), [setup admin awal via SQL Editor](../../supabase/operators/grant-platform-admin-dashboard.sql); `scripts/check-supabase.mjs --operations` |
| Tes                | `tests/database/operations.test.ts`, `tests/unit/operations-http.test.ts`, schema DTO, guard/redirect auth, guest E2E serta enam tes UI komponen                                                                 |
| Tooling            | Script `test:ui:operations`, harness Vite/Playwright terpisah, versi package/lock 0.8.0; tidak menambah dependency                                                                                               |
| Dokumen            | Kontrak/laporan R4, register S-11, README/roadmap dan screenshot berlabel sintetis                                                                                                                               |

Migration 001–011, dokumen/aset asli dan seluruh fixture/proof R1/R2/R3/R3b dipertahankan. Tidak ada Auth user, role, audit grant, dokumen atau object cloud baru dibuat dalam integrasi R4 ini.

## Teknologi

Tidak ada upgrade dependency. Next.js **16.4.3**, React **19.3.1**, TypeScript **6.0.3** strict, Tailwind **4.3.3**, Supabase JS **2.118.0**/SSR **0.12.7**, Vitest **4.1.12**, Playwright **1.64.1** dan Vite **8.3.5** untuk harness lokal. Database native pengujian **PostgreSQL 17.9**; itu bukan klaim versi server Supabase cloud. Gunakan Node **24 LTS**; lingkungan verifikasi memakai Node 25.9.0.

## Hasil pengujian

| Pemeriksaan            | Hasil dan batas bukti                                                                                                                                                                                                                                |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit                   | **805 lulus / 34 file**; provider pada unit DAL/HTTP berupa mock. Memeriksa 401/403, email, role/metadata palsu, revokasi, no-store/Vary Cookie, query injection, output sensitif/invalid, timeout dan error tidak menjadi nol                       |
| SQL native             | **365 lulus / 11 file**, termasuk 25 tes monitoring/operator: anon/user/reviewer/service ditolak, mixed role, revokasi, provider ban/delete, agregasi/deduplikasi, window, expiry, retry/finalisasi, limit 20, privasi dan setup operator idempotent |
| Browser production     | **43 lulus + 5 skip / 48**, desktop/tablet/mobile. Mencakup guest pada halaman/API monitoring. Tiga smoke sesi cloud tidak diaktifkan, dua tes drawer tidak berlaku pada viewport besar                                                              |
| Browser komponen       | **6 lulus**: tiga viewport, Light/Dark, sumber unavailable dan aktivitas null. Harness berlabel sintetis, tanpa Auth atau koneksi database; tidak membuktikan sesi admin cloud                                                                       |
| ESLint/typecheck/build | Lulus; build final source **0.8.0**, termasuk halaman/API baru                                                                                                                                                                                       |
| Preflight cloud        | **49 lulus, exit code 0** setelah operator memasang 012; RPC monitoring menolak service/null actor 403/42501 serta anon 401/42501. Tidak mengambil statistik global atau menguji sesi admin                                                          |

Perbaikan selama verifikasi menyangkut tipe UUID pada fixture versi dan bentuk dataset role pada tes; tidak mengurangi guard atau membuka permission agar tes lulus. Query read-only dibuktikan tidak mengubah job/expiry/history. Setup admin SQL Editor diperiksa untuk placeholder, operator/target yang tidak ada, caller API yang ditolak serta audit tunggal saat grant diulang.

Contoh visual berikut memakai **data sintetis yang ditandai**, bukan statistik Supabase:

- [Desktop Light](../screenshots/r4/desktop-light.png), [desktop Dark](../screenshots/r4/desktop-dark.png), [tablet](../screenshots/r4/tablet-light.png), dan [mobile Dark](../screenshots/r4/mobile-dark.png).
- [Pemeriksaan build/preservasi](../screenshots/r4/build-check.json) mencatat pemindaian secret browser dan checksum proof, tanpa menyimpan nilainya.

## Menjalankan lokal

```powershell
cd D:\Website
npm ci
npm run dev
```

Buka `http://127.0.0.1:3000`, login dengan akun terverifikasi yang mempunyai role `platform_admin`, lalu pilih **Monitoring platform** atau **Pemantauan hasil PDF**. Akun user/reviewer biasa tidak otomatis menjadi admin. Ketika schema/sumber tidak tersedia, admin melihat sumber unavailable, bukan statistik nol. Tidak ada environment variable baru; konfigurasi Supabase/Auth yang sudah ada tetap digunakan.

```powershell
npm run lint
npm run typecheck
npm test
npm run test:db
npm run test:ui:operations
npm run build
npm run test:e2e
npm run format:check
```

## Langkah operator berikutnya

**Pada project development saat ini, 012 sudah dilaporkan berhasil dipasang dan preflight 49 lulus. Jangan mengulang migration 001–012.** Berikut adalah prosedur instalasi yang dipertahankan sebagai referensi project baru; API key aplikasi tidak memiliki kewenangan DDL:

1. **SQL Editor → New query (+)**, role **postgres**.
2. Salin seluruh isi [migration 012](../../supabase/migrations/202611110012_operations_monitoring.sql), lalu **Run sekali**. Jangan mengulang 001–011 atau reset database. Hasil yang diharapkan **“Success. No rows returned”**, tanpa error.
3. Opsional, jalankan [presence check read-only](../../supabase/operators/check_operations.sql): RPC terisi, authenticated true, anon false dan stable/security-definer true.
4. Setelah operator mengonfirmasi pemasangan, jalankan:

```powershell
npm run supabase:check -- --workspace --signing --signing-r3 --qr-placement --operations
```

Hasil aktual **49 pemeriksaan lulus** (47 baseline + 2 R4), exit code 0. Probe R4 menggunakan actor kosong/service dan anon, ditolak sebelum mengambil statistik. [Catatan aktivasi](r4-activation-check.md) menjelaskan hasil dan batas buktinya; pembacaan statistik/sesi admin belum termasuk. Restart dev server yang masih memakai source sebelumnya.

Jika belum ada admin, setup awal opsional tersedia pada [grant-platform-admin-dashboard.sql](../../supabase/operators/grant-platform-admin-dashboard.sql). **Bukan migration dan tidak dijalankan otomatis.** Daftarkan/verifikasi akun normal, ambil UUID akun dari Authentication → Users, lalu isi `PASTE_TARGET_USER_UUID` dan `PASTE_OPERATOR_USER_UUID` dengan UUID yang benar. Operator UUID harus merupakan identitas orang yang menjalankan konfigurasi. Bootstrap awal boleh menunjuk akun sendiri sebagai target dan operator. Tinjau target/aktor sebelum menjalankan dengan role postgres; skrip menghasilkan audit dan tidak mengubah grant yang sudah ada saat diulang. Jangan menjalankan berkas psql `grant-role.sql` yang berisi `\set` langsung di SQL Editor.

Penerimaan sesi admin cloud perlu membuktikan statistik nyata, navigasi setelah login, penolakan reviewer/user dan no-store/error. [Langkah uji baca-saja](r4-cloud-acceptance-plan.md) tersedia untuk akun yang dipilih/disiapkan operator. Belum ada fixture atau elevasi role cloud baru yang dibuat dalam pemeriksaan ini; pengguna menyatakan belum memiliki role admin dan meminta panduan menjadikan akun sendiri admin. Rencana ini tidak meminta pembuatan PDF atau pengulangan fixture signing. Tidak ada akses baru ke PDF bagi admin.

## Batas dan pekerjaan berikutnya

Dashboard adalah pemantauan baca-saja. Tidak ada retry admin, user management, impersonation, pencarian pengguna/dokumen global, akses support ke isi PDF, ekspor audit pribadi, auto-purge atau layanan berbayar. Riwayat login lengkap tidak direkonstruksi; indikator aktif sengaja memakai aktivitas dokumen yang disetujui. Kegagalan daftar hanya hasil PDF saat ini, bukan semua error login/upload. Tidak ada auto-refresh/polling atau cache snapshot lintas pengguna.

Source R4 siap untuk aktivasi dan peninjauan development setelah migration serta penerimaan cloud yang relevan. R5 hardening, kebijakan scanner/retensi/produksi dan klaim TTE tersertifikasi tidak diaktifkan oleh build atau laporan ini.
