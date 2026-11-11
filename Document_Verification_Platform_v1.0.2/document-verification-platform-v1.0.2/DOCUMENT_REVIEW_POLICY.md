# DOCUMENT_REVIEW_POLICY.md

## Document Verification Platform

**Versi:** 0.4\
**Status:** Standar pemeriksaan administratif MVP --- dipilih oleh
pemilik produk\
**Cakupan:** Pemeriksaan pengajuan dokumen PDF oleh
administrator/reviewer

------------------------------------------------------------------------

## 1. Tujuan Kebijakan

Kebijakan ini menjadi pedoman pemeriksaan manual sebelum dokumen
diterima sebagai dokumen terdaftar pada platform. Tujuannya memastikan
file yang diajukan memenuhi persyaratan minimum, dapat dibaca, sesuai
kategori, dan layak diproses.

Dokumen tidak langsung memperoleh status terdaftar setelah upload. Semua
pengajuan harus melalui validasi teknis dan pemeriksaan administratif.

## 2. Cakupan Jenis Dokumen

Platform menerima semua jenis dokumen selama memenuhi kebijakan
penggunaan platform. Jenis dokumen tidak dibatasi hanya pada pendidikan,
pekerjaan, organisasi, atau administrasi.

Kategori berfungsi sebagai alat klasifikasi, bukan whitelist tertutup.
Pengguna dapat memilih kategori yang paling sesuai atau `Lainnya` jika
kategori khusus belum tersedia. Reviewer menilai apakah kategori yang
dipilih menggambarkan dokumen secara wajar; reviewer tidak boleh menolak
dokumen hanya karena jenisnya belum tersedia sebagai kategori khusus.

Format MVP tetap PDF. Semua dokumen harus melewati validasi teknis dan
empat aspek pemeriksaan administratif.

## 3. Batas Pemeriksaan

MVP menggunakan **pemeriksaan administratif**, bukan pemeriksaan
autentisitas penerbit.

Administrator memeriksa: 1. Kelengkapan dokumen dan metadata. 2.
Keterbacaan dan kondisi file. 3. Kesesuaian dokumen dengan kategori yang
diterima. 4. Kelayakan dokumen untuk didaftarkan berdasarkan kebijakan
platform.

Pemeriksaan ini tidak membuktikan: - identitas atau kewenangan
penerbit; - keaslian tanda tangan; - kebenaran seluruh isi dokumen; -
keabsahan hukum; - bahwa dokumen benar-benar diterbitkan oleh institusi
yang tercantum.

Istilah yang digunakan pada UI adalah **"Disetujui untuk didaftarkan"**
atau **"Lolos pemeriksaan administratif"**, bukan "Dijamin asli".

## 4. Tahap Sebelum Pemeriksaan Manual

Sebelum submission muncul di review queue, backend melakukan pemeriksaan
teknis: - file memiliki konten PDF yang valid, bukan hanya ekstensi
`.pdf`; - MIME type dan signature/magic bytes diperiksa; - struktur PDF
dapat diproses; - ukuran file sesuai batas sistem; - file tidak kosong
atau rusak secara teknis; - SHA-256 dihitung di backend; - file dan
metadata disimpan secara privat.

Jika validasi teknis gagal, submission tidak masuk antrean review dan
pengguna memperoleh pesan kesalahan yang sesuai.

## 5. Empat Aspek Pemeriksaan Administrator

### 4.1 Kelengkapan

Reviewer memastikan: - file utama telah dilampirkan; - seluruh metadata
yang diwajibkan untuk kategori tersebut telah diisi; - halaman atau
bagian dokumen yang diperlukan tersedia; - informasi yang diminta pada
formulir tidak kosong.

Kategori dokumen dan metadata wajib per kategori masih harus ditetapkan.
Reviewer tidak boleh membuat persyaratan baru secara sepihak ketika
memeriksa pengajuan.

**Hasil checklist:** Lolos / Tidak lolos / Tidak berlaku jika item
memang opsional.

### 4.2 Keterbacaan

Reviewer memastikan: - PDF dapat dibuka melalui preview; - halaman tidak
kosong tanpa alasan; - teks atau informasi utama dapat dibaca; - halaman
tidak terpotong secara material; - file tidak rusak atau hanya berisi
tampilan yang tidak dapat diperiksa.

Jika sebagian halaman tidak terbaca atau file perlu diganti, reviewer
dapat meminta revisi.

**Hasil checklist:** Lolos / Tidak lolos.

### 4.3 Kesesuaian Kategori

Reviewer memastikan: - kategori yang dipilih pengguna sesuai dengan
jenis dokumen; - dokumen termasuk jenis yang diterima platform; -
metadata kategori tidak bertentangan secara jelas dengan dokumen yang
ditampilkan.

Daftar kategori yang diterima harus dikelola sebagai kebijakan produk.
Kategori final belum ditentukan dan tidak boleh diasumsikan oleh
implementasi.

**Hasil checklist:** Lolos / Tidak lolos.

### 4.4 Kelayakan Pendaftaran

Reviewer memastikan: - dokumen relevan dengan layanan platform; - file
bukan dokumen kosong, spam, atau unggahan yang jelas tidak berkaitan; -
dokumen tidak melanggar kebijakan platform yang telah ditetapkan; -
pengajuan memenuhi persyaratan minimum untuk dicatat dan diberi
identitas verifikasi.

Reviewer tidak menilai benar-salahnya seluruh isi dokumen atau
mengesahkan penerbitnya.

**Hasil checklist:** Lolos / Tidak lolos.

## 6. Checklist Review pada Dashboard

  -----------------------------------------------------------------------
  No.               Aspek             Pertanyaan        Wajib
                                      reviewer          
  ----------------- ----------------- ----------------- -----------------
  1                 Kelengkapan       File dan metadata Ya
                                      wajib tersedia?   

  2                 Keterbacaan       PDF dapat dibuka  Ya
                                      dan informasi     
                                      utamanya terbaca? 

  3                 Kesesuaian        Isi dokumen       Ya
                    kategori          sesuai kategori   
                                      yang dipilih dan  
                                      diterima?         

  4                 Kelayakan         Dokumen relevan   Ya
                                      dan memenuhi      
                                      kebijakan         
                                      pendaftaran?      
  -----------------------------------------------------------------------

Setiap aspek wajib dipilih sebelum keputusan final. Jika satu aspek
tidak lolos, reviewer tidak dapat langsung memilih approve.

## 7. Keputusan Review

### 6.1 Approve --- Disetujui untuk didaftarkan

Digunakan jika seluruh aspek wajib lolos. - Status berubah menjadi
`approved`. - Sistem mencatat reviewer, waktu, checklist, dan catatan
keputusan. - Kode verifikasi unik diterbitkan. - QR Code dibuat. -
Dokumen muncul pada daftar dokumen terdaftar milik pengguna. - Hash
dokumen menjadi kandidat Automatic Hash Matching.

### 6.2 Request Revision --- Perlu perbaikan

Digunakan jika masalah dapat diperbaiki oleh pengguna, misalnya: -
metadata belum lengkap; - file perlu diganti dengan versi yang lebih
jelas; - ada halaman yang terpotong atau tidak terbaca; - kategori atau
informasi formulir perlu diperbaiki.

Ketentuan: - Catatan perbaikan wajib diisi. - Status berubah menjadi
`revision_requested`. - Pengguna memperoleh catatan yang spesifik dan
dapat ditindaklanjuti. - Pengajuan yang diperbaiki masuk kembali ke
antrean review. - Riwayat keputusan sebelumnya tidak dihapus.

### 6.3 Reject --- Ditolak

Digunakan jika pengajuan jelas tidak memenuhi kebijakan dan tidak tepat
diselesaikan hanya dengan revisi, misalnya file spam, tidak relevan,
atau termasuk jenis yang tidak diterima platform.

Ketentuan: - Alasan penolakan wajib diisi. - Status berubah menjadi
`rejected`. - Kode dan QR aktif tidak diterbitkan. - Pengguna dapat
melihat alasan penolakan. - Kebijakan pengajuan ulang setelah rejected
masih perlu keputusan pemilik produk.

## 8. Alur Kerja Reviewer

1.  Login ke Admin Workspace.
2.  Membuka Review Queue.
3.  Memilih submission.
4.  Memeriksa metadata dan preview PDF.
5.  Mengisi seluruh checklist empat aspek.
6.  Memilih Approve, Request Revision, atau Reject sesuai hasil.
7.  Mengisi catatan yang diwajibkan.
8.  Mengonfirmasi keputusan.
9.  Sistem menyimpan keputusan dan audit event.
10. Pengguna menerima pembaruan status.

## 9. Prinsip Konsistensi dan Akuntabilitas

-   Reviewer menggunakan checklist yang sama untuk kategori dokumen yang
    sama.
-   Reviewer tidak mengambil keputusan berdasarkan preferensi pribadi.
-   Catatan revisi harus spesifik, bukan sekadar "perbaiki dokumen".
-   Alasan penolakan harus menjelaskan ketentuan yang tidak terpenuhi.
-   Reviewer tidak boleh mengubah file pengguna.
-   Keputusan harus mencatat reviewer ID dan timestamp server.
-   Keputusan tidak boleh ditimpa diam-diam.
-   Jika status berubah saat reviewer membuka halaman, sistem harus
    meminta refresh sebelum keputusan baru disimpan.
-   Akses preview dan keputusan dicatat sesuai kebijakan audit.

## 10. Akses File dan Privasi

-   File submission disimpan pada private storage.
-   Reviewer hanya dapat membuka submission sesuai role dan scope.
-   Preview harus menggunakan endpoint terautentikasi dan terotorisasi.
-   Jangan gunakan public storage URL.
-   Rekomendasi MVP: preview terkontrol; unduhan reviewer dinonaktifkan
    sampai kebijakan disetujui.
-   Pembatasan preview tidak dapat menjamin pencegahan screenshot atau
    perekaman layar.
-   File tidak boleh disebarkan di luar kebutuhan review.

## 11. Keterkaitan dengan Hash dan QR

-   Hash dihitung pada saat submission diterima backend dan dihitung
    ulang jika file revisi berubah.
-   Hash final yang disetujui dikaitkan dengan versi file yang telah
    lolos review.
-   Hanya submission approved memperoleh kode unik dan QR aktif.
-   Jika file berubah setelah approval, file baru harus diajukan dan
    ditinjau kembali; jangan mengubah file approved secara diam-diam.
-   Automatic Hash Matching hanya mencari dokumen milik akun aktif yang
    pernah approved.
-   Dokumen revoked dapat ditampilkan sebagai hasil cocok dengan status
    revoked.
-   Hash cocok menunjukkan kesamaan byte file, bukan bukti keaslian atau
    legalitas.

## 12. Keputusan Produk yang Masih Terbuka

1.  Daftar kategori dokumen yang diterima.
2.  Metadata wajib untuk setiap kategori.
3.  Batas ukuran file.
4.  Apakah reviewer hanya preview atau boleh mengunduh.
5.  Apakah review dilakukan oleh satu reviewer atau perlu persetujuan
    kedua.
6.  Target waktu review/SLA.
7.  Apakah submission rejected dapat diajukan ulang.
8.  Siapa yang berwenang mencabut dokumen approved.
9.  Apakah assignment submission kepada reviewer tertentu diperlukan.

## 13. Rekomendasi MVP

Mulai dengan satu tahap pemeriksaan administratif, empat checklist
wajib, dan tiga hasil keputusan. Gunakan preview privat, catatan revisi
yang jelas, serta audit trail. Verifikasi keaslian penerbit dapat
menjadi pengembangan terpisah jika platform kelak memiliki sumber
pembanding dan kewenangan yang dapat dipercaya.

## 14. Prinsip Konten dan Privasi

Karena platform menerima berbagai jenis dokumen, kebijakan penggunaan
harus menjelaskan setidaknya: - konten atau dokumen yang dilarang; -
larangan file yang membawa malware atau konten aktif berbahaya; -
penanganan spam dan unggahan yang tidak relevan; - larangan penggunaan
platform untuk menyebarkan data pribadi pihak lain tanpa dasar atau izin
yang sesuai; - proses pelaporan dan penanganan dokumen yang diduga
melanggar kebijakan; - retensi, penghapusan, dan pembatasan akses
dokumen.

Daftar final kebijakan konten harus ditinjau sebelum peluncuran publik.
Reviewer tidak boleh membuat larangan baru secara sepihak di luar
kebijakan yang telah ditetapkan.


---

## ADDENDUM v1.0 — Review Implementation Rules

The four approved administrative review criteria remain:
1. Kelengkapan.
2. Keterbacaan.
3. Kesesuaian kategori.
4. Kelayakan pendaftaran.

For MVP, all four checklist values are required. Approval is permitted only when all four pass. Request Revision and Reject require at least one failed criterion and an actionable note/reason. Each submission version receives at most one final review decision; a revision resubmission creates a new version and preserves the previous decision.

The shared reviewer queue, single-reviewer default, rejected-submission handling, and revocation authority are recommendations pending owner approval. See `DECISION_REGISTER.md`.
