# UPLOAD_FORM_SPEC.md

## Document Verification Platform --- Document Submission Form

**Versi:** 0.2\
**Status:** Struktur metadata disetujui untuk MVP

------------------------------------------------------------------------

## 1. Tujuan

Dokumen ini menjadi acuan desain dan implementasi formulir pengajuan
dokumen. Platform menerima semua jenis dokumen yang memenuhi kebijakan
penggunaan. Kategori digunakan untuk klasifikasi, bukan whitelist
tertutup.

Format file MVP: PDF.

## 2. Field Form

  ---------------------------------------------------------------------
  No.           Field         Input         Wajib         Perilaku
  ------------- ------------- ------------- ------------- -------------
  1             Nama dokumen  Text input    Ya            Nama/judul
                                                          dokumen yang
                                                          mudah
                                                          dikenali

  2             Kategori      Select        Ya            Memilih
                dokumen                                   kategori
                                                          klasifikasi

  3             Jenis dokumen Text input    Kondisional   Ditampilkan
                                                          dan
                                                          diwajibkan
                                                          jika kategori
                                                          `Lainnya`

  4             File PDF      File upload   Ya            Hanya PDF
                                                          yang lolos
                                                          validasi
                                                          teknis

  5             Tanggal       Date picker   Tidak         Boleh kosong
                dokumen                                   

  6             Instansi      Text input    Tidak         Boleh kosong
                penerbit                                  

  7             Deskripsi     Textarea      Tidak         Boleh kosong

  8             Persetujuan   Checkbox      Ya            Tidak
                kebijakan                                 dicentang
                                                          secara
                                                          default
  ---------------------------------------------------------------------

## 3. Kategori

-   Kategori adalah alat klasifikasi.
-   Kategori bukan daftar tertutup.
-   Pilihan `Lainnya` wajib tersedia.
-   Jika `Lainnya` dipilih, pengguna harus mengisi jenis dokumen.
-   Kategori awal dapat disiapkan sebagai data konfigurasi, tetapi
    daftar final dapat berkembang.
-   Pengguna tidak boleh ditolak hanya karena jenis dokumennya belum
    mempunyai kategori khusus.

## 4. Aturan File

-   Format yang diterima pada MVP adalah PDF.
-   Validasi dilakukan di backend, bukan hanya berdasarkan ekstensi.
-   Sistem memeriksa MIME type, signature/magic bytes, struktur PDF,
    ukuran, dan kemampuan pemrosesan.
-   Batas ukuran maksimum masih harus ditetapkan.
-   File terenkripsi/password-protected: kebijakan masih perlu
    ditetapkan.
-   File yang gagal validasi tidak boleh masuk review queue.

## 5. Persetujuan Kebijakan

Checkbox persetujuan: - wajib dicentang secara aktif oleh pengguna; -
tidak boleh tercentang secara default; - mengarah ke halaman/modal
kebijakan yang dapat dibaca; - sistem menyimpan timestamp persetujuan
dan versi kebijakan; - tanpa persetujuan, tombol submit tidak dapat
diproses.

Contoh label:

"Saya menyatakan bahwa saya berhak mengajukan dokumen ini dan telah
membaca serta menyetujui Kebijakan Penggunaan Platform dan Kebijakan
Privasi."

Teks final harus ditinjau dari sisi hukum dan privasi sebelum produksi.

## 6. Perilaku Form

### Initial

-   Field wajib ditandai dengan jelas.
-   Field opsional diberi label `Opsional`.
-   Tampilkan keterangan format PDF.
-   Tampilkan ringkasan empat aspek pemeriksaan administratif.
-   Tampilkan tautan kebijakan.

### Conditional

-   Ketika kategori `Lainnya` dipilih, field Jenis Dokumen muncul.
-   Ketika kategori lain dipilih, field Jenis Dokumen disembunyikan dan
    nilainya dibersihkan agar tidak tersimpan sebagai data yang
    membingungkan.

### Upload

-   Tampilkan nama file, ukuran, dan status upload.
-   Sediakan aksi mengganti atau menghapus file sebelum submit.
-   Tampilkan error yang spesifik jika format atau file tidak valid.
-   Jangan menganggap file berhasil tersimpan hanya karena browser
    selesai memilih file; tunggu respons backend.

### Submit

-   Tombol utama: `Ajukan Dokumen`.
-   Tombol dinonaktifkan jika field wajib belum valid, file belum lolos
    pemeriksaan awal, atau persetujuan belum dicentang.
-   Backend tetap melakukan validasi ulang.
-   Setelah berhasil, tampilkan nomor pengajuan dan status
    `Pending Review`.
-   QR Code dan kode verifikasi belum diterbitkan pada tahap ini.

## 7. Wireframe Low-Fidelity

``` text
┌───────────────────────────────────────────────────────────────┐
│ Ajukan Dokumen                                                │
│ Lengkapi informasi berikut untuk mengajukan dokumen.          │
│                                                               │
│ Nama Dokumen *                                                │
│ [_________________________________________________________]  │
│                                                               │
│ Kategori Dokumen *                                            │
│ [ Pilih kategori                                      ▾ ]    │
│                                                               │
│ Jenis Dokumen * (muncul jika memilih Lainnya)                 │
│ [_________________________________________________________]  │
│                                                               │
│ File PDF *                                                    │
│ ┌─────────────────────────────────────────────────────────┐  │
│ │              Pilih atau tarik file PDF                   │  │
│ │              Format PDF                                  │  │
│ └─────────────────────────────────────────────────────────┘  │
│                                                               │
│ Tanggal Dokumen (Opsional)                                    │
│ [ DD / MM / YYYY ]                                            │
│                                                               │
│ Instansi Penerbit (Opsional)                                  │
│ [_________________________________________________________]  │
│                                                               │
│ Deskripsi (Opsional)                                          │
│ [_________________________________________________________]  │
│ [_________________________________________________________]  │
│                                                               │
│ Pemeriksaan administratif:                                    │
│ Kelengkapan · Keterbacaan · Kategori · Kelayakan              │
│                                                               │
│ [ ] Saya menyetujui Kebijakan Penggunaan dan Kebijakan Privasi│
│                                                               │
│                                  [Ajukan Dokumen]             │
└───────────────────────────────────────────────────────────────┘
```

## 8. Setelah Pengajuan

Tampilkan: - status `Pending Review`; - nomor pengajuan; - nama
dokumen; - tanggal pengajuan; - informasi bahwa dokumen sedang menunggu
pemeriksaan admin; - penjelasan bahwa kode dan QR baru tersedia setelah
disetujui.

## 9. UI States

-   Empty form.
-   Validation error.
-   File selected.
-   Uploading.
-   File validation failed.
-   Submission processing.
-   Submission success.
-   Submission failed.
-   Consent required.
-   `Lainnya` selected / custom document type required.

## 10. Accessibility dan Responsive

-   Label harus terhubung dengan input.
-   Error ditampilkan dekat field terkait.
-   Form dapat digunakan dengan keyboard.
-   Area upload memiliki alternatif tombol pilih file.
-   Pada mobile, field disusun satu kolom.
-   Tombol submit mudah ditemukan tetapi tidak menutupi konten.
-   Jangan mengandalkan warna saja untuk menandai error atau status.

## 11. Acceptance Criteria

-   [ ] Semua field sesuai struktur yang disetujui.
-   [ ] Field wajib dan opsional dibedakan.
-   [ ] Jenis Dokumen hanya wajib ketika `Lainnya` dipilih.
-   [ ] File PDF divalidasi di backend.
-   [ ] Persetujuan kebijakan wajib dan tidak dicentang otomatis.
-   [ ] Timestamp dan versi kebijakan persetujuan disimpan.
-   [ ] Submission sukses menghasilkan nomor pengajuan dan status
    pending review.
-   [ ] QR dan kode belum tersedia sebelum approval.
-   [ ] Form responsif desktop dan mobile.


---

## ADDENDUM v1.0 — Upload Technical Handling

The approved metadata fields remain unchanged. The application must not add a document number field or make optional metadata mandatory.

The maximum PDF size is configurable and must not be hardcoded into the UI. The recommended initial value is 20 MiB, pending owner approval. Password-protected PDF handling is also pending; the recommended MVP default is to reject encrypted PDFs with a clear message because the reviewer must be able to inspect the file.

File validation, SHA-256 calculation, private storage, malware scanning, and cleanup are specified in `TECHNICAL_ARCHITECTURE.md` and `SECURITY_ARCHITECTURE.md`.
