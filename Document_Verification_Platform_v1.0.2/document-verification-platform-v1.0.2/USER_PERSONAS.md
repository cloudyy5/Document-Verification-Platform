# USER_PERSONAS.md

## Document Verification Platform

**Versi:** 0.4\
**Status:** Draft persona MVP

Persona ini merupakan hipotesis desain awal yang perlu divalidasi
melalui wawancara atau pengujian pengguna.

------------------------------------------------------------------------

## 1. Persona Utama --- Pemilik Dokumen

**Nama fiktif:** Nadia\
**Peran:** Pengguna individu terdaftar\
**Tujuan:** Mengajukan dokumen, mengetahui hasil review, dan memeriksa
integritas file miliknya.

### Tujuan

-   Mengajukan dokumen PDF dengan mudah.
-   Mengetahui apakah pengajuan sedang diperiksa, disetujui, ditolak,
    atau perlu diperbaiki.
-   Memahami alasan reviewer meminta revisi atau menolak dokumen.
-   Mendapatkan kode unik dan QR Code setelah disetujui.
-   Memeriksa apakah file yang dimiliki identik dengan dokumen yang
    telah disetujui.

### Pain points

-   Tidak mengetahui persyaratan dokumen sebelum mengunggah.
-   Tidak mengetahui status pemeriksaan.
-   Tidak memahami alasan penolakan.
-   Khawatir dokumen pribadi dapat dilihat orang lain.
-   Tidak ingin harus mengingat kode atau nama file saat melakukan
    pemeriksaan.

### Kebutuhan desain

-   Panduan dan checklist sebelum upload.
-   Status pengajuan yang jelas.
-   Alasan keputusan reviewer yang mudah ditemukan.
-   Fitur perbaikan dan pengajuan ulang.
-   QR dan kode unik muncul setelah approval.
-   Informasi privasi yang mudah dipahami.

### Skenario

Nadia mengunggah PDF dan mengisi metadata. Pengajuan masuk ke status
Pending Review. Setelah reviewer meminta perbaikan, Nadia memperbarui
dokumen dan mengajukan ulang. Setelah disetujui, Nadia memperoleh QR
Code dan kode unik.

------------------------------------------------------------------------

## 2. Persona Sekunder --- Pengguna Pemeriksa Dokumen Milik Sendiri

**Nama fiktif:** Raka\
**Peran:** Pengguna terdaftar yang memeriksa file\
**Tujuan:** Memeriksa apakah PDF identik dengan salah satu dokumen
miliknya yang telah disetujui.

### Pain points

-   Lupa kode verifikasi.
-   Memiliki beberapa file dengan nama serupa.
-   Tidak tahu dokumen mana yang sudah disetujui.
-   Tidak ingin file pemeriksaan otomatis tersimpan sebagai dokumen
    baru.

### Kebutuhan desain

-   Upload untuk pemeriksaan tanpa memilih dokumen pembanding.
-   Indikator proses hashing dan pencarian.
-   Hasil satu cocok, beberapa cocok, atau tidak ditemukan.
-   Status revoked terlihat jelas.
-   Penjelasan bahwa hash cocok hanya menunjukkan kesamaan file.

------------------------------------------------------------------------

## 3. Persona Reviewer --- Pemeriksa Pengajuan

**Nama fiktif:** Dimas\
**Peran:** Document Reviewer\
**Tujuan:** Memeriksa pengajuan secara konsisten, efisien, dan dapat
dipertanggungjawabkan.

### Tugas

-   Melihat antrean pengajuan.
-   Membuka metadata dan preview PDF.
-   Menggunakan checklist review.
-   Menyetujui pengajuan yang memenuhi kriteria.
-   Menolak pengajuan dengan alasan.
-   Meminta revisi dengan catatan yang dapat ditindaklanjuti.
-   Melihat riwayat keputusan yang relevan.

### Pain points

-   Antrean pengajuan yang tidak terstruktur.
-   Sulit membedakan dokumen baru dan dokumen revisi.
-   Tidak ada checklist standar.
-   Keputusan tidak memiliki alasan atau jejak audit.
-   Preview dokumen terlalu lambat atau tidak aman.

### Kebutuhan desain

-   Admin review queue dengan filter dan pencarian.
-   Detail submission dalam satu tampilan.
-   Preview file privat.
-   Checklist dan metadata yang mudah dipindai.
-   Tombol keputusan yang jelas dan tidak mudah salah klik.
-   Form alasan reject/request revision.
-   Riwayat reviewer dan keputusan.

### Prinsip

Reviewer menilai dokumen berdasarkan kebijakan platform. Jika review
hanya memeriksa kelayakan pendaftaran, reviewer tidak boleh menyatakan
dokumen autentik atau sah secara hukum tanpa bukti dan mekanisme
validasi penerbit.

------------------------------------------------------------------------

## 4. Persona Operasional --- Platform Administrator

**Peran:** Pengelola operasional dan konfigurasi platform.

Tugas yang mungkin: - Mengelola akun dan role. - Mengelola reviewer. -
Mengelola kategori dan checklist review. - Memantau aktivitas dan
masalah operasional.

Kewenangan final masih TBD. Akses ke file pengguna harus mengikuti least
privilege.

------------------------------------------------------------------------

## 5. Ringkasan Persona

  ------------------------------------------------------------------------
  Kebutuhan                          Owner        Reviewer  Platform Admin
  ------------------------ --------------- --------------- ---------------
  Mengajukan dokumen                    Ya Jika juga owner Jika juga owner

  Melihat pengajuan                     Ya Jika juga owner Jika juga owner
  sendiri                                                  

  Melihat antrean review             Tidak              Ya             TBD

  Preview pengajuan                  Tidak    Sesuai scope             TBD

  Approve/reject/request             Tidak              Ya             TBD
  revision                                                 

  Mendapat QR setelah                   Ya Jika juga owner Jika juga owner
  approval                                                 

  Hash matching dokumen                 Ya Jika juga owner Jika juga owner
  sendiri                                                  

  Mengelola role                     Tidak           Tidak             TBD
  ------------------------------------------------------------------------

**Prinsip:** pemilik dokumen, reviewer, dan administrator adalah
tanggung jawab yang berbeda. Hak akses tidak boleh disamakan hanya
karena semua aktor memiliki akun.

## 6. Implikasi Cakupan Dokumen

Pengguna dapat mengajukan semua jenis dokumen yang memenuhi kebijakan
platform. Form harus menyediakan kategori fleksibel dan pilihan
`Lainnya`, sehingga pengguna tidak terhambat ketika jenis dokumennya
belum tercantum. Kategori membantu pencarian dan klasifikasi, bukan
menentukan secara mutlak apakah suatu jenis dokumen boleh diterima.
