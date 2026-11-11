# PRODUCT_REQUIREMENTS.md

## Document Verification Platform

**Versi:** 0.7\
**Status:** Draft kebutuhan produk untuk ditinjau\
**Berkaitan dengan:** `PROJECT_BRIEF.md` v1.3\
**Ruang lingkup:** MVP aplikasi web responsif

------------------------------------------------------------------------

## 1. Tujuan

Mendefinisikan perilaku produk, proses pengajuan dokumen, pemeriksaan
administrator, persetujuan, registrasi, dan verifikasi integritas.

Kata kunci: - **MUST:** wajib untuk MVP. - **SHOULD:** sangat
disarankan. - **TBD:** belum diputuskan.

## 2. Prinsip Produk

1.  Semua dokumen diajukan oleh pengguna terdaftar.
2.  Dokumen harus melalui review sebelum disetujui dan menjadi dokumen
    terdaftar.
3.  Hanya dokumen berstatus approved yang memperoleh kode unik dan QR
    Code aktif.
4.  Pengguna hanya dapat mengelola dan memverifikasi dokumen miliknya
    sendiri.
5.  Reviewer memiliki akses khusus untuk meninjau pengajuan sesuai
    permission.
6.  Hash dihitung di backend.
7.  Automatic Hash Matching mencari pada seluruh dokumen milik akun
    aktif yang pernah disetujui.
8.  File pemeriksaan tidak otomatis didaftarkan.
9.  Persetujuan reviewer tidak otomatis berarti dokumen asli atau sah
    secara hukum.

## 3. Standar Review Administratif yang Dipilih

MVP menggunakan pemeriksaan administratif. Reviewer wajib memeriksa
empat aspek: 1. Kelengkapan dokumen dan metadata. 2. Keterbacaan file.
3. Kesesuaian kategori. 4. Kelayakan dokumen untuk didaftarkan.

Persetujuan berarti dokumen lolos pemeriksaan administratif dan diterima
untuk didaftarkan, bukan jaminan keaslian atau keabsahan hukum. Rincian
checklist, keputusan, dan batas review terdapat pada
`DOCUMENT_REVIEW_POLICY.md`.

## 4. Aktor dan Peran

### 3.1 Guest

-   Dapat mengakses halaman publik yang disetujui.
-   Dapat membuka login dan registrasi.
-   Tidak dapat mengakses fungsi dokumen atau admin.

### 3.2 Registered User / Document Owner

-   Dapat mengajukan dokumen.
-   Dapat melihat status dan catatan review pengajuan sendiri.
-   Dapat memperbaiki pengajuan yang diminta revisi.
-   Dapat melihat dokumen yang telah disetujui miliknya.
-   Dapat mengakses kode dan QR dokumen yang disetujui.
-   Dapat melakukan verifikasi kode, QR, dan Automatic Hash Matching
    pada dokumen miliknya.

### 3.3 Document Reviewer

-   Dapat melihat antrean pengajuan yang menjadi kewenangannya.
-   Dapat membuka preview/file pengajuan secara aman.
-   Dapat memeriksa metadata dan konten sesuai checklist review.
-   Dapat approve, reject, atau request revision.
-   Wajib menyertakan catatan keputusan sesuai kebijakan.
-   Tidak boleh mengubah isi file pengguna secara diam-diam.
-   Setiap keputusan harus dicatat dengan reviewer ID dan timestamp.

### 3.4 Platform Administrator

-   Mengelola konfigurasi dan operasional platform sesuai kewenangan.
-   Mengelola akun dan role jika fungsi tersebut disetujui.
-   Tidak otomatis memperoleh akses tanpa batas ke file pengguna.
-   Tindakan administratif harus tercatat.

Untuk MVP, satu akun dapat memiliki permission reviewer dan
administrator, tetapi permission harus tetap dipisahkan secara logis.

## 5. Permission Matrix

  --------------------------------------------------------------------------
  Aksi                         Guest     Owner           Reviewer Platform
                                                                  Admin
  ------------------------ --------- --------- ------------------ ----------
  Registrasi/login                Ya        Ya                 Ya Ya

  Mengajukan dokumen           Tidak        Ya    Jika juga owner Jika juga
                                                                  owner

  Melihat pengajuan            Tidak        Ya    Jika juga owner Jika juga
  sendiri                                                         owner

  Melihat antrean review       Tidak     Tidak                 Ya TBD

  Preview pengajuan            Tidak     Tidak         Ya, sesuai TBD
                                                 assignment/scope 

  Approve/reject/request       Tidak     Tidak                 Ya TBD
  revision                                                        

  Melihat dokumen approved     Tidak        Ya    Jika juga owner Jika juga
  sendiri                                                         owner

  Verifikasi dokumen           Tidak        Ya    Jika juga owner Jika juga
  sendiri                                                         owner

  Mengelola akun/role          Tidak     Tidak              Tidak TBD

  Mengubah konfigurasi         Tidak     Tidak              Tidak TBD
  platform                                                        
  --------------------------------------------------------------------------

Backend wajib memeriksa role, permission, assignment/scope, dan
kepemilikan. UI hiding tidak cukup.

## 6. Kebutuhan Fungsional

### 5.1 Authentication

**AUTH-001 --- Registrasi** - MUST menyediakan registrasi. - MUST
memvalidasi field wajib. - MUST mencegah akun duplikat. - SHOULD
menyediakan verifikasi email. Status: TBD.

**AUTH-002 --- Login** - MUST mengautentikasi pengguna. - MUST
menghindari pesan yang membocorkan keberadaan akun. - MUST membatasi
percobaan login. - MUST mengelola sesi/token secara aman.

**AUTH-003 --- Logout** - MUST mengakhiri sesi.

**AUTH-004 --- Password recovery** - SHOULD menyediakan reset
password. - Detail token dan masa berlaku ditetapkan pada spesifikasi
teknis.

### 5.2 User Dashboard

**DASH-001** - MUST menampilkan ringkasan pengajuan dan dokumen milik
pengguna. - SHOULD membedakan jumlah pending review, revision requested,
approved, dan rejected. - SHOULD menampilkan aktivitas terbaru. - Semua
data dibatasi dengan owner ID pengguna aktif.

**DASH-002** - MUST menampilkan empty state jika belum ada pengajuan
atau dokumen.

### 5.3 Document Submission

**SUB-001 --- Upload** - MUST menerima PDF untuk diajukan. - MUST
memvalidasi MIME type, magic bytes, struktur PDF, dan ukuran. - MUST
menolak file yang tidak valid. - Batas ukuran maksimum: TBD. - Kebijakan
PDF terenkripsi: TBD.

**SUB-002 --- Metadata** Setiap pengajuan minimal menyimpan: -
Submission ID. - Owner ID. - Nama file. - MIME type. - Ukuran file. -
SHA-256. - Storage key privat. - Waktu pengajuan. - Status review.

Metadata tambahan seperti judul dokumen, kategori, tanggal dokumen,
penerbit, nomor dokumen, dan deskripsi: TBD.

**SUB-003 --- Ownership** - Owner ID diambil dari sesi backend. -
Pengguna tidak dapat mengirim owner ID untuk mengambil alih kepemilikan
akun lain. - Pengguna hanya dapat melihat submission miliknya.

**SUB-004 --- Initial technical processing** - Sistem memvalidasi PDF. -
Sistem menghitung SHA-256 di backend. - Sistem menyimpan file pada
private storage. - Sistem membuat submission dengan status
`pending_review`. - Kegagalan salah satu tahap tidak boleh menghasilkan
submission yang dianggap berhasil.

**SUB-005 --- Submission receipt** - Pengguna menerima konfirmasi
pengajuan. - Pengguna dapat melihat submission ID dan status pending
review. - Kode verifikasi final dan QR Code aktif belum diterbitkan.

### 5.4 Admin Review Queue

**REV-001 --- Review queue** - Reviewer MUST memiliki halaman antrean
pengajuan. - Antrean menampilkan data minimum: submission ID, judul/nama
dokumen, pemohon, waktu pengajuan, dan status. - Reviewer hanya melihat
submission sesuai role dan scope yang diberikan. - Filter status dan
pencarian SHOULD tersedia.

**REV-002 --- Review detail** - Reviewer dapat membuka detail
pengajuan. - Reviewer dapat melihat metadata yang diperlukan. - Reviewer
dapat melihat preview dokumen atau membuka file melalui mekanisme
privat. - File tidak boleh disajikan melalui public URL. - Akses review
dicatat dalam audit trail sesuai kebijakan.

**REV-003 --- Review checklist** Reviewer SHOULD dibantu checklist yang
dapat dikonfigurasi, sekurang-kurangnya: - File dapat dibuka dan
dibaca. - Dokumen termasuk kategori yang diterima platform. - Dokumen
tidak kosong atau rusak. - Metadata wajib telah diisi. - Informasi
metadata sesuai dengan bagian dokumen yang relevan. - Dokumen tidak
jelas-jelas merupakan file yang tidak relevan dengan layanan. - Tidak
ada indikasi pelanggaran kebijakan platform yang tampak dari
pemeriksaan.

Checklist dan kategori yang diterima harus ditetapkan oleh pemilik
produk. Checklist ini merupakan pemeriksaan kelayakan pendaftaran, bukan
bukti autentisitas penerbit.

**REV-004 --- Approve** - Reviewer dapat menyetujui submission. - Sistem
meminta konfirmasi sebelum keputusan final. - Reviewer wajib mengisi
catatan jika kebijakan mengharuskannya. - Sistem menyimpan reviewer ID,
timestamp, dan keputusan. - Status berubah menjadi `approved`. - Setelah
approve berhasil, sistem menerbitkan kode unik dan QR Code. - Dokumen
masuk ke daftar dokumen approved milik owner. - Dokumen menjadi kandidat
Automatic Hash Matching.

**REV-005 --- Reject** - Reviewer dapat menolak submission. - Alasan
penolakan wajib diisi. - Sistem mencatat reviewer ID, timestamp, dan
alasan. - Status berubah menjadi `rejected`. - Kode unik dan QR Code
aktif tidak diterbitkan. - Pengguna dapat melihat alasan penolakan. -
Kebijakan pengajuan ulang setelah rejected: TBD.

**REV-006 --- Request revision** - Reviewer dapat meminta perbaikan atau
kelengkapan. - Catatan perbaikan wajib diisi. - Status berubah menjadi
`revision_requested`. - Pengguna dapat memperbaiki dan mengajukan
ulang. - Riwayat submission dan keputusan sebelumnya harus tetap dapat
ditelusuri. - Kebijakan apakah file revisi menggantikan submission atau
membuat submission revision baru: ditentukan pada desain database.

**REV-007 --- Review integrity** - Keputusan review hanya dapat
dilakukan oleh role yang memiliki permission. - Dua reviewer tidak boleh
secara tidak sengaja menimpa keputusan satu sama lain. - Sistem harus
menangani status yang berubah selama reviewer sedang membuka detail. -
Setiap keputusan harus atomik dan diaudit.

### 5.5 Approved Document & Verification Identity

**DOC-APP-001** - Hanya submission approved yang menjadi dokumen
terdaftar. - Sistem menerbitkan kode unik setelah approval. - Sistem
menghasilkan QR Code setelah approval. - Kode/QR terhubung dengan
catatan dokumen approved. - Pengguna hanya dapat melihat identitas
dokumen miliknya.

**DOC-APP-002** - Submission pending, revision requested, atau rejected
tidak boleh ditampilkan sebagai dokumen approved. - Kode/QR aktif tidak
boleh diterbitkan untuk status tersebut.

### 5.6 Verification by Code and QR

**VER-001 --- Code** - Pengguna wajib login. - Pencarian dibatasi dengan
owner ID aktif. - Jika catatan ditemukan, sistem menampilkan status
dokumen. - Jika tidak ditemukan pada akun, sistem menampilkan pesan
generik. - Sistem tidak mengungkapkan kepemilikan akun lain.

**VER-002 --- QR** - QR mengarah ke route internal. - Jika belum login,
pengguna diarahkan ke login dan kembali ke route tujuan yang telah
divalidasi. - Backend memeriksa owner ID. - QR tidak melewati
autentikasi.

### 5.7 Automatic Hash Matching

**HASH-001 --- Temporary upload** - Pengguna wajib login. - Sistem
menerima PDF untuk pemeriksaan. - Sistem memvalidasi file dan menghitung
SHA-256 di backend. - File pemeriksaan diperlakukan sebagai file
sementara. - File pemeriksaan tidak otomatis menjadi submission atau
dokumen baru.

**HASH-002 --- Search scope** - Sistem mencari hash pada seluruh dokumen
milik owner aktif yang telah disetujui. - Query harus dibatasi dengan
owner ID. - Dokumen pending, revision requested, dan rejected tidak
menjadi kandidat. - Dokumen yang pernah approved lalu revoked dapat
ditampilkan sebagai hasil cocok dengan status revoked.

**HASH-003 --- Single match** - Jika satu catatan cocok, sistem
menampilkan catatan tersebut.

**HASH-004 --- Multiple matches** - Jika beberapa catatan cocok, seluruh
catatan ditampilkan. - Hasil diurutkan dengan aturan konsisten, misalnya
waktu registrasi terbaru terlebih dahulu.

**HASH-005 --- No match** - Jika tidak ada kecocokan, sistem menampilkan
"Tidak ditemukan kecocokan pada dokumen akun Anda". - Sistem tidak boleh
menyatakan file palsu atau tidak resmi.

**HASH-006 --- Cleanup** - File sementara dihapus setelah proses
selesai. - Jika proses gagal, mekanisme cleanup berkala harus menangani
file yang tertinggal. - Retensi maksimum file sementara: TBD;
rekomendasi penghapusan segera setelah pemrosesan selesai.

**HASH-007 --- Meaning** - Hash cocok menunjukkan kesamaan byte file. -
Hash tidak membuktikan kebenaran isi, identitas pembuat, kewenangan
penerbit, atau keabsahan hukum. - UI menjelaskan bahwa perubahan
metadata internal PDF dapat mengubah hash.

### 5.8 Document Status

Status submission/document: - `pending_review` - `revision_requested` -
`rejected` - `approved` - `revoked`

Aturan: - `approved` adalah satu-satunya status yang dapat memperoleh
kode/QR aktif. - `revoked` hanya dapat terjadi setelah approval. -
Revocation policy dan pihak yang berwenang: TBD. - Masa berlaku/expired:
di luar keputusan MVP sampai kebijakan ditetapkan.

Status review dan hasil hash harus disimpan terpisah.

### 5.9 Audit Trail

MUST mencatat: - Submission created. - Upload rejected by technical
validation. - Reviewer opened/accessed submission sesuai kebijakan. -
Approved. - Rejected. - Revision requested. - Resubmitted. -
Verification by code/QR. - Automatic hash matching dan hasilnya. -
Revocation jika diterapkan.

Audit event minimal mencakup actor ID, submission/document ID jika
relevan, action, timestamp server, result, dan metadata minimum. Jangan
menyimpan password, token, atau isi file di log.

## 7. Aturan Bisnis

  ---------------------------------------------------------------------
  ID                                 Aturan
  ---------------------------------- ----------------------------------
  BR-001                             Pengajuan dokumen memerlukan
                                     autentikasi

  BR-002                             Setiap submission memiliki owner
                                     ID

  BR-003                             Submission baru berstatus pending
                                     review

  BR-004                             Reviewer berwenang melakukan
                                     keputusan review

  BR-005                             Keputusan review dan alasannya
                                     dicatat

  BR-006                             Hanya approved yang menjadi
                                     dokumen terdaftar

  BR-007                             Kode unik dan QR aktif diterbitkan
                                     setelah approval

  BR-008                             Pengguna hanya mengakses dokumen
                                     miliknya

  BR-009                             Reviewer hanya mengakses pengajuan
                                     sesuai scope

  BR-010                             Hash dihitung backend

  BR-011                             Automatic Hash Matching mencari
                                     seluruh dokumen owner aktif yang
                                     pernah approved

  BR-012                             Multiple matches menampilkan
                                     seluruh catatan cocok

  BR-013                             File pemeriksaan tidak otomatis
                                     didaftarkan

  BR-014                             Hash cocok bukan bukti
                                     keaslian/legalitas

  BR-015                             File dan metadata disimpan privat

  BR-016                             Akses dan keputusan reviewer
                                     diaudit
  ---------------------------------------------------------------------

## 8. Kebutuhan Non-Fungsional

### Security

-   HTTPS/TLS untuk produksi.
-   Role-based access control dan ownership checks di backend.
-   Private storage untuk semua file.
-   Preview admin melalui mekanisme terautentikasi dan terotorisasi.
-   Validasi upload berlapis.
-   Rate limiting untuk autentikasi dan endpoint pemeriksaan.
-   CSRF protection jika menggunakan cookie-based session.
-   Proteksi XSS, SQL injection, dan kontrol keamanan web relevan.
-   Secret management untuk kredensial.
-   Prinsip least privilege.
-   Audit trail keputusan review.

### Privacy

-   File tidak tersedia melalui public URL.
-   Pengguna hanya melihat file sendiri.
-   Reviewer hanya melihat pengajuan sesuai kewenangan.
-   Log tidak menyimpan konten dokumen.
-   Retensi dan penghapusan data harus ditetapkan.

### Reliability

-   Submission tidak dianggap berhasil sebelum file dan metadata
    tersimpan konsisten.
-   Keputusan review harus atomik.
-   Kode/QR tidak diterbitkan sebelum approval berhasil.
-   File sementara harus dibersihkan.
-   Kegagalan notifikasi tidak boleh membatalkan keputusan review yang
    sudah tersimpan.

### Usability

-   UI responsif.
-   Status pengajuan terlihat jelas.
-   Alasan penolakan/revisi mudah ditemukan.
-   Reviewer dapat melihat metadata dan dokumen tanpa navigasi
    berlebihan.
-   Setiap proses memiliki loading, success, empty, validation error,
    dan server error state.

## 9. UI States

### User submission

-   Draft/ready to submit jika fitur draft disetujui.
-   Uploading.
-   Processing.
-   Pending review.
-   Revision requested.
-   Rejected.
-   Approved.
-   Error.

### Admin review

-   Queue loading.
-   Queue empty.
-   Submission detail loading.
-   Preview loading.
-   Ready for review.
-   Approve confirmation.
-   Reject reason required.
-   Revision note required.
-   Decision success.
-   Decision conflict/stale status.
-   Access denied.

### Hash verification

-   Idle.
-   Uploading.
-   Validating.
-   Hashing.
-   Searching.
-   Single match.
-   Multiple matches.
-   No match.
-   Error.

## 10. Kriteria Penerimaan MVP

### Submission

-   [ ] Pengguna login dapat mengajukan PDF.
-   [ ] File tidak valid ditolak.
-   [ ] Hash dihitung di backend.
-   [ ] Submission tersimpan dengan owner ID dari sesi.
-   [ ] Status awal adalah pending review.
-   [ ] Kode dan QR aktif belum diterbitkan.

### Admin review

-   [ ] Reviewer dapat membuka antrean.
-   [ ] Reviewer dapat melihat detail dan preview submission sesuai
    permission.
-   [ ] Reviewer dapat approve.
-   [ ] Reviewer dapat reject dengan alasan.
-   [ ] Reviewer dapat request revision dengan catatan.
-   [ ] Keputusan dan reviewer ID tercatat.
-   [ ] Pengguna dapat melihat status dan catatan keputusan.
-   [ ] Pengguna lain tidak dapat melihat submission tersebut.

### Approval

-   [ ] Approval mengubah status menjadi approved.
-   [ ] Kode unik dan QR dibuat setelah approval.
-   [ ] Dokumen approved tampil pada daftar dokumen pemilik.
-   [ ] Hanya dokumen approved menjadi kandidat hash matching.

### Automatic Hash Matching

-   [ ] File identik ditemukan pada dokumen approved milik owner aktif.
-   [ ] Pencarian tidak mencakup akun lain.
-   [ ] Beberapa catatan cocok ditampilkan semua.
-   [ ] Dokumen revoked dapat ditampilkan dengan status revoked.
-   [ ] Pending, revision requested, dan rejected tidak menjadi
    kandidat.
-   [ ] File pemeriksaan tidak otomatis didaftarkan.
-   [ ] File sementara dibersihkan.

### Security

-   [ ] Pengguna tidak dapat mengakses submission akun lain.
-   [ ] Reviewer tanpa permission tidak dapat membuka file.
-   [ ] Kode/QR tidak melewati autentikasi.
-   [ ] Error tidak membocorkan metadata.
-   [ ] Semua keputusan review diaudit.

## 11. Keputusan yang Masih Terbuka

1.  Kriteria review: kelayakan pendaftaran atau autentikasi keaslian
    penerbit?
2.  Apakah reviewer dan platform admin dipisah?
3.  Apakah reviewer dapat mengunduh atau hanya preview?
4.  Apakah email wajib diverifikasi?
5.  Batas ukuran file dan kuota.
6.  Field metadata wajib.
7.  Target waktu review.
8.  Aturan pengajuan ulang setelah rejected.
9.  Siapa yang dapat revoke.
10. Kebijakan retensi dan penghapusan file.
11. Apakah admin harus memberi alasan untuk approval juga?
12. Apakah pengajuan memiliki kategori dokumen yang dibatasi?

## 12. Instruksi Implementasi

Codex harus membaca `PROJECT_BRIEF.md` dan dokumen kebutuhan ini. Jangan
mengimplementasikan fitur yang masih TBD tanpa menyampaikan opsi dan
meminta keputusan. Implementasi harus dilakukan bertahap, dengan
pengujian khusus untuk role reviewer, owner-only access, status
approval, dan keamanan file.

## 13. Referensi Rancangan Admin Workspace

Rancangan halaman Overview, Review Queue, Review Detail, Review History,
responsive behavior, UI states, dan acceptance criteria tersedia pada
`ADMIN_DASHBOARD_SPEC.md`.

Codex harus membaca dokumen tersebut bersama `DOCUMENT_REVIEW_POLICY.md`
sebelum membangun area admin.

## 14. Kebutuhan Kategori dan Cakupan Dokumen

**CAT-001** - Sistem MUST menerima semua jenis dokumen yang memenuhi
kebijakan platform. - Sistem MUST menyediakan kategori untuk klasifikasi
dokumen. - Kategori MUST NOT menjadi whitelist tertutup yang otomatis
menolak dokumen hanya karena jenisnya belum terdaftar. - Form pengajuan
MUST menyediakan pilihan `Lainnya`. - Jika kategori `Lainnya` dipilih,
pengguna SHOULD dapat mengisi nama/jenis dokumen secara singkat. -
Kategori dan nama jenis dokumen harus tampil pada detail submission dan
admin review.

**CAT-002** - Daftar kategori awal dapat berisi kelompok umum seperti
Pendidikan, Pekerjaan, Organisasi, Administrasi, Keuangan, Kesehatan,
Hukum, Pribadi, dan Lainnya. - Daftar contoh tersebut merupakan usulan
klasifikasi, bukan daftar kategori final atau pembatas penerimaan. -
Kategori yang berkaitan dengan informasi sensitif memerlukan perhatian
khusus pada akses, retensi, dan privasi.

**POL-001** - Platform MUST memiliki kebijakan konten yang menjelaskan
dokumen yang dilarang. - Platform MUST menolak file berbahaya dan file
yang tidak lolos validasi teknis. - Platform SHOULD menyediakan
mekanisme pelaporan dokumen yang diduga melanggar kebijakan. - Detail
kebijakan konten dan retensi perlu disetujui sebelum produksi.

## 15. Finalisasi Metadata Pengajuan

Struktur metadata berikut telah disetujui untuk MVP:

  -----------------------------------------------------------------------
  Field                   Required                Aturan
  ----------------------- ----------------------- -----------------------
  Nama dokumen            Ya                      Nama/judul yang mudah
                                                  dikenali

  Kategori dokumen        Ya                      Kategori klasifikasi

  Jenis dokumen           Kondisional             Wajib jika kategori
                                                  `Lainnya` dipilih

  File PDF                Ya                      Harus lolos validasi
                                                  teknis

  Tanggal dokumen         Tidak                   Boleh kosong

  Instansi penerbit       Tidak                   Boleh kosong

  Deskripsi               Tidak                   Boleh kosong

  Persetujuan kebijakan   Ya                      Pengguna harus
  platform                                        menyetujui sebelum
                                                  mengajukan
  -----------------------------------------------------------------------

**SUB-META-001** - Form pengajuan MUST menggunakan field di atas. - Form
tidak boleh mewajibkan tanggal atau instansi penerbit. - Jika kategori
`Lainnya` dipilih, field Jenis Dokumen menjadi wajib. - Persetujuan
kebijakan harus berupa checkbox yang tidak tercentang secara default. -
Sistem menyimpan waktu persetujuan dan versi kebijakan yang disetujui. -
Metadata yang disimpan harus terhubung dengan submission dan owner ID. -
Perubahan metadata setelah approval tidak boleh mengubah catatan dokumen
approved secara diam-diam; perubahan material harus melalui proses
revisi/review sesuai kebijakan.

## 16. Design and Theme Requirements

**UI-001** - Produk MUST mendukung Light Mode dan Dark Mode. - Produk
SHOULD menyediakan pilihan System preference. - Pilihan tema harus
konsisten di User Workspace dan Admin Workspace.

**UI-002** - Implementasi visual MUST mengikuti `DESIGN_SYSTEM.md`. -
Warna komponen MUST menggunakan semantic tokens dari
`DESIGN_TOKENS.css`. - Jangan hardcode warna berbeda-beda pada setiap
komponen.

**UI-003** - Font UI menggunakan Geist Sans sebagai pilihan awal. - Data
teknis seperti hash, verification code, submission ID, dan timestamp
menggunakan Geist Mono. - Fallback fonts harus tersedia.

**UI-004** - Layout harus responsif pada desktop, tablet, dan mobile. -
Admin Review Detail desktop menggunakan layout preview + review panel;
mobile menggunakan susunan vertikal. - Status harus memiliki label teks,
bukan warna saja.

**UI-005** - Antarmuka tidak boleh menggunakan komponen dekoratif yang
tidak mendukung tugas pengguna. - Setiap halaman harus memiliki loading,
empty, error, dan success state yang sesuai.

Dokumen acuan: - `DESIGN_REFERENCE.md` - `DESIGN_SYSTEM.md` -
`DESIGN_TOKENS.css`


---

## ADDENDUM v1.0 — Requirements Reconciliation

The later approved metadata structure in section 15 and `UPLOAD_FORM_SPEC.md` supersedes earlier TBD wording in section 5.2. No document number field is part of the MVP form. Document date, issuing institution, and description are optional.

The confirmed access rule is owner-only for all three verification methods. QR and unique code do not bypass login or ownership checks. Hash matching is limited to current approved document versions owned by the active account, including previously approved records that are now revoked (displayed as revoked).

The four mandatory review criteria are completeness, readability, category suitability, and registration eligibility. Review decisions must be atomic and immutable. See `BUSINESS_LOGIC_AND_STATE_MACHINE.md` and `API_SPECIFICATION.md`.

Recommended defaults and unresolved decisions are maintained in `DECISION_REGISTER.md`.
