# R4 — kontrak monitoring admin

**Addendum S-15, source 0.8.1:** role `platform_admin` menggunakan Admin Workspace saja, termasuk pada akun dengan role gabungan. Login biasa menuju dashboard admin; hint/URL pengguna dan API aplikasi dibatasi. Profil/preferensi akun sendiri tetap tersedia dalam shell admin. [Laporan S-15](admin-workspace-report.md) menjelaskan scope aplikasi dan bukti pengujian tanpa migration atau perubahan grant/RLS baru.

Disusun **11 November 2026**, Asia/Makassar. **Ketiga keputusan S-11 disetujui pengguna:** batas akses, aktivitas dokumen 30 hari dan indikator hasil PDF. Source **v0.8.0** menyediakan integrasi halaman/API dan migration 012; pengujian lokal lulus. **Migration 012 dilaporkan berhasil dipasang dan [preflight API](r4-activation-check.md) lulus 49 pemeriksaan; penerimaan sesi admin cloud belum dijalankan.** [Laporan R4](r4-report.md) memisahkan kesiapan source, aktivasi dan penerimaan cloud. R3b serta fixture historis tetap dipertahankan.

## Cakupan yang sudah tersedia dari arahan produk

Monitoring menggunakan angka database nyata, sumber/jendela waktu jelas dan lingkungan development diberi label. Tidak ada fallback error menjadi nol, grafik/tren rekaan, preview PDF global, tindakan approve/reject admin, impersonation, penghapusan/penangguhan akun, role assignment, retry hasil milik peserta lain atau ekspor data pribadi. Riwayat serta permission legacy tidak diubah diam-diam. Aset visual dan seluruh migration lama dipertahankan.

## S-11 yang telah disetujui

1. Dashboard baca-saja khusus `platform_admin`, dengan identitas terverifikasi dari provider dan role authoritative database. Reviewer saja tidak mendapat statistik global. Server dan database sama-sama memeriksa izin; metadata pendaftaran/header tidak menjadi role.
2. Indikator aktif diberi label **Aktif beraktivitas dokumen (30 hari)**, dihitung dari akun unik dengan upload draft, pengiriman undangan atau keputusan berhasil pada model signing dalam 720 jam terakhir. Sumber adalah audit transaksi yang sudah ada; bukan login, polling atau refresh token. Pengguna memilih basis aktivitas dokumen, sehingga snapshot aktif memakai `activeBasis=document-events`.
3. Indikator **Hasil PDF perlu perhatian** merupakan hasil yang saat ini gagal atau prosesnya melewati batas waktu, satu per receipt dan dikeluarkan setelah retry berhasil. Bukan jumlah seluruh error login/upload atau klaim gagal permanen. Daftar hanya reference teknis yang disamarkan, status, kategori kegagalan yang aman, waktu dan jumlah percobaan; tanpa judul, pengguna, receipt ID, source hash/path atau tautan isi PDF.

## Kontrak data yang diimplementasikan

Enam kartu utama: akun terdaftar, aktivitas dokumen 30 hari/belum tersedia, dokumen signing yang sudah mempunyai sumber committed, dokumen completed dengan hasil ready, undangan pending yang belum kedaluwarsa, serta hasil perlu perhatian. Versi sumber, persetujuan menunggu hasil dan jumlah arsip administratif merupakan konteks terpisah; `approved` legacy tidak menjadi `completed` signing. Akun terdaftar dihitung dari baris Auth yang masih tercatat, bukan jumlah profil atau sesi; mencakup semua role dan akun development.

Snapshot memakai satu waktu database dan satu transaksi baca. UI menerima DTO yang tervalidasi ketat; field sensitif yang tidak diharapkan membuat sumber dinyatakan tidak tersedia. Error menampilkan status/error dan tindakan muat ulang, tanpa mengarang angka. Daftar detail dibatasi 20 hasil terbaru dengan total serta penanda jika masih ada hasil lain.

`/admin/overview` merupakan ringkasan, `/admin/operations` pemantauan hasil, dan `GET /api/v2/operations/metrics` snapshot privat. API tidak menerima actor, role, schema, SQL, owner atau periode buatan pengguna. Guard server memerlukan `platform_admin` dan email terverifikasi. Hanya kegagalan sumber menjadi tampilan unavailable; penolakan izin tidak berubah menjadi snapshot kosong.

`public.get_operations_snapshot()` merupakan RPC tanpa argumen, `STABLE SECURITY DEFINER`, search path kosong dan timezone UTC. Actor berasal dari JWT `auth.uid()`/`auth.role()`, bukan parameter browser. Fungsi memeriksa ulang email, status akun provider dan role pada `user_roles`. `authenticated` boleh memanggil tetapi hanya admin yang lolos; `service_role` hanya diberi EXECUTE untuk probe actor kosong dan tetap ditolak oleh guard. Tidak ada client privileged pada DAL monitoring dan tidak ada grant/policy tabel peserta yang diubah.

Satu waktu database dicatat setelah fungsi masuk ke snapshot statement. Jendela aktivitas `[asOf - 720 jam, asOf]` mengeluarkan event lama/future dan melakukan `COUNT DISTINCT actor_id` untuk `draft_created`, `request_sent`, `approved`, `rejected`. Angka akun terdaftar adalah jumlah baris Auth yang masih tercatat, termasuk semua role, unverified, nonaktif atau soft-deleted yang masih memiliki record; bukan jumlah profil/sesi. Guard akses tetap menolak admin soft-deleted atau sedang diblokir. Struktur field provider diperiksa terhadap [model Auth resmi Supabase](https://github.com/supabase/auth/blob/master/internal/models/user.go); [dokumentasi pengelolaan user](https://supabase.com/docs/guides/auth/managing-user-data) menjelaskan perbedaan penghapusan dan masa berlaku JWT.

Dokumen diunggah dihitung per `signing_documents` dengan minimal satu versi. Jumlah versi sumber dan arsip `documents` terpisah. Completed mensyaratkan request `completed`, keputusan approve dan hasil `ready`; consented belum selesai. Pending hanya undangan pending yang `expires_at > asOf`. Tidak ada job expiry atau perubahan riwayat saat membaca.

Hasil perlu perhatian: `failed`, atau `processing` dengan lease hilang/kedaluwarsa. Proses yang sedang berjalan dengan lease aktif ditampilkan pada hitungan pemrosesan terpisah. Daftar diurutkan `updated_at DESC, receipt_id`, dibatasi 20 dan total tidak dipotong. Reference yang dikirim adalah SHA-256 receipt ID; receipt ID, path, hash dokumen, claim token, actor dan identitas peserta tidak dikirim. Kegagalan yang pulih menjadi ready hilang dari hitungan; ini bukan riwayat seluruh error platform.

Reviewer tanpa role admin diarahkan ke antrean arsip; mixed role admin/reviewer boleh monitoring berdasarkan role admin dan tetap memiliki hak legacy yang sebelumnya sah. Tidak ada role yang diberikan/dicabut otomatis. [Helper SQL Editor](../../supabase/operators/grant-platform-admin-dashboard.sql) hanya konfigurasi awal opsional oleh operator tepercaya dengan UUID target/operator eksplisit dan audit idempotent; bukan fitur role assignment aplikasi.

## Urutan verifikasi

Komponen, RPC baca, DAL, guard halaman/API, navigasi dan migration additive 012 sudah tersedia. Unit dan SQL native mencakup anon/user/reviewer/admin/mixed role, revokasi, metadata spoofing, kondisi provider, agregasi/deduplikasi, waktu, lifecycle retry dan tidak adanya hak membaca PDF baru. Browser guest dan komponen diuji terpisah; belum membuktikan sesi admin pada Supabase cloud. Operator sudah melaporkan pemasangan 012 dan preflight API lulus. [Langkah setup akun dan uji baca-saja](r4-cloud-acceptance-plan.md) tersedia; data uji/elevasi role otomatis tidak dijalankan.

Tidak menjalankan ulang fixture terminal R1/R2/R3/R3b atau menambah data cloud dalam penyusunan kontrak/tampilan ini.
