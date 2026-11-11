# Roadmap revisi — permintaan tanda tangan antar-pengguna

Disusun: **4 November 2026**. Checkpoint: **10 November 2026**, Asia/Makassar. Dokumen ini memakai awalan **R0–R5** agar riwayat Phase 0–3 tetap dapat dibaca dan tidak berubah arti. R1/R2 lulus cloud; migration 010 aktif dan [preflight R3](r3-activation-check.md) lulus 43 pemeriksaan. [Penerimaan peserta R3 format awal](r3-cloud-report.md) lulus setelah kelanjutan yang ditinjau pada fixture dua dokumen yang sama. **Revisi R3b/S-14 kini tersedia pada source v0.7.0 dan lulus pemeriksaan lokal; migration 011 dilaporkan aktif dan preflight API lulus 47 pemeriksaan; [penerimaan peserta cloud format baru](qr-placement-cloud-report.md) telah lulus.** R4–R5 belum dikerjakan.

Pengguna meminta arah baru: pemilik mengunggah PDF, memilih penerima melalui kode pengguna, penerima mengonfirmasi tindakan, dan admin berfokus pada operasional. Pengguna secara eksplisit memilih **prototipe persetujuan internal** dan **satu penandatangan dahulu** untuk V1. Persetujuan scope ini belum mengaktifkan kode, schema atau kebijakan akses baru. TTE tersertifikasi dan beberapa penandatangan menjadi pengembangan masa depan, bukan gate terbuka untuk memilih ulang scope V1.

## Acuan dan urutan perubahan

- [Usulan produk](../signing-platform-proposal.md) merekam bahan diskusi. [Kebutuhan revisi](product-requirements.md), [alur dan sitemap](workflows-and-sitemap.md), serta [kontrak teknis](technical-contract.md) harus ditinjau bersama dengan catatan keputusan yang dikelola pada paket revisi.
- Paket asli v1.0.2, design assets, dan migration yang sudah diterapkan tetap dipertahankan. Riwayat hasil Phase 0–3 adalah bukti fondasi lama, bukan bukti bahwa alur tanda tangan baru sudah bekerja.
- Phase 4 Administrative Review dan Phase 5 Verification Engine pada roadmap lama **tidak otomatis dijalankan** untuk permintaan baru. Bagian yang bertentangan baru digantikan setelah kontrak revisi disepakati dan perubahan kode/database yang terkait benar-benar diluncurkan.
- Jalur legacy tetap memakai owner-only access dan arti status review lama. R2 memakai tabel/route/RLS baru yang terpisah; tidak mengubah data lama menjadi persetujuan. Source tersedia tidak dengan sendirinya membuktikan cloud sudah bermigrasi atau perjalanan penerima sudah lulus.
- Kerjakan satu tahap kecil yang dapat ditinjau. Setiap laporan memisahkan source tersedia, migration lokal teruji, perubahan cloud diterapkan, dan alur cloud terbukti.

## R0 — Kontrak produk dan keputusan

Hasil: kebutuhan revisi, matriks akses owner/penerima/admin, state machine permintaan, desain QR/bukti, sitemap, kontrak API, rencana data additive, definisi statistik, dan daftar keputusan yang belum disetujui.

Pintu keluar R0:

1. Catat target **persetujuan internal** yang sudah disetujui. Bahasa produk tidak mengklaim kesetaraan dengan Privy atau keabsahan hukum hanya karena tersedia QR; jalur sertifikat berada di luar V1.
2. Catat batas **satu penandatangan pengguna lain** yang sudah disetujui; V1 menolak self-sign dan multi-penerima. Syarat selesai mengikuti persetujuan committed dan PDF ber-QR yang siap, bukan hanya perubahan label UI.
3. Kebijakan konfirmasi per aksi, autentikasi ulang/MFA bila diperlukan, pengikatan versi, dan isi bukti disepakati. Sesi login saja tidak boleh diam-diam dipilih sebagai bukti yang cukup untuk semua target jaminan.
4. Hak akses penerima untuk versi tertentu, masa akses, pencabutan undangan, penolakan, pembatalan, dan kedaluwarsa ditentukan. Verifikasi publik tetap di luar cakupan sampai ada keputusan yang secara eksplisit menggantikan larangan lama.
5. Batas admin disepakati. Monitoring agregat tidak memberikan akses semua PDF, peniruan identitas, pemberian tanda tangan atas nama pengguna, atau hak penghapusan riwayat.

Pekerjaan fondasi yang tidak bergantung keputusan dapat dilanjutkan selama R0, tetapi aktivasi akses penerima dan penandatanganan menunggu kontraknya.

## R1 — Tutup fondasi upload privat

Gunakan kembali autentikasi Supabase, validasi environment, tema dan komponen, parser PDF, storage privat, pembacaan file melalui server, serta idempotensi upload. Periksa kontrak file dan worker pada hasil build production, bukan unit parser saja.

Checkpoint yang diketahui: **435 unit test**, **254 pengujian database native**, serta browser **37 lulus dan 2 dilewati** pada fondasi lama. Angka ini bukan hasil tes alur tanda tangan revisi. Detail bukti dan batasnya ada di [laporan Phase 3](../phase-3-report.md).

Percobaan upload cloud pertama menerima 422 sebelum penyimpanan karena bentuk payload worker pada build production. Nol dokumen, submission, dan object milik akun uji telah dibuktikan; kedua akun dibersihkan. Pada checkpoint 4 November, perbaikan lokal/build sudah lulus dan retest cloud masih diperlukan; hasil checkpoint 5 November dicatat berikutnya. Persetujuan pengguna untuk satu PDF sintetis dan dua akun uji sudah ada; jangan membuat fixture tambahan tanpa meninjau receipt dan hasil percobaan sebelumnya.

**Checkpoint 5 November 2026: R1 lulus.** Retest cloud satu skenario menyelesaikan sembilan kelompok pemeriksaan, termasuk upload lewat UI, idempotensi, exact bytes/hash, preview/download/range, foreign 404/guest 401 dan Storage langsung ditolak. Preview diperiksa secara visual. Satu fixture dipertahankan, akun pembanding dibersihkan, dan nol credential verifikasi terbit. Rincian berada di [laporan R1](r1-report.md). Riwayat 422 di atas adalah checkpoint sebelumnya, bukan masalah yang masih aktif.

Pintu keluar: upload sintetis nyata, receipt, list/detail, hash byte asli, preview/download/range, idempotensi, larangan akses akun lain dan Storage langsung teruji. Jalankan cloud dengan gate yang sudah disepakati, lalu catat record yang sengaja dipertahankan. Jangan menambahkan transisi reviewer hanya untuk membuat fixture revisi atau tanda tangan. Retest legacy membuktikan fondasi upload; status `pending_review` yang dihasilkannya tidak diartikan sebagai permintaan tanda tangan.

## R2 — Kode pengguna dan undangan privat

Checkpoint: source, UI/API dan migration additive tersedia; **306 tes SQL native lulus/8 file**. S-06/S-07/S-08 disetujui untuk development. Kontrak final berada pada [kontrak implementasi R2](r2-implementation-contract.md). [Laporan R2](r2-report.md) memuat hasil pemeriksaan akhir. Pengguna melaporkan migration 009 sudah diaktifkan; [preflight API](r2-activation-check.md) lulus 26 pemeriksaan. [Rencana uji cloud R2](r2-cloud-acceptance-plan.md) telah disetujui dan dieksekusi; [hasil cloud](r2-cloud-report.md) lulus satu skenario/tujuh kelompok, termasuk preview native, isolasi dan pencabutan akses setelah pembatalan. Jangan melanjutkan aksi keputusan/QR R3 sebagai bagian penutupan R2.

Hasil: kode pengguna stabil dengan entropi yang memadai, pencarian penerima terbatas, draft permintaan, pengiriman undangan, kotak masuk/keluar, serta akses file versi yang tepat bagi penerima yang berwenang.

Pekerjaan server harus mendahului koneksi UI: migration additive, grants/RLS, transaksi pengiriman yang membekukan versi, DTO minimum, rate limit, dan audit. Pencarian kode tidak berubah menjadi direktori email atau data profil. Kode pengguna adalah identifier, bukan autentikasi maupun persetujuan.

Pintu keluar: A dapat mengundang B untuk satu versi yang dipilih; B hanya membaca resource yang diizinkan kontrak; C dan admin monitoring tidak memperoleh isi PDF. Perubahan URL, klaim browser, role metadata, subscription realtime, atau query Data API langsung tidak memperluas hak. Pengiriman ulang dengan idempotency key yang sama tidak membuat undangan ganda.

V1 menerima satu penerima sesuai scope yang disetujui. Opsi beberapa penerima paralel/berurutan tidak dirilis; bila diminta kelak, aturan, migration dan tes cabangnya menjadi revisi tersendiri.

## R3 — Konfirmasi tindakan dan QR bukti

Checkpoint 10 November: S-05/S-09/S-13 disetujui. Tanpa password ulang; konfirmasi eksplisit, alasan reject wajib maksimal 1.000 karakter, QR kiri bawah semua halaman sumber + satu halaman bukti. [Kontrak R3](r3-implementation-plan.md) dan [laporan R3](r3-report.md) memisahkan implementasi lokal dari cloud. Migration 010 sudah dilaporkan aktif dan preflight lulus 43 pemeriksaan. Fixture R3 telah disetujui dan dieksekusi: approve/QR/hasil/reject/isolasi lulus melalui kelanjutan yang ditinjau; [laporan cloud R3](r3-cloud-report.md) mempertahankan bukti interupsi dan hasil final. R3 development siap ditinjau; R4 belum dimulai.

Hasil: penerima membaca versi beku, memilih menandatangani atau menolak, melewati konfirmasi yang disepakati, lalu sistem menyimpan bukti per aksi. QR baru diterbitkan sesudah transaksi sah committed; QR identitas pengguna tidak dipakai sebagai bukti persetujuan dokumen.

Pintu keluar:

- Transaksi memeriksa actor dari sesi terverifikasi, resource/version, hak penerima, state, waktu kedaluwarsa bila diaktifkan, kebijakan konfirmasi, serta idempotency di server/database.
- Race sign/sign, sign/reject, sign/cancel dan perubahan versi ditangani atomik menurut state machine yang disepakati. Tidak ada event ganda atau penyelesaian prematur.
- Sumber PDF tetap immutable. Hash byte sumber dan hash artefak PDF hasil QR dibedakan; tidak ada hash yang berusaha memuat hasil hash dirinya sendiri. Kegagalan render/finalisasi memiliki status dan retry yang jelas tanpa menciptakan persetujuan kedua.
- QR memakai identifier opaque tanpa secret; resolusi memerlukan login dan pemeriksaan otorisasi per resource. Menyalin QR ke PDF lain tidak membuktikan kecocokan file atau aksi baru.
- Jalur internal menampilkan bahasa bukti persetujuan internal. Bila target tersertifikasi dipilih, kontrak penyedia/sertifikat, penguasaan kunci, pengikatan identitas dan verifikasi PDF menjadi dependency tersendiri sebelum klaim tersebut diaktifkan.

## R3b — Posisi QR per halaman dan bukti web

S-14 menggantikan S-09 untuk persetujuan baru: penerima menggeser penanda pada semua halaman, posisi dikunci saat approve, PDF hasil tidak mempunyai halaman bukti tambahan, dan pemindaian membuka bukti web privat. Riwayat/PDF R3 lama tetap utuh.

[Kontrak](qr-placement-contract.md) dan [laporan R3b](qr-placement-report.md) mencatat editor desktop/mobile, validasi geometri sumber oleh worker, manifest immutable dan finalisasi hasil dengan jumlah halaman sumber. Pengujian lokal: 763 unit, 340 SQL native, 4 browser editor dan enam QR hasil berhasil didekode. Build serta regresi browser dasar lulus. Bukti lokal ini terpisah dari [perjalanan peserta R3b pada Supabase cloud](qr-placement-cloud-report.md) yang kini lulus satu skenario.

Pintu keluar: migration additive 011 dilaporkan terpasang dan preflight API lulus 47 pemeriksaan. Perjalanan approve/posisi terkunci/hasil/scan privat/isolation telah dibuktikan menggunakan satu fixture development yang disetujui terpisah. [Hasil cloud R3b](qr-placement-cloud-report.md) mencatat data yang dipertahankan dan cleanup pembanding. Jangan mengulang fixture terminal R1/R2/R3 atau melanjutkan monitoring R4 sebagai bagian revisi ini.

## R4 — Admin monitoring dan operasional

**Penyempurnaan S-15/source 0.8.1:** [workspace admin eksklusif dan login sesuai role](admin-workspace-report.md) menambahkan pembatasan navigasi, halaman/API pengguna dan tujuan login admin, tanpa migration baru. Profil/preferensi akun sendiri tetap di shell admin. Ini bagian R4; R5 belum dimulai.

**Checkpoint 11 November 2026:** ketiga keputusan S-11 sudah disetujui. Source v0.8.0 menyediakan halaman/API monitoring, RPC baca sempit dan migration 012, dengan 805 unit, 365 SQL native serta enam tes browser komponen lulus; build dan browser production juga lulus. [Laporan R4](r4-report.md) mencatat cakupan dan aktivasi. **012 dilaporkan berhasil dipasang pada cloud dan [preflight API](r4-activation-check.md) lulus 49 pemeriksaan; penerimaan sesi admin cloud belum dibuktikan.** [Setup akun dan uji baca-saja](r4-cloud-acceptance-plan.md) tersedia untuk operator. Laporan [persiapan](r4-preparation-report.md) sebelumnya dipertahankan sebagai checkpoint historis; R5 belum dimulai.

Hasil awal: statistik agregat nyata, pemantauan proses gagal, dan audit tindakan administratif. Definisikan pengguna terdaftar, pengguna aktif 30 hari, dokumen diunggah, dokumen selesai untuk seluruh penerima wajib, permintaan tertunda, serta operasi gagal. Jumlah dokumen berbeda dari jumlah aksi tanda tangan.

Pintu keluar: agregat hanya tersedia bagi role admin yang sah; count tidak diganti nol saat query gagal; timezone/jendela aktivitas dan deduplikasi terdokumentasi; data personal dibatasi; fungsi agregat tidak menjadi jalan akses isi PDF.

Penangguhan akun, role assignment, akses isi untuk dukungan, retensi/penghapusan, dan kebijakan sengketa tetap di luar aktivasi sampai kewenangannya disetujui. Tidak ada impersonation atau perubahan bukti persetujuan oleh admin. Keberhasilan monitoring tidak otomatis mengaktifkan semua fungsi pengelolaan akun.

## R5 — Hardening dan penerimaan rilis

Hasil: pengujian kontrak menyeluruh, RLS dan privileged-client review, scanning/isolasi upload yang dipilih, abuse control, pengujian responsif dan aksesibilitas, admin MFA, backup/restore, kebijakan produksi serta UAT.

Pintu keluar: seluruh gate keamanan/privasi yang masih relevan pada paket asli serta [rencana penerimaan revisi](acceptance-plan.md) lulus. Retensi belum ditentukan; tidak boleh dibuat job purge otomatis berdasarkan angka usulan. Rilis publik, layanan berbayar, integrasi sertifikat, dan perubahan kebijakan verifikasi publik tidak dilakukan hanya karena build lokal lulus.

## Laporan tiap tahap

Catat file/permission yang berubah, keputusan yang dipakai, migration dan lingkungan eksekusinya, bukti tes, data uji yang ditinggalkan, masalah yang tersisa, serta tahap berikutnya. Jangan menyebut tahap selesai jika akses privat, transaksi, atau integrasi yang diwajibkan tahap itu masih belum terbukti. Rencana ini tidak menandai ulang Phase 3 sebagai selesai.
