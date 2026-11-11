# PROJECT_BRIEF.md

## Document Verification Platform

**Versi:** 1.7\
**Status:** Draft produk dengan standar review administratif MVP yang
telah dipilih\
**Jenis produk:** Web-based document registration, administrative
review, and integrity verification platform\
**Target:** Desktop dan mobile

------------------------------------------------------------------------

## 1. Ringkasan Produk

Document Verification Platform adalah aplikasi web yang memungkinkan
pengguna terdaftar mengajukan dokumen PDF untuk diperiksa oleh
administrator sebelum diterima sebagai dokumen terdaftar pada platform.

Sebelum masuk antrean review, sistem melakukan validasi teknis file dan
menghitung hash SHA-256. Administrator kemudian memeriksa empat aspek:
kelengkapan, keterbacaan, kesesuaian kategori, dan kelayakan dokumen
untuk didaftarkan.

Administrator dapat menyetujui, menolak, atau meminta perbaikan. Kode
verifikasi unik dan QR Code baru diterbitkan setelah dokumen disetujui.

Pada MVP, setiap pengguna hanya dapat melihat, mengelola, dan
memverifikasi dokumen miliknya sendiri. Automatic Hash Matching mencari
kecocokan terhadap seluruh dokumen milik akun aktif yang pernah
disetujui.

Persetujuan administrator berarti dokumen lolos pemeriksaan
administratif dan diterima untuk didaftarkan. Persetujuan tersebut tidak
otomatis membuktikan keaslian penerbit, kebenaran isi, atau keabsahan
hukum dokumen.

## 2. Tujuan Produk

1.  Memungkinkan pengguna terdaftar mengajukan dokumen PDF.
2.  Memastikan setiap pengajuan melewati validasi teknis dan pemeriksaan
    administratif.
3.  Mengurangi pengajuan file kosong, rusak, tidak relevan, atau tidak
    sesuai kategori.
4.  Memberikan status dan alasan keputusan yang jelas kepada pengguna.
5.  Menerbitkan kode unik dan QR Code hanya setelah dokumen disetujui.
6.  Memungkinkan pemeriksaan integritas file melalui SHA-256.
7.  Menjaga privasi dan membatasi akses berdasarkan kepemilikan dan
    role.
8.  Menyediakan jejak audit atas pengajuan dan keputusan reviewer.

## 3. Aktor Produk

### Registered User / Document Owner

Mengajukan dokumen, melihat status dan catatan review, memperbaiki
pengajuan, melihat dokumen yang disetujui, serta memverifikasi dokumen
miliknya.

### Document Reviewer

Memeriksa pengajuan sesuai checklist administratif, melihat preview
secara aman, dan memutuskan approve, reject, atau request revision.

### Platform Administrator

Mengelola operasional dan konfigurasi platform sesuai kewenangan. Untuk
MVP, satu akun dapat memegang fungsi reviewer dan administrator, tetapi
permission tetap dipisahkan secara logis.

## 4. Standar Review MVP

Administrator memeriksa empat aspek: 1. **Kelengkapan:** file dan
metadata wajib tersedia. 2. **Keterbacaan:** file dapat dibuka, tidak
rusak, dan informasi dapat dibaca. 3. **Kesesuaian kategori:** jenis
dokumen sesuai kategori yang diterima platform. 4. **Kelayakan
pendaftaran:** dokumen relevan dan tidak termasuk file kosong, spam,
atau file yang tidak sesuai kebijakan platform.

Standar ini adalah pemeriksaan administratif, bukan autentikasi penerbit
atau sertifikasi keaslian dokumen.

## 5. Alur Utama

1.  Pengguna login dan mengajukan PDF beserta metadata.
2.  Backend memvalidasi file, menghitung SHA-256, dan menyimpan file
    secara privat.
3.  Submission dibuat dengan status `pending_review`.
4.  Reviewer memeriksa dokumen melalui Admin Workspace.
5.  Reviewer memilih `approved`, `revision_requested`, atau `rejected`.
6.  Keputusan dan catatan disimpan dalam audit trail.
7.  Hanya pengajuan yang disetujui yang memperoleh kode unik dan QR
    Code.
8.  Pengguna dapat memeriksa dokumen yang disetujui melalui QR, kode,
    atau Automatic Hash Matching.

## 6. Hak Akses

-   Pengguna hanya mengakses submission dan dokumen miliknya.
-   Reviewer hanya mengakses pengajuan sesuai role dan scope.
-   Keputusan review hanya dapat dilakukan oleh role yang berwenang.
-   QR dan kode unik bukan pengganti autentikasi.
-   Semua pemeriksaan kepemilikan dan permission dilakukan di backend.
-   Akses reviewer dan keputusan administratif dicatat.

## 7. Ruang Lingkup MVP

Termasuk: - Registrasi, login, logout. - User dashboard dan submission
tracking. - Upload PDF dan metadata. - Validasi teknis serta SHA-256
backend. - Private storage. - Admin overview. - Review queue. - Review
detail dengan PDF preview. - Checklist empat aspek. - Approve, reject,
request revision. - Review history dan audit trail. - Kode unik dan QR
setelah approval. - Verifikasi owner-only dengan kode, QR, dan Automatic
Hash Matching. - Responsive desktop dan mobile.

Di luar MVP: - Verifikasi publik dan lintas akun. - Verifikasi penerbit
eksternal. - Sertifikasi keaslian atau legalitas. - Tanda tangan
elektronik tersertifikasi. - OCR/AI fraud detection. - Blockchain. -
Aplikasi mobile native. - Pembayaran dan subscription.

## 8. Status Dokumen

  Status                 Makna
  ---------------------- -------------------------------------------------
  `pending_review`       Menunggu pemeriksaan administrator
  `revision_requested`   Memerlukan perbaikan atau kelengkapan
  `rejected`             Tidak diterima untuk didaftarkan
  `approved`             Lolos pemeriksaan administratif dan terdaftar
  `revoked`              Dokumen yang sebelumnya disetujui telah dicabut

Kode dan QR aktif hanya diterbitkan setelah status approved.

## 9. Batas Klaim Produk

Platform dapat menyatakan bahwa dokumen: - telah diajukan; - telah lolos
pemeriksaan administratif; - telah terdaftar; - memiliki file yang
hash-nya cocok dengan file yang didaftarkan.

Platform tidak boleh menyatakan dokumen asli, sah secara hukum, atau
benar-benar diterbitkan oleh lembaga tertentu hanya berdasarkan
pemeriksaan administratif atau hash.

## 10. Keputusan yang Masih Terbuka

1.  Kategori dokumen apa yang diterima platform?
2.  Metadata wajib apa yang harus diisi pengguna?
3.  Berapa batas ukuran file dan kuota per akun?
4.  Apakah reviewer hanya boleh preview atau dapat mengunduh file?
5.  Apakah reviewer dan platform administrator menjadi role terpisah
    sejak MVP?
6.  Apakah pengajuan rejected boleh diajukan ulang?
7.  Berapa target waktu pemeriksaan?
8.  Siapa yang dapat mencabut dokumen yang sudah approved?
9.  Apakah satu pengajuan perlu satu reviewer atau persetujuan kedua?

## 11. Tahapan Berikutnya

1.  Finalisasi kategori dan metadata dokumen.
2.  Finalisasi wireframe user dan admin.
3.  Finalisasi design reference dan design system.
4.  Tentukan technical architecture, database, storage, dan security.
5.  Susun testing plan.
6.  Siapkan instruksi Codex dan implementasi bertahap.

**Catatan:** Codex tidak boleh menganggap keputusan yang masih TBD
sebagai keputusan final.

## 12. Kebijakan Cakupan Dokumen

-   Semua jenis dokumen pada prinsipnya dapat diajukan.
-   Format yang diterima pada MVP adalah PDF.
-   Kategori berfungsi untuk klasifikasi dan pencarian, bukan whitelist
    tertutup.
-   Sediakan pilihan `Lainnya` untuk dokumen yang belum memiliki
    kategori khusus.
-   Semua dokumen tetap melewati validasi teknis dan empat aspek
    pemeriksaan administratif.
-   Konten yang dilarang oleh kebijakan platform, file berbahaya, spam,
    atau dokumen yang melanggar hak dan privasi pihak lain dapat
    ditolak.
-   Daftar kategori, aturan konten terlarang, dan mekanisme pelaporan
    perlu ditetapkan secara eksplisit sebelum produksi.

## 13. Metadata Pengajuan Dokumen --- Final untuk MVP

Struktur metadata pengajuan yang disetujui:

  Field                            Ketentuan
  -------------------------------- ---------------------------------------
  Nama dokumen                     Wajib
  Kategori dokumen                 Wajib
  Jenis dokumen                    Wajib jika kategori `Lainnya` dipilih
  File PDF                         Wajib
  Tanggal dokumen                  Opsional
  Instansi penerbit                Opsional
  Deskripsi                        Opsional
  Persetujuan kebijakan platform   Wajib

Struktur ini menjadi acuan formulir pengajuan MVP. Field tambahan tidak
ditambahkan sebelum ada kebutuhan produk yang tervalidasi.

## 14. Arah Visual yang Dipilih

-   Design direction: gabungan Enterprise Trust dan Premium Technology.
-   Theme: Light Mode dan Dark Mode.
-   Prinsip: profesional, presisi, tenang, modern, dan purpose-built.
-   Referensi: Stripe Design Language Study, Vercel Geist Design System,
    dan Linear interface refresh.
-   Detail visual, semantic colors, typography, spacing, component
    guidelines, dan responsive behavior diatur pada `DESIGN_SYSTEM.md`.
-   Token implementasi tersedia pada `DESIGN_TOKENS.css`.
-   Referensi dan batas adaptasi tersedia pada `DESIGN_REFERENCE.md`.


---

## ADDENDUM v1.0 — Technical Preparation

This addendum supersedes older TBD statements where a later owner decision is recorded.

### Confirmed MVP decisions
- All registered users may submit documents.
- Users may access and verify only documents owned by their account.
- Verification methods: QR Code, unique code, and PDF re-upload for SHA-256 matching.
- Hash matching searches all approved documents owned by the active account; previously approved but revoked documents may be returned with revoked status.
- Review criteria: completeness, readability, category suitability, and registration eligibility.
- All document types may be submitted if they comply with platform policy. Categories are for classification, not a closed whitelist.
- The approved metadata set is the eight-field structure in `UPLOAD_FORM_SPEC.md`.

### Technical recommendation
The recommended MVP stack and architecture are in `TECHNICAL_ARCHITECTURE.md`. The database, API, security, test, and deployment specifications are separate documents in this package.

### Remaining owner decisions
See `DECISION_REGISTER.md`. Do not treat recommended defaults as approved until the owner confirms them.
