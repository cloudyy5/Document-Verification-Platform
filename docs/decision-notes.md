# Catatan keputusan implementasi

Paket spesifikasi asli tetap berada di `Document_Verification_Platform_v1.0.2/document-verification-platform-v1.0.2/`. File asli tidak diedit. SHA-256 seluruh file dicatat dalam `original-files.sha256.json` dan diperiksa oleh unit test. SQL dan design tokens pada struktur aplikasi adalah salinan byte-identik.

Pengguna telah menentukan stack Next.js App Router, TypeScript strict, Tailwind CSS, Supabase, Vitest, dan Playwright pada instruksi implementasi. Karena itu R-01 kini disetujui untuk pekerjaan ini. Aplikasi dibuat di root workspace, dengan dokumentasi asli tetap pada lokasi sebelumnya.

R-02 sampai R-17 pada `DECISION_REGISTER.md` tetap berupa rekomendasi yang belum disetujui: ukuran PDF, file terenkripsi, verifikasi email, cakupan reviewer, pembagian permission admin, jumlah keputusan reviewer, unduhan reviewer, pengajuan ulang setelah ditolak, versi revisi, pencabutan, kanal notifikasi, kategori awal, malware scanning, retensi, pengelolaan user, dan perubahan pengaturan. Phase 0 tidak mengaktifkan keputusan tersebut. Nilai usulan 20 MiB bukan batas aktif pada aplikasi.

Verifikasi publik tetap di luar cakupan. Instruksi pengguna dan keputusan C-02 mengharuskan akses dokumen serta verifikasi dibatasi kepada pemilik yang terautentikasi. R-18 tidak dapat ditafsirkan sebagai izin membuka verifikasi publik.

Beberapa dokumen teknis lama menyebut kode verifikasi dalam URL QR. Catatan terbaru pada `DECISION_REGISTER.md` dan addendum handoff menetapkan opaque credential UUID dalam URL. Sesuai urutan sumber kebenaran pada `DOCUMENT_CONTROL.md`, UUID menjadi acuan saat Phase 5 dikerjakan. Phase 0 tidak menerbitkan QR atau kode.

User Workspace dan Admin Workspace saat ini hanya pratinjau shell untuk meninjau layout dan komponen. Tautan antarshell bukan pergantian role atau pemberian izin. Belum ada sesi pengguna, operasi dokumen, endpoint bisnis, ataupun query statistik. Autentikasi dan pemeriksaan role server harus ditambahkan sesuai roadmap sebelum data pribadi atau operasi bisnis dihubungkan.

Migration SQL yang disediakan mengandung draft RLS, kategori, dan workflow RPC. Salinan disiapkan di `supabase/migrations/` tanpa dieksekusi. Pengujian schema, RLS, isolasi kepemilikan, dan seluruh prosedur berhak istimewa tetap merupakan Phase 1 setelah persetujuan pengguna.

Fondasi tema menggunakan token desain asli. Token tambahan khusus sidebar graphite, overlay, dan kebutuhan komponen dicatat pada stylesheet aplikasi; warna status, permukaan utama, dan CTA tetap mengikuti desain sumber. Penanda dokumen di sidebar merupakan ikon antarmuka sementara, bukan keputusan logo final.

## Persetujuan dan implementasi Phase 1 — 1 November 2026

Pengguna menyetujui hasil Phase 0 dan meminta melanjutkan ke Phase 1. Setelah pertanyaan kebijakan ditampilkan, pengguna secara eksplisit menyetujui:

- **R-05:** antrean bersama diaktifkan untuk seluruh akun dengan role `reviewer`.
- **R-13:** aktifkan Pendidikan, Pekerjaan, Organisasi, Administrasi, Keuangan, Kesehatan, Hukum, Pribadi, dan Lainnya.

Migration tambahan `202611010003_access_control_foundation.sql` menutup grant berlebih, memperkuat RLS/constraints, dan menyediakan konfigurasi awal yang tertutup. Migration `202611010004_owner_approved_configuration.sql` kemudian mengaktifkan keputusan R-05/R-13 yang telah disetujui. Default kategori baru tetap nonaktif. Seed bersifat idempotent dan tidak mengubah keputusan operator yang sudah tersimpan.

Cakupan antrean adalah dokumen berstatus pending dan submission versi current. Riwayat keputusan reviewer dibatasi pada keputusan yang dibuatnya sendiri; tidak ada persetujuan untuk membuka seluruh arsip dokumen atau riwayat reviewer lain. `platform_admin` tanpa reviewer tidak memperoleh akses dokumen orang lain.

R-02, R-03, R-04, R-06 sampai R-12, serta R-14 sampai R-17 tetap mengikuti status sebelumnya. Pembatasan akses minimum tetap diberlakukan berdasarkan instruksi produk, bukan ditafsirkan sebagai pemberian hak admin baru. Autentikasi UI, upload, review UI, QR, verifikasi, revocation, serta user management belum diaktifkan.

Migration 001/002 dan seluruh paket spesifikasi asli tetap byte-identik. Pengujian Phase 1 memakai PostgreSQL native terisolasi, dengan metadata schema Auth/Storage khusus tes. Ini memverifikasi SQL/RLS PostgreSQL, bukan konektivitas cloud Supabase, validasi JWT GoTrue, PostgREST, atau layanan Storage HTTP.

## Persetujuan dan implementasi Phase 2 — 3 November 2026

Pengguna meminta Phase 2 secara eksplisit dan menyetujui **R-04: email wajib diverifikasi sebelum pengajuan dokumen**. Pengguna memilih **Supabase cloud development**, dengan kredensial diisi langsung pada `.env.local`. Tidak ada izin membuka verifikasi publik atau melanjutkan fitur dokumen Phase 3.

Migration 006 menegakkan email confirmed pada setiap INSERT submission, termasuk resubmission, dengan membaca `auth.users.email_confirmed_at` di database; metadata/JWT yang mengaku verified tidak menggantikannya. UI submission juga memiliki guard email. Provider Confirm email wajib aktif sebelum registrasi aplikasi berjalan.

Role redirect memakai role tabel, bukan metadata pendaftaran. Seluruh halaman/layout privat memverifikasi akun dan role pada server; /foundation kini terpisah sebagai showcase publik. Form registrasi hanya menerima nama/email/password. Tidak ada endpoint web untuk pemberian role.

Recovery memakai `verifyOtp` dengan token kategori recovery yang diverifikasi provider, kemudian proof HMAC terikat user/session dan grant SQL 10 menit yang dikonsumsi sekali. Flag `type` pada URL atau redirectType browser sendiri tidak pernah memberi izin reset. Template email khusus wajib dipasang; PKCE callback tidak digunakan sebagai bukti recovery. Confirmation signup mengakhiri sesi callback dan kembali ke login.

Default teknis limiter persisten dicatat di [panduan setup](authentication-setup.md), bukan kebijakan review/PDF baru. Default global sengaja menjadi batas resource lintas identitas; proteksi provider/edge tetap diperlukan untuk deployment. Password, raw email, token recovery, dan IP tidak disimpan dalam counter. Tidak ada password custom atau secret pada source/browser.

Persetujuan R-05/R-13 Phase 1 tetap berlaku. R-02, R-03, R-06 sampai R-12, dan R-14 sampai R-17 belum disetujui. Modul User Workspace, upload dokumen, review UI, QR/kode, dan verifikasi Phase 3 ke atas belum dikerjakan.

## Persetujuan Phase 3 — 4 November 2026

Pengguna meminta melanjutkan Phase 3 dan secara eksplisit menyetujui R-02: maksimal 10 MiB per PDF, dapat dikonfigurasi; R-03: PDF terenkripsi/password-protected ditolak dengan pesan jelas; R-09: pengajuan setelah ditolak dibuat sebagai dokumen baru; R-10: revisi menjadi versi baru immutable pada dokumen yang sama. Versi lama dan keputusan tidak ditimpa.

Teks persetujuan dan versi `development-2026-11-04` pada [draf kebijakan development](submission-policy-development-draft.md) disetujui untuk uji development. Persetujuan ini tidak menyelesaikan kebijakan produksi, retensi/penghapusan, pemilihan scanner, atau tinjauan hukum/privasi. Upload memakai lingkungan development pada origin loopback; upload pada domain publik/production tetap tertutup sampai prasyarat produksi ditetapkan. Anggaran pengguna adalah Rp0; tidak ada upgrade atau layanan berbayar yang diaktifkan.

Phase 3 membangun data pengguna, upload privat, detail/versi, profil, dan shell verifikasi. Administrative Review tetap Phase 4; penerbitan credential, kode, QR, dan mesin pencocokan tetap Phase 5. Keputusan R-06/R-07/R-08/R-11/R-12/R-14/R-15/R-16/R-17 belum berubah.

## Rebaseline arah produk — 4 November 2026

Setelah diskusi stakeholder, pengguna meminta alur permintaan tanda tangan antar-pengguna melalui kode akun, QR terkait bukti penandatanganan, dan admin yang berfokus pada monitoring/operasional. Pengguna meminta melanjutkan, lalu menjawab dua keputusan scope secara eksplisit:

- **S-02: “Prototipe persetujuan internal”.** Tidak ada target TTE tersertifikasi atau aktivasi layanan berbayar pada V1.
- **S-03: “Satu penandatangan dahulu”.** Alur awal meminta satu pengguna lain, tanpa multi-penandatangan, kuorum, giliran atau self-sign.

[Paket rebaseline](signing-revision/README.md) dan [register revisi](signing-revision/decision-register.md) menjadi acuan addendum untuk arah yang telah diputuskan. Paket asli v1.0.2 tetap dipertahankan byte-identik. Perubahan target ini tidak mengganti arti data legacy, mengubah grant/RLS, atau menerapkan migration signing dengan sendirinya.

Phase 4 Administrative Review dan Phase 5 Verification Engine lama tidak otomatis dilanjutkan sebagai fitur inti produk baru. Autentikasi, desain, komponen dan Storage privat digunakan kembali. Hak penerima harus diikat pada undangan/versi tertentu; admin monitoring tidak otomatis membaca PDF atau membuat persetujuan pengguna. Verifikasi publik tetap di luar cakupan.

Paket dokumentasi revisi mencatat gate konfirmasi per aksi, masa akses peserta, lifecycle undangan, consent baru, penempatan QR dan batas admin. Gate yang belum disepakati tidak dianggap sudah disetujui. Pekerjaan fondasi independen dapat berjalan tanpa mengaktifkan fitur yang bergantung pada gate tersebut.

Perbaikan payload worker PDF telah lulus 435 unit test dan build, serta probe lokal factory Turbopack/worker hasil build nyata dengan fixture 2.831 byte. Ini tidak membuktikan upload cloud atau persetujuan signing. Percobaan cloud sebelumnya gagal sebelum penyimpanan; nol artefak milik akun uji dibuktikan dan kedua akun dibersihkan. Status integrasi tetap dibedakan dari ketersediaan source.

## Penutupan fondasi R1 — 5 November 2026

Pengguna meminta melanjutkan tahap berikutnya. Persetujuan terdahulu untuk dua akun sintetis dan satu PDF tetap digunakan setelah hasil percobaan pertama direkonsiliasi. Retest cloud run `845bb91e-cda5-4870-9b1a-f568c27d2e8c` lulus melalui UI dan API nyata. [Laporan R1](signing-revision/r1-report.md) mencatat detail dan keterbatasannya.

Satu akun pemilik dan satu dokumen/submission/PDF sintetis dipertahankan, akun pembanding dibersihkan. Tidak ada credential kode/QR yang diterbitkan, migration baru, keputusan reviewer, atau perubahan hak akses penerima. Status receipt `pending_review` tetap berarti legacy, bukan tanda tangan internal. Runner kini menolak membuat fixture baru apabila proof lokal masih menunjuk fixture persisten yang belum ditangani. Keputusan S-06/S-07/S-08 untuk delegasi/consent baru masih belum dianggap disetujui hanya karena R1 lulus.
