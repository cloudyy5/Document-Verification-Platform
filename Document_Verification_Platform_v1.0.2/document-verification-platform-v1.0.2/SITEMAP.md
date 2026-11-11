# SITEMAP.md

## Document Verification Platform

**Versi:** 0.5\
**Status:** Draft struktur halaman MVP

------------------------------------------------------------------------

## 1. Prinsip Navigasi

-   Halaman publik hanya mencakup informasi produk dan autentikasi jika
    landing page disetujui.
-   Semua fungsi pengguna membutuhkan login.
-   Area reviewer dan administrator dilindungi role-based access
    control.
-   Pengguna hanya melihat pengajuan dan dokumen miliknya.
-   Reviewer hanya melihat pengajuan sesuai permission dan scope.
-   QR Code mengarah ke route internal yang tetap memerlukan login dan
    owner check.

## 2. Sitemap

``` text
DOCUMENT VERIFICATION PLATFORM
│
├── Public / Authentication
│   ├── Landing / Product Information (TBD)
│   ├── Register
│   ├── Login
│   └── Forgot Password (SHOULD)
│
├── User Application [Authenticated: User]
│   ├── Dashboard
│   ├── Submissions
│   │   ├── My Submissions
│   │   ├── Submit Document
    │   ├── Flexible Category / Other
│   │   └── Submission Detail
│   │       ├── Submission Metadata
│   │       ├── Review Status
│   │       ├── Reviewer Notes
│   │       └── Resubmit / Revision
│   ├── Approved Documents
│   │   ├── My Documents
│   │   └── Document Detail
│   │       ├── Metadata
│   │       ├── Verification Code
│   │       ├── QR Code
│   │       └── Activity History
│   ├── Verify
│   │   ├── Verify by Code
│   │   └── Verify by PDF Upload
│   │       ├── Single Match
│   │       ├── Multiple Matches
│   │       └── No Match
│   ├── Activity
│   └── Account
│       ├── Profile
│       └── Security (TBD)
│
└── Admin Application [Role protected]
    ├── Admin Overview
    ├── Review Queue
    │   ├── Pending Review
    │   ├── Revision Resubmissions
    │   └── Review History
    ├── Review Detail
    │   ├── Document Preview
    │   ├── Submission Metadata
    │   ├── Review Checklist (4 administrative criteria)
    │   ├── Approve
    │   ├── Reject
    │   └── Request Revision
    ├── User Management (TBD)
    ├── Reviewer Management (TBD)
    ├── Platform Settings (TBD)
    └── Admin Audit Log
```

## 3. Navigasi Pengguna

Desktop: - Dashboard - Submissions - My Documents - Verify Document -
Activity - Profile

Aksi utama: - Submit Document - Check PDF

Mobile: - Dashboard - Submissions/Documents - Verify - Activity -
Profile

Bentuk bottom navigation atau drawer diputuskan setelah wireframe.

## 4. Navigasi Reviewer

-   Overview
-   Review Queue
-   Review History
-   Profile

Aksi utama: - Open Submission - Preview Document - Approve - Reject -
Request Revision

Reviewer tidak memerlukan menu pengelolaan seluruh dokumen pengguna
kecuali ada permission khusus yang disetujui.

## 5. Tujuan Halaman

  -----------------------------------------------------------------------
  Halaman                 Tujuan                  Elemen
  ----------------------- ----------------------- -----------------------
  Register/Login          Autentikasi             Form, validasi, bantuan

  User Dashboard          Ringkasan akun          Submission status,
                                                  document count,
                                                  activity

  My Submissions          Memantau pengajuan      Daftar, status, filter

  Submit Document         Mengajukan file         Metadata, PDF upload,
                                                  checklist

  Submission Detail       Melihat hasil review    Status, catatan
                                                  reviewer, resubmit

  My Documents            Mengelola dokumen       Daftar, pencarian,
                          approved                filter

  Document Detail         Melihat identitas       Metadata, QR, kode,
                          dokumen                 aktivitas

  Verify by Code          Mencari dokumen sendiri Input kode, hasil

  Verify by PDF           Automatic Hash Matching Upload, progress, hasil

  Admin Overview          Ringkasan pekerjaan     Pending count, queue
                          reviewer                summary

  Review Queue            Memilih pengajuan       Filter, sorting,
                                                  pemohon, tanggal

  Review Detail           Meninjau pengajuan      Preview, metadata,
                                                  checklist, keputusan

  Review History          Menelusuri keputusan    Reviewer, keputusan,
                                                  timestamp

  Admin Audit Log         Audit tindakan admin    Actor, action, target,
                                                  waktu
  -----------------------------------------------------------------------

## 6. Contoh Route Konseptual

User: - `/register` - `/login` - `/dashboard` - `/submissions` -
`/submissions/new` - `/submissions/:submissionId` - `/documents` -
`/documents/:documentId` - `/verify/code` -
`/verify/qr/:verificationCode` - `/verify/file` - `/activity` -
`/profile`

Admin: - `/admin` - `/admin/review-queue` -
`/admin/review-queue/:submissionId` - `/admin/review-history` -
`/admin/audit-log`

Route final mengikuti framework yang dipilih. Backend tetap wajib
memeriksa role, scope, dan owner ID.

## 7. Hal yang Belum Diputuskan

1.  Apakah landing page publik masuk MVP?
2.  Apakah reviewer dan platform admin role terpisah?
3.  Apakah reviewer queue mendukung assignment ke reviewer tertentu?
4.  Apakah admin overview membutuhkan grafik atau cukup antrean dan
    angka ringkas?
5.  Apakah reviewer dapat mengunduh file atau hanya preview?
6.  Apakah admin user management masuk MVP?
7.  Apakah menu activity dipisah dari detail submission/document?

## 8. Halaman Prioritas untuk Wireframe

User: 1. Login dan registrasi. 2. Dashboard. 3. My Submissions. 4.
Submit Document. 5. Submission Detail dengan status dan catatan review.
6. My Documents. 7. Document Detail dengan QR/kode. 8. Verify by PDF dan
hasil satu/beberapa/tidak cocok.

Admin: 9. Admin Overview. 10. Review Queue. 11. Review Detail dengan
preview dan checklist. 12. Approve/reject/request revision confirmation.
13. Review History.

**Catatan:** Sitemap ini belum menetapkan visual final. Visual dan
interaksi akan ditetapkan pada design reference, wireframe, dan design
system.

## 9. Standar Admin Workspace

Admin Workspace terdiri dari empat halaman inti: 1. **Overview:**
ringkasan antrean dan pengajuan yang membutuhkan perhatian. 2. **Review
Queue:** daftar pengajuan yang menunggu pemeriksaan atau masuk kembali
setelah revisi. 3. **Review Detail:** preview privat, metadata,
checklist administratif empat aspek, dan keputusan. 4. **Review
History:** rekam keputusan approve, reject, dan request revision.

Rincian struktur, interaksi, responsive behavior, dan keamanan tersedia
di `ADMIN_DASHBOARD_SPEC.md`.

Standar pemeriksaan administratif ditetapkan pada
`DOCUMENT_REVIEW_POLICY.md` v0.2.

## 10. Cakupan Kategori

Form pengajuan menyediakan kategori untuk klasifikasi, dengan pilihan
`Lainnya`. Kategori tidak menjadi whitelist tertutup karena platform
menerima semua jenis dokumen yang memenuhi kebijakan. Jika pengguna
memilih `Lainnya`, pengguna dapat mengisi jenis dokumen secara singkat.
