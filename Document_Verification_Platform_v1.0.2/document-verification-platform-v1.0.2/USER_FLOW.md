# USER_FLOW.md

## Document Verification Platform

**Versi:** 0.5\
**Status:** Draft alur pengguna MVP

------------------------------------------------------------------------

## 1. Flow A --- Registrasi dan Login

``` mermaid
flowchart TD
    A[Pengguna membuka website] --> B{Sudah memiliki akun?}
    B -- Tidak --> C[Registrasi]
    C --> D[Isi data akun]
    D --> E{Input valid?}
    E -- Tidak --> C
    E -- Ya --> F[Akun dibuat]
    F --> G[Login]
    B -- Ya --> G
    G --> H{Autentikasi berhasil?}
    H -- Tidak --> I[Pesan gagal]
    I --> G
    H -- Ya --> J[Dashboard sesuai role]
```

## 2. Flow B --- Pengajuan Dokumen oleh Pengguna

``` mermaid
flowchart TD
    A[User Dashboard] --> B[Pilih Ajukan Dokumen]
    B --> C[Isi metadata dan pilih PDF]
    C --> D[Validasi backend]
    D --> E{File valid?}
    E -- Tidak --> F[Tampilkan alasan]
    F --> C
    E -- Ya --> G[Hitung SHA-256]
    G --> H[Simpan ke private storage]
    H --> I[Buat submission dengan owner_id]
    I --> J[Status pending_review]
    J --> K[Konfirmasi pengajuan]
    K --> L[Tampilkan status menunggu review]
```

Aturan: - Owner ID ditetapkan dari sesi backend. - File dan metadata
disimpan secara konsisten. - Pengajuan belum memiliki QR/kode aktif. -
File yang menunggu review hanya dapat diakses pemilik dan reviewer
berwenang.

## 3. Flow C --- Pemeriksaan Administrator

``` mermaid
flowchart TD
    A[Reviewer Dashboard] --> B[Review Queue]
    B --> C[Pilih Submission]
    C --> D[Periksa metadata dan preview PDF]
    D --> E[Gunakan review checklist]
    E --> F{Keputusan reviewer}
    F -- Approve --> G[Konfirmasi approval]
    F -- Reject --> H[Isi alasan penolakan]
    F -- Request revision --> I[Isi catatan perbaikan]
    G --> J[Status approved]
    H --> K[Status rejected]
    I --> L[Status revision_requested]
    J --> M[Generate kode unik dan QR]
    K --> N[Notifikasi pengguna]
    L --> N
    M --> N
    N --> O[Catat keputusan pada audit trail]
```

Aturan: - Reviewer harus memiliki permission. - Reject dan request
revision wajib disertai alasan/catatan. - Approval menerbitkan identitas
verifikasi setelah transaksi berhasil. - Keputusan tidak boleh ditimpa
tanpa mekanisme yang jelas. - Setiap keputusan mencatat reviewer ID dan
timestamp.

## 4. Flow D --- Pengguna Memperbaiki Pengajuan

``` mermaid
flowchart TD
    A[User Dashboard] --> B[Lihat Revision Requested]
    B --> C[Baca catatan reviewer]
    C --> D[Perbaiki metadata atau file]
    D --> E[Ajukan ulang]
    E --> F[Validasi dan hitung ulang hash]
    F --> G[Submission revision baru/terkait]
    G --> H[Pending Review]
    H --> I[Masuk antrean reviewer]
```

Kebijakan apakah revisi memperbarui submission yang sama atau membuat
revision record baru harus diputuskan pada desain database. Riwayat lama
tetap dapat ditelusuri.

## 5. Flow E --- Automatic Hash Matching

``` mermaid
flowchart TD
    A[User Dashboard] --> B[Pilih Periksa Dokumen]
    B --> C[Unggah PDF sementara]
    C --> D[Validasi file]
    D --> E{Valid?}
    E -- Tidak --> F[Tampilkan error]
    F --> C
    E -- Ya --> G[Hitung SHA-256 backend]
    G --> H[Cari pada dokumen owner aktif yang pernah approved]
    H --> I{Jumlah hasil}
    I -- 0 --> J[Tidak ditemukan]
    I -- 1 --> K[Tampilkan satu hasil]
    I -- Lebih dari 1 --> L[Tampilkan seluruh hasil]
    J --> M[Hapus file sementara]
    K --> M
    L --> M
    M --> N[Selesai]
```

Catatan: - Dokumen pending, revision requested, dan rejected bukan
kandidat. - Dokumen yang pernah approved lalu revoked dapat ditampilkan
dengan status revoked. - File pemeriksaan tidak otomatis menjadi
submission. - Pencarian selalu dibatasi dengan owner ID.

## 6. Flow F --- QR dan Kode Unik

``` mermaid
flowchart TD
    A[Owner memindai QR atau memasukkan kode] --> B{Login?}
    B -- Tidak --> C[Login]
    C --> D[Validasi tujuan redirect]
    D --> E[Periksa ownership]
    B -- Ya --> E
    E --> F{Dokumen milik owner?}
    F -- Ya --> G[Tampilkan status dan detail]
    F -- Tidak --> H[Pesan tidak ditemukan/akses tidak tersedia]
```

QR dan kode tidak menggantikan autentikasi.

## 7. Flow G --- Status Pengajuan

``` mermaid
stateDiagram-v2
    [*] --> PendingReview
    PendingReview --> Approved
    PendingReview --> Rejected
    PendingReview --> RevisionRequested
    RevisionRequested --> PendingReview: Resubmitted
    Approved --> Revoked
```

Transisi final perlu mengikuti kebijakan status yang disetujui. Rejected
ke resubmission, jika diperbolehkan, dapat dibuat sebagai pengajuan baru
yang terhubung dengan riwayat sebelumnya.

## 8. UI States

  ---------------------------------------------------------------------
  Area                               State
  ---------------------------------- ----------------------------------
  User submission                    Idle, uploading, processing,
                                     pending, revision requested,
                                     rejected, approved, error

  Admin queue                        Loading, populated, empty, error

  Admin review detail                Loading, preview ready, preview
                                     error, decision submitting,
                                     success, conflict

  Hash matching                      Validating, hashing, searching,
                                     single match, multiple matches, no
                                     match, error

  QR/code                            Login required, searching, found,
                                     not found in account, access
                                     denied
  ---------------------------------------------------------------------

## 9. Prinsip UX

-   Status pengajuan terlihat di dashboard pengguna.
-   Alasan reject dan revision request harus mudah ditemukan.
-   Reviewer dapat melihat metadata dan preview tanpa berpindah terlalu
    banyak halaman.
-   Tombol approve, reject, dan request revision dibedakan dengan jelas.
-   Reject dan request revision memerlukan catatan.
-   Pengguna diberi tahu bahwa QR dan kode hanya diterbitkan setelah
    approval.
-   UI tidak menyebut approval administratif sebagai bukti keaslian
    hukum.

## 10. Pemilihan Kategori Fleksibel

1.  Pengguna memilih kategori yang paling menggambarkan dokumen.
2.  Jika kategori belum tersedia, pengguna memilih `Lainnya`.
3.  Pengguna mengisi jenis dokumen secara singkat jika memilih
    `Lainnya`.
4.  Reviewer menilai kesesuaian kategori dan kelayakan dokumen tanpa
    membatasi jenis dokumen pada daftar kategori tertutup.

## 11. Metadata Form Pengajuan --- Final MVP

Form pengajuan berisi: 1. Nama dokumen --- wajib. 2. Kategori dokumen
--- wajib. 3. Jenis dokumen --- wajib hanya jika kategori `Lainnya`. 4.
File PDF --- wajib. 5. Tanggal dokumen --- opsional. 6. Instansi
penerbit --- opsional. 7. Deskripsi --- opsional. 8. Persetujuan
kebijakan platform --- wajib dan tidak dicentang secara default.

Setelah validasi berhasil, pengguna mengirim pengajuan dan menerima
nomor pengajuan serta status `pending_review`.
