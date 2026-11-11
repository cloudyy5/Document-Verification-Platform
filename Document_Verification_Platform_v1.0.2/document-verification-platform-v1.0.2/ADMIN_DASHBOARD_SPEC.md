# ADMIN_DASHBOARD_SPEC.md

## Document Verification Platform --- Admin Workspace

**Versi:** 0.3\
**Status:** Draft rancangan UX dan fungsional dashboard administrator\
**Acuan:** `DOCUMENT_REVIEW_POLICY.md` v0.2, `PRODUCT_REQUIREMENTS.md`,
`SITEMAP.md`

------------------------------------------------------------------------

## 1. Tujuan Dashboard

Admin Workspace adalah area kerja khusus untuk memeriksa pengajuan
dokumen. Antarmuka harus membantu reviewer menyelesaikan pemeriksaan
secara teliti dan konsisten, bukan sekadar menampilkan statistik.

Prinsip utama: - Queue-first: antrean pengajuan menjadi pusat
pekerjaan. - Review-focused: preview dokumen dan checklist mudah
digunakan. - Decision-safe: keputusan penting memerlukan konfirmasi dan
alasan yang sesuai. - Traceable: keputusan dan aktivitas dapat
ditelusuri. - Privacy-first: file hanya tersedia bagi reviewer
berwenang. - Responsive: alur inti dapat digunakan pada desktop dan
mobile.

## 2. Pengguna dan Permission

### Document Reviewer

Dapat: - melihat review queue sesuai permission; - membuka submission
dan preview privat; - mengisi checklist; - approve, request revision,
atau reject; - melihat riwayat review yang menjadi kewenangannya.

### Platform Administrator

Kewenangan manajemen akun, role, konfigurasi, dan semua pengajuan masih
perlu ditetapkan. Untuk MVP, satu akun dapat memiliki permission
reviewer sekaligus administrator, tetapi permission dipisahkan secara
logis.

Backend wajib memeriksa permission pada setiap endpoint. Menyembunyikan
menu pada frontend tidak cukup.

## 3. Struktur Navigasi

Sidebar desktop: 1. Overview 2. Review Queue 3. Review History

Bagian bawah: - Profile / Account - Sign out

Jika kelak fitur pengelolaan platform disetujui, menu User Management
dan Settings dapat ditambahkan. Jangan memasukkannya sebagai fitur aktif
sebelum kebijakannya ditetapkan.

Header: - Breadcrumb atau konteks halaman. - Judul halaman. - Search
submission ID atau judul dokumen jika diperlukan. - Profil reviewer.

Badge pada Review Queue menunjukkan jumlah pengajuan yang menunggu
review; angka harus berasal dari data aktual.

## 4. Halaman 1 --- Overview

### Tujuan

Memberikan ringkasan beban kerja dan mengarahkan reviewer ke pengajuan
yang perlu diperiksa.

### Susunan konten

1.  Page heading: `Review Workspace`.
2.  Ringkasan operasional:
    -   Awaiting Review.
    -   Revision Resubmitted.
    -   Reviewed Today.
3.  Bagian utama: `Needs Your Attention`.
4.  Daftar pengajuan terlama atau paling lama menunggu.
5.  Panel ringkas `Review Standard` yang mengingatkan empat aspek
    pemeriksaan.
6.  Link ke Review Queue dan Review History.

### Wireframe desktop konseptual

``` text
┌──────────────────────────────────────────────────────────────────────┐
│ BRAND                 Search submissions              Reviewer ▾    │
├───────────────────┬──────────────────────────────────────────────────┤
│                   │ Review Workspace                                 │
│ Overview          │ Review the documents waiting for your decision. │
│ Review Queue  12  │                                                  │
│ Review History    │ ┌────────────┐ ┌────────────┐ ┌───────────────┐ │
│                   │ │ Awaiting   │ │ Revision   │ │ Reviewed      │ │
│                   │ │ Review     │ │ Resubmitted│ │ Today         │ │
│                   │ └────────────┘ └────────────┘ └───────────────┘ │
│                   │                                                  │
│                   │ Needs Your Attention              View all →    │
│                   │ ┌──────────────────────────────────────────────┐ │
│                   │ │ Document     Category  Submitted   Action   │ │
│                   │ │ ...          ...       ...         Review   │ │
│                   │ │ ...          ...       ...         Review   │ │
│                   │ └──────────────────────────────────────────────┘ │
│                   │                                                  │
│                   │ Review Standard                                  │
│                   │ Completeness · Readability · Category · Eligibility│
└───────────────────┴──────────────────────────────────────────────────┘
```

### Perilaku

-   Ringkasan hanya menampilkan data aktual.
-   Jika tidak ada pengajuan, tampilkan empty state yang mengarahkan ke
    Review Queue.
-   Tidak perlu grafik tren pada MVP kecuali ada kebutuhan operasional
    yang terbukti.
-   Prioritaskan pengajuan tertua terlebih dahulu untuk mencegah antrean
    lama terabaikan.

## 5. Halaman 2 --- Review Queue

### Tujuan

Menampilkan seluruh submission yang menunggu keputusan atau masuk
kembali setelah revisi.

### Elemen

-   Page heading: `Review Queue`.
-   Tab/filter status:
    -   Pending Review.
    -   Revision Resubmitted.
-   Search berdasarkan submission ID atau judul.
-   Filter kategori untuk membantu klasifikasi; kategori `Lainnya` dan
    jenis dokumen yang diisi pengguna harus tetap dapat dicari.
-   Filter tanggal pengajuan.
-   Sorting: oldest first sebagai default.
-   Tabel atau daftar submission.

### Kolom tabel

  Kolom          Isi
  -------------- ------------------------------------------------
  Document       Judul/nama file dan submission ID
  Category       Kategori yang dipilih pengguna
  Submitted By   Nama tampilan pemohon sesuai kebijakan privasi
  Submitted At   Waktu pengajuan
  Status         Pending Review / Revision Resubmitted
  Action         Open Review

### Wireframe desktop konseptual

``` text
┌──────────────────────────────────────────────────────────────────────┐
│ Review Queue                                                         │
│ Review and process submitted documents.                              │
│                                                                      │
│ [Pending Review 12] [Revision Resubmitted 3]                          │
│ [Search by title or submission ID...] [Category ▾] [Date ▾]          │
│                                                                      │
│ Document          Category     Submitted By    Submitted     Action  │
│ ─────────────────────────────────────────────────────────────────── │
│ Document A        Category A   User 01         09:30 AM      Review  │
│ SUB-0001          ...          ...             31 Oct        →       │
│                                                                      │
│ Document B        Category B   User 02         02:10 PM      Review  │
│ SUB-0002          ...          ...             31 Oct        →       │
│                                                                      │
│ [Previous]                                      Page 1 of N [Next]   │
└──────────────────────────────────────────────────────────────────────┘
```

### Aturan antrean

-   Default sorting: pengajuan tertua lebih dahulu.
-   Filter dan jumlah hasil harus berasal dari backend.
-   Jangan menampilkan isi dokumen atau informasi sensitif pada tabel.
-   Jika reviewer assignment belum diterapkan, antrean dapat menjadi
    shared queue bagi reviewer yang memiliki permission.
-   Assignment dan pembagian beban kerja masih TBD.

## 6. Halaman 3 --- Review Detail

### Tujuan

Menjadi ruang pemeriksaan utama. Reviewer dapat membaca file, melihat
metadata, menyelesaikan checklist empat aspek, dan memberi keputusan.

### Layout desktop

Rekomendasi dua kolom: - Kolom utama sekitar 65--70%: document
preview. - Kolom samping sekitar 30--35%: metadata, checklist, dan
decision panel.

Ukuran proporsi final disesuaikan pada wireframe visual.

### Wireframe desktop konseptual

``` text
┌──────────────────────────────────────────────────────────────────────┐
│ Review Queue / SUB-0001                              Reviewer ▾       │
├──────────────────────────────────────────┬───────────────────────────┤
│ DOCUMENT PREVIEW                         │ REVIEW PANEL              │
│                                          │                           │
│ [−] [100%] [+]       Page 1 of 4         │ Document A                │
│                                          │ Submitted by: User 01     │
│ ┌──────────────────────────────────────┐ │ Category: Category A      │
│ │                                      │ │ Submitted: 31 Oct 09:30   │
│ │             PDF PAGE                 │ │ File: document.pdf        │
│ │                                      │ │ Size: ...                 │
│ │                                      │ │                           │
│ └──────────────────────────────────────┘ │ ADMINISTRATIVE CHECKLIST  │
│                                          │                           │
│                                          │ [ ] Completeness          │
│                                          │ [ ] Readability           │
│                                          │ [ ] Category fit          │
│                                          │ [ ] Registration eligibility│
│                                          │                           │
│                                          │ Reviewer note             │
│                                          │ [Optional / text area]    │
│                                          │                           │
│                                          │ [Request Revision]        │
│                                          │ [Reject] [Approve]        │
└──────────────────────────────────────────┴───────────────────────────┘
```

### Metadata panel

Tampilkan informasi yang diperlukan untuk review: - submission ID; -
judul/nama dokumen; - pemohon; - kategori; - waktu pengajuan; - nama
file; - ukuran file; - jumlah halaman jika tersedia dari parser; -
status pengajuan.

Jangan tampilkan data pribadi yang tidak diperlukan untuk keputusan.

### Document preview

-   PDF ditampilkan dari private storage melalui endpoint terotorisasi.
-   Sediakan zoom, navigasi halaman, dan indikator loading.
-   Jika preview gagal, reviewer tidak boleh approve; reviewer dapat
    meminta penggantian file atau mengikuti prosedur error.
-   Rekomendasi MVP: preview terkontrol, tanpa tombol unduh reviewer
    sampai kebijakan disetujui.
-   Jangan mengklaim preview dapat mencegah screenshot atau perekaman
    layar.

### Administrative checklist

Empat item wajib: 1. Completeness --- Kelengkapan. 2. Readability ---
Keterbacaan. 3. Category Fit --- Kesesuaian kategori. 4. Registration
Eligibility --- Kelayakan pendaftaran.

Setiap item memiliki pilihan: - Pass. - Fail.

Item wajib tidak boleh dibiarkan kosong saat keputusan final dilakukan.
Jika kategori memiliki pengecualian yang disetujui, aturan
`Not Applicable` harus didefinisikan per kategori dan tidak boleh
digunakan bebas.

### Decision rules

-   Approve hanya tersedia jika semua item wajib Pass.
-   Request Revision digunakan jika masalah dapat diperbaiki oleh
    pengguna.
-   Reject digunakan jika submission jelas tidak memenuhi kebijakan dan
    tidak tepat diperbaiki melalui revisi.
-   Reject wajib memiliki alasan.
-   Request Revision wajib memiliki instruksi perbaikan yang spesifik.
-   Approval menyimpan hasil checklist dan reviewer identity.
-   Catatan approval dapat opsional pada MVP, kecuali pemilik produk
    memutuskan wajib.

### Confirmation modal

**Approve** - Tampilkan ringkasan bahwa dokumen akan diterima untuk
didaftarkan. - Jelaskan bahwa kode dan QR akan diterbitkan. - Konfirmasi
eksplisit sebelum keputusan disimpan.

**Request Revision** - Wajib mengisi catatan yang menjelaskan apa yang
harus diperbaiki. - Tampilkan konfirmasi pengiriman catatan kepada
pengguna.

**Reject** - Wajib mengisi alasan penolakan. - Tampilkan konfirmasi
sebelum status berubah.

### Concurrency

Jika submission telah diputuskan oleh reviewer lain ketika halaman masih
terbuka: - jangan menimpa keputusan terbaru; - tampilkan pesan bahwa
status telah berubah; - minta reviewer memuat ulang detail.

## 7. Halaman 4 --- Review History

### Tujuan

Menelusuri keputusan yang telah dibuat dan membantu akuntabilitas.

### Filter

-   Approved.
-   Rejected.
-   Revision Requested.
-   Rentang tanggal.
-   Reviewer, jika lebih dari satu reviewer aktif.
-   Kategori setelah kategori final ditetapkan.

### Kolom

-   Submission ID.
-   Document title.
-   Pemohon.
-   Keputusan.
-   Reviewer.
-   Waktu keputusan.
-   Action: View Record.

Detail riwayat menampilkan: - metadata submission; - hasil checklist; -
keputusan; - catatan reviewer; - waktu keputusan; - riwayat resubmission
yang terkait.

Riwayat tidak boleh diubah atau dihapus melalui UI biasa.

## 8. Responsive Behavior

### Tablet

-   Sidebar dapat dipadatkan menjadi icon navigation.
-   Review detail tetap mempertahankan preview dan panel review, tetapi
    panel dapat menjadi drawer atau tab.

### Mobile

-   Navigasi menjadi drawer atau bottom navigation sesuai hasil
    pengujian.
-   Review Queue menggunakan card list, bukan tabel lebar.
-   Review Detail disusun vertikal:
    1.  ringkasan submission;
    2.  PDF preview;
    3.  metadata;
    4.  checklist;
    5.  decision actions.
-   Decision actions dapat menggunakan sticky bottom action bar, dengan
    ruang aman agar tidak menutupi checklist.
-   Hindari menempatkan approve dan reject berdampingan tanpa label yang
    jelas.

## 9. Visual Direction Awal

Arah desain belum final. Rekomendasi awal: - profesional dan tenang; -
tipografi jelas dengan hierarki kuat; - permukaan netral dan ruang
kosong cukup; - status menggunakan warna secara konsisten, bukan
dekorasi; - preview dokumen menjadi fokus visual utama; - kontrol review
ringkas dan mudah dipindai; - hindari dashboard SaaS generik yang penuh
kartu dan grafik tanpa fungsi.

Warna, font, spacing, radius, icon style, dan komponen final akan
ditentukan di `DESIGN_SYSTEM.md` setelah referensi visual disepakati.

## 10. Komponen UI yang Dibutuhkan

-   AdminSidebar.
-   AdminTopbar.
-   QueueSummary.
-   ReviewQueueTabs.
-   SubmissionTable / SubmissionCard.
-   SubmissionMetadata.
-   PrivatePdfViewer.
-   ReviewChecklist.
-   DecisionPanel.
-   DecisionConfirmationDialog.
-   ReviewerNoteField.
-   StatusBadge.
-   ReviewHistoryTable.
-   EmptyState.
-   LoadingState.
-   ErrorState.
-   Pagination.

## 11. UI States

Overview: - loading; - data available; - empty queue; - error.

Review Queue: - loading; - populated; - no results; - filter empty; -
error.

Review Detail: - loading; - preview loading; - preview ready; - preview
failed; - checklist incomplete; - decision submitting; - decision
success; - stale submission / decision conflict; - access denied.

## 12. Accessibility dan Usability

-   Semua checkbox dan tombol memiliki label yang jelas.
-   Status tidak hanya dibedakan dengan warna.
-   Aksi dapat dijalankan menggunakan keyboard.
-   Modal mengelola fokus dengan benar.
-   Kontras teks dan kontrol harus memadai.
-   Pesan validasi ditempatkan dekat field terkait.
-   Reviewer dapat memahami akibat keputusan sebelum mengonfirmasi.

## 13. Security Requirements

-   Semua halaman admin membutuhkan autentikasi dan role permission.
-   Endpoint preview memeriksa permission reviewer dan scope submission.
-   File tidak boleh berada di public bucket.
-   URL preview bersifat terkontrol dan tidak menjadi akses permanen.
-   Jangan menyimpan isi PDF di browser storage.
-   Audit event mencatat akses dan keputusan sesuai kebijakan.
-   Jangan membocorkan dokumen pengguna lain pada search atau error
    response.
-   Backend memvalidasi ulang status submission sebelum menyimpan
    keputusan.

## 14. Acceptance Criteria

-   [ ] Reviewer dapat membuka Admin Overview.
-   [ ] Ringkasan menunjukkan angka dari data aktual.
-   [ ] Review Queue menampilkan submission yang sesuai permission.
-   [ ] Default antrean mengutamakan submission tertua.
-   [ ] Reviewer dapat mencari dan memfilter submission.
-   [ ] Review Detail menampilkan metadata dan preview privat.
-   [ ] Checklist memiliki empat aspek wajib.
-   [ ] Approve tidak dapat dilakukan jika checklist belum seluruhnya
    lolos.
-   [ ] Request Revision memerlukan catatan.
-   [ ] Reject memerlukan alasan.
-   [ ] Approval menghasilkan status approved dan menerbitkan QR/kode.
-   [ ] Keputusan menyimpan reviewer ID, waktu, dan checklist.
-   [ ] Reviewer tidak dapat mengambil keputusan jika status sudah
    berubah.
-   [ ] Review History menampilkan keputusan yang telah dibuat.
-   [ ] Layout berfungsi pada desktop, tablet, dan mobile.

## 15. Hal yang Belum Diputuskan

1.  Nama dan daftar kategori dokumen.
2.  Metadata wajib per kategori.
3.  Batas ukuran PDF.
4.  Reviewer download atau preview-only.
5.  Reviewer assignment.
6.  Target waktu review.
7.  Apakah perlu second approval.
8.  Apakah reject dapat diajukan ulang.
9.  Role dan fitur Platform Administrator di luar review.
10. Design reference, warna, dan tipografi final.

------------------------------------------------------------------------

**Instruksi Codex:** Gunakan dokumen ini sebagai acuan UX dan perilaku
Admin Workspace. Jangan mengarang kategori, metadata wajib, SLA, atau
permission yang masih TBD. Implementasikan halaman dan state secara
bertahap, serta prioritaskan keamanan file dan otorisasi backend.

## 16. Dukungan Semua Jenis Dokumen

-   Admin Workspace harus mendukung pengajuan dari semua jenis dokumen
    yang memenuhi kebijakan platform.
-   Kategori adalah metadata klasifikasi, bukan daftar tertutup yang
    membatasi penerimaan.
-   Pada review detail, tampilkan kategori dan nama/jenis dokumen yang
    diisi pengguna.
-   Jika kategori `Lainnya` dipilih, reviewer menilai kelayakan dokumen
    berdasarkan empat aspek yang sama.
-   Reviewer tidak boleh menolak hanya karena jenis dokumen belum
    memiliki kategori khusus.
-   Admin dapat menggunakan filter kategori untuk mengelola antrean,
    tetapi filter tidak boleh menyembunyikan submission `Lainnya`.
-   Kebijakan konten terlarang harus tersedia sebagai acuan review;
    reviewer tidak boleh membuat larangan sendiri.


---

## ADDENDUM v1.0 — Admin Scope

The core MVP admin implementation includes Admin Overview, Review Queue, Review Detail, and Review History.

User Management and System Settings remain visual design references only until their permissions and policies are approved. A platform administrator does not automatically receive access to private document previews unless the account also has the reviewer role.

The initial MVP uses a shared reviewer queue as a recommended default; reviewer assignment is deferred. See `DECISION_REGISTER.md`.
