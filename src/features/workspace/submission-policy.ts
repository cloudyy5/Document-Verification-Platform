/** Approved for synthetic development tests; this is not production legal policy. */
export const developmentConsentText =
  "Saya berhak mengajukan dokumen ini dan menyetujui penyimpanan PDF serta metadata untuk pemeriksaan administratif oleh reviewer yang berwenang. Pemeriksaan administratif tidak membuktikan keaslian penerbit, kebenaran isi, atau keabsahan hukum dokumen.";

export const developmentPolicySections = [
  {
    title: "Cakupan development",
    paragraphs: [
      "Kebijakan ini disetujui untuk uji development menggunakan dokumen sintetis. Kebijakan produksi masih memerlukan tinjauan hukum dan privasi sebelum aplikasi dirilis untuk penggunaan publik.",
      "Pengajuan development menerima PDF sampai batas yang ditampilkan pada formulir, dengan maksimum 10 MiB. PDF terenkripsi atau dilindungi password tidak diterima.",
    ],
  },
  {
    title: "Hak mengajukan dan akses privat",
    paragraphs: [
      "Pengguna menyatakan berhak mengajukan file dan menyetujui penyimpanan PDF serta metadata untuk pemeriksaan administratif. Gunakan dokumen sintetis tanpa data pribadi nyata selama uji development.",
      "PDF disimpan privat. Pengguna hanya dapat mengakses dokumen miliknya sendiri. Reviewer yang berwenang memperoleh akses sesuai izin pemeriksaan; identitas kode dan QR tidak menggantikan login atau pemeriksaan kepemilikan.",
    ],
  },
  {
    title: "Validasi dan pemeriksaan administratif",
    paragraphs: [
      "Server memeriksa ukuran, tipe, signature, dan struktur PDF, lalu menghitung SHA-256 dari byte file asli. File yang gagal validasi tidak masuk antrean pemeriksaan.",
      "Reviewer memeriksa empat aspek: kelengkapan, keterbacaan, kesesuaian kategori, dan kelayakan pendaftaran. Persetujuan hanya menyatakan dokumen lolos pemeriksaan administratif dan diterima untuk didaftarkan.",
      "Pemeriksaan administratif maupun hash yang cocok tidak membuktikan keaslian penerbit, kebenaran isi, atau keabsahan hukum dokumen.",
    ],
  },
  {
    title: "Versi dan catatan pengajuan",
    paragraphs: [
      "Pengajuan baru berstatus menunggu review. Kode verifikasi dan QR aktif hanya diterbitkan setelah persetujuan; mesin kode, QR, dan pencocokan file belum diaktifkan pada tahap User Workspace.",
      "Perbaikan untuk pengajuan yang meminta revisi membuat versi baru pada dokumen yang sama. File, metadata, dan keputusan sebelumnya dipertahankan sebagai riwayat dan tidak ditimpa. Pengajuan yang ditolak harus diajukan sebagai dokumen baru jika pengguna ingin mencoba kembali.",
      "Server menyimpan persetujuan aktif pengguna, versi kebijakan, dan timestamp persetujuan dari database.",
    ],
  },
  {
    title: "Batas penggunaan sebelum rilis publik",
    paragraphs: [
      "Pemilihan scanner malware, kebijakan konten lengkap, serta aturan retensi dan penghapusan masih harus ditetapkan sebelum rilis publik. Dokumen ini tidak menetapkan masa retensi atau kewenangan admin tambahan.",
    ],
  },
] as const;
