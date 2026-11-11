# Prompt revisi aplikasi berdasarkan rekaman

Salin bagian "Prompt siap pakai" ke Codex pada proyek aplikasi yang akan direvisi. Sertakan file transkrip dan ringkasan agar sumbernya dapat diperiksa.

## Prompt siap pakai

Anda membantu saya merevisi aplikasi pengajuan dan tanda tangan dokumen berdasarkan arahan dalam rekaman.

### Sumber dan batas penafsiran

Baca `Transkrip_Rekaman_Revisi.txt` dan, jika tersedia, `Ringkasan_Revisi_dan_Analisis_Rekaman.docx`. Audio sumber bernama `WhatsApp Audio 2026-11-04 at 14.21.07(1).mp4`.

Utamakan bagian rekaman 00:00–03:18 yang cukup jelas. Transkrip merupakan hasil otomatis dengan suntingan ringan, bukan salinan verbatim terverifikasi. Perlakukan fragmen bertanda kurang jelas sebagai ketidakpastian, bukan instruksi. Jangan membuat kutipan atau persyaratan baru dari fragmen tersebut.

Periksa AGENTS.md, struktur proyek, dokumentasi, dependensi, autentikasi, database, penyimpanan dokumen, status, serta pembuatan QR yang sudah ada. Gunakan teknologi dan pola kode proyek. Jangan mengasumsikan framework, nama tabel, atau endpoint sebelum pemeriksaan.

Kerjakan perubahan yang sudah jelas sampai berfungsi dan dapat ditinjau. Pertahankan pekerjaan pengguna dan fitur yang masih diperlukan. Jangan menghapus data atau mengganti arsitektur tanpa kebutuhan yang terbukti.

### Arahan yang berasal dari rekaman

1. Pengajuan dokumen, sekitar 00:00–00:26:
   - Pengguna mengajukan dokumen dari akunnya.
   - Form memuat informasi dokumen yang diperlukan dan ID pengguna yang akan menandatangani.
   - Dokumen masuk ke akun penandatangan sesuai ID tujuan.
   - Validasi tujuan berdasarkan data pengguna yang sebenarnya.

2. Peninjauan, sekitar 00:26–00:50:
   - Dokumen yang baru diajukan berada pada tahap Menunggu Review.
   - Penandatangan dapat melihat dokumen yang ditujukan kepadanya.
   - Sediakan kolom catatan dan tindakan Perlu Revisi.
   - Catatan dan status revisi terlihat oleh pengaju.

3. Persetujuan dan QR, sekitar 00:50–01:44:
   - Sediakan tindakan persetujuan atau penandatanganan sesuai mekanisme aplikasi.
   - QR dihasilkan setelah persetujuan.
   - Setiap dokumen memiliki QR yang berbeda dan terhubung dengan penandatangannya.
   - Pemindaian QR membuka informasi mengenai siapa yang menandatangani dokumen terkait.
   - Gunakan satu QR untuk satu dokumen sebagaimana disebut dalam rekaman. Jangan menafsirkan keunikan akun sebagai alasan memakai satu QR statis untuk semua dokumen milik pengguna.

4. Akun dan registrasi, sekitar 01:44–02:28 serta 02:48–02:53:
   - Alur permintaan tanda tangan dapat digunakan oleh pengguna secara umum.
   - Jangan membatasi pengguna hanya pada dosen jika proyek tidak memiliki aturan lain yang didukung sumber.
   - Pengguna dapat mendaftar menggunakan email.
   - Bedakan kewenangan pengaju, penerima pengajuan, dan admin sesuai hubungan mereka dengan dokumen.

5. Pemantauan admin, sekitar 02:28–02:48:
   - Sediakan pemantauan jumlah pengguna dan dokumen masuk.
   - Gunakan data aplikasi yang sebenarnya.
   - Penyebutan kapasitas pemakaian masih ambigu. Periksa apakah proyek sudah memiliki definisi metriknya; jangan menampilkan angka atau satuan dugaan.

6. Penolakan dan pencabutan, sekitar 02:53–03:18:
   - Dokumen yang ditolak terlihat dengan status Ditolak pada sisi pengaju.
   - Dokumen yang dicabut memiliki status Dicabut.
   - Sinkronkan tampilan status pada halaman yang relevan.
   - Rekaman belum menetapkan siapa yang boleh mencabut. Gunakan aturan otorisasi yang sudah terdokumentasi dan jangan memperluas hak pencabutan tanpa dasar.

### Rekomendasi implementasi

Bagian ini adalah hasil analisis teknis, bukan kutipan langsung dari rekaman. Terapkan jika sesuai dengan struktur dan aturan proyek, lalu jelaskan asumsi yang dipakai.

- Petakan status Menunggu Review, Perlu Revisi, Disetujui, Ditolak, dan Dicabut ke model status proyek yang sudah ada.
- Pisahkan Perlu Revisi dan Tolak agar pengguna memahami tindakan selanjutnya.
- Lengkapi alur revisi dengan perbaikan oleh pengaju dan pengajuan ulang. Dokumentasikan aturan perubahan versi atau penggantian file yang dipilih.
- Tautkan QR ke identitas dokumen yang unik serta halaman verifikasinya. Tampilkan penandatangan dan status dokumen sesuai hak akses.
- Saat status Dicabut, halaman verifikasi sebaiknya menjelaskan bahwa persetujuan sudah dicabut. Jangan menampilkan status persetujuan aktif yang sudah kedaluwarsa.
- Periksa kewenangan pada server berdasarkan sesi pengguna; jangan mempercayai ID yang dikirim klien sebagai bukti hak melakukan persetujuan.
- Simpan riwayat keputusan atau perubahan status secukupnya untuk mendukung pelacakan.
- Jangan menambah data pribadi pada halaman verifikasi publik tanpa kebutuhan dan aturan akses yang jelas.

### Hal yang belum pasti

Periksa kode dan dokumentasi untuk menyelesaikan hal berikut. Jika belum ada dasar yang memadai, jelaskan keterbatasan atau ajukan hanya pertanyaan yang benar-benar menghalangi implementasi terkait, sambil menyelesaikan bagian lain yang sudah jelas.

- Apakah diperlukan field jabatan atau unit kerja; frasa sekitar 02:06–02:12 belum jelas.
- Arti dan satuan kapasitas pemakaian.
- Pihak yang berhak mencabut, alasan pencabutan, dan dampaknya pada file yang sudah diunduh.
- Bentuk penandatanganan, jumlah penandatangan per dokumen, penempatan QR, dan data tambahan pada verifikasi.
- Fragmen sekitar 05:41 mengenai cetak. Jangan menjadikannya kewajiban fitur cetak tanpa konteks pendukung.

### Pemeriksaan hasil

Lakukan pengujian yang sesuai dengan perubahan dan fasilitas proyek:

1. Pengaju A memilih ID penandatangan B; dokumen muncul pada akun B sebagai Menunggu Review.
2. ID yang tidak ditemukan menghasilkan pesan validasi yang jelas.
3. Pengguna C tidak dapat mengambil tindakan peninjauan atas dokumen yang hanya ditujukan kepada B.
4. B mengirim catatan Perlu Revisi; A dapat melihat catatan dan statusnya.
5. Persetujuan menghasilkan QR untuk dokumen yang benar. Dokumen lain memiliki QR berbeda.
6. Pemindaian QR menampilkan identitas penandatangan yang sesuai; QR yang tidak dikenal ditangani dengan benar.
7. Penolakan tercermin pada sisi pengaju.
8. Jika aturan pencabutan tersedia, uji pencabutan dan konsistensi status pada verifikasi.
9. Registrasi melalui email berfungsi dan pemantauan admin mengambil angka dari data sebenarnya.

Jalankan pemeriksaan yang relevan. Laporkan pemeriksaan yang tidak dapat dijalankan beserta alasannya. Jangan mengklaim fitur atau pengujian sudah selesai tanpa bukti.

### Hasil yang saya perlukan

- Implementasi perubahan yang sudah jelas dalam proyek.
- Ringkasan perubahan dan file yang diubah.
- Penjelasan alur pengguna setelah revisi.
- Hasil pemeriksaan.
- Daftar singkat asumsi serta keputusan yang masih diperlukan.

Mulai dengan membaca sumber dan memeriksa proyek, kemudian lanjutkan pengerjaan tanpa berhenti hanya pada rencana.

