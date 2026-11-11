# Draf persetujuan pengajuan — development

Status: disetujui pengguna pada 4 November 2026 untuk uji development; bukan kebijakan produksi yang sudah ditinjau hukum/privasi.

Versi development: `development-2026-11-04`.

Teks checkbox yang disetujui:

> Saya berhak mengajukan dokumen ini dan menyetujui penyimpanan PDF serta metadata untuk pemeriksaan administratif oleh reviewer yang berwenang. Pemeriksaan administratif tidak membuktikan keaslian penerbit, kebenaran isi, atau keabsahan hukum dokumen.

Halaman kebijakan development menjelaskan bahwa PDF disimpan privat, pengguna hanya mengakses dokumen miliknya, reviewer mendapat akses sesuai izin, SHA-256 dihitung dari byte asli, dan metadata serta keputusan/versi lama dipertahankan sebagai riwayat. Batas PDF disetujui 10 MiB dan dapat dikonfigurasi turun; PDF terenkripsi/password-protected ditolak. Revisi menjadi versi baru dalam dokumen yang sama; pengajuan setelah ditolak menjadi dokumen baru.

Uji development menggunakan dokumen sintetis. Pemilihan scanner malware, kebijakan konten lengkap, retensi/penghapusan, dan tinjauan hukum/privasi tetap merupakan syarat sebelum rilis publik. Tidak ada masa retensi atau kewenangan admin baru yang ditetapkan melalui draf ini.

Checkbox tidak dicentang secara default, termasuk pada formulir revisi. Server harus memverifikasi consent aktif dan versi kebijakan yang berlaku; timestamp berasal dari database. Pengajuan diaktifkan untuk development loopback sesuai persetujuan ini dan memerlukan email pengguna terverifikasi.

Halaman yang dapat dibaca pengguna: `/policies/submission`. Teks persetujuan dan isi halaman digunakan bersama melalui `src/features/workspace/submission-policy.ts`.

## Isi halaman kebijakan development

### Cakupan development

Kebijakan ini disetujui untuk uji development menggunakan dokumen sintetis. Kebijakan produksi masih memerlukan tinjauan hukum dan privasi sebelum aplikasi dirilis untuk penggunaan publik.

Pengajuan development menerima PDF sampai batas yang ditampilkan pada formulir, dengan maksimum 10 MiB. PDF terenkripsi atau dilindungi password tidak diterima.

### Hak mengajukan dan akses privat

Pengguna menyatakan berhak mengajukan file dan menyetujui penyimpanan PDF serta metadata untuk pemeriksaan administratif. Gunakan dokumen sintetis tanpa data pribadi nyata selama uji development.

PDF disimpan privat. Pengguna hanya dapat mengakses dokumen miliknya sendiri. Reviewer yang berwenang memperoleh akses sesuai izin pemeriksaan; identitas kode dan QR tidak menggantikan login atau pemeriksaan kepemilikan.

### Validasi dan pemeriksaan administratif

Server memeriksa ukuran, tipe, signature, dan struktur PDF, lalu menghitung SHA-256 dari byte file asli. File yang gagal validasi tidak masuk antrean pemeriksaan.

Reviewer memeriksa empat aspek: kelengkapan, keterbacaan, kesesuaian kategori, dan kelayakan pendaftaran. Persetujuan hanya menyatakan dokumen lolos pemeriksaan administratif dan diterima untuk didaftarkan.

Pemeriksaan administratif maupun hash yang cocok tidak membuktikan keaslian penerbit, kebenaran isi, atau keabsahan hukum dokumen.

### Versi dan catatan pengajuan

Pengajuan baru berstatus menunggu review. Kode verifikasi dan QR aktif hanya diterbitkan setelah persetujuan; mesin kode, QR, dan pencocokan file belum diaktifkan pada tahap User Workspace.

Perbaikan untuk pengajuan yang meminta revisi membuat versi baru pada dokumen yang sama. File, metadata, dan keputusan sebelumnya dipertahankan sebagai riwayat dan tidak ditimpa. Pengajuan yang ditolak harus diajukan sebagai dokumen baru jika pengguna ingin mencoba kembali.

Server menyimpan persetujuan aktif pengguna, versi kebijakan, dan timestamp persetujuan dari database.

### Batas penggunaan sebelum rilis publik

Pemilihan scanner malware, kebijakan konten lengkap, serta aturan retensi dan penghapusan masih harus ditetapkan sebelum rilis publik. Dokumen ini tidak menetapkan masa retensi atau kewenangan admin tambahan.
