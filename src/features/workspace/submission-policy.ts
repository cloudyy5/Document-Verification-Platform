import { SUBMISSION_CONSENT_TEXT } from "@/lib/documents/policy";
export const submissionConsentText = SUBMISSION_CONSENT_TEXT;
export const submissionPolicySections = [
  {
    title: "Penggunaan layanan",
    paragraphs: [
      "Platform menyediakan penyimpanan PDF, permintaan persetujuan kepada satu pengguna lain, serta catatan persetujuan melalui akun yang terautentikasi. Pengguna harus memiliki hak untuk mengunggah dan membagikan dokumen.",
      "Batas sumber PDF paling tinggi 10 MiB dan dapat lebih rendah sesuai batas pada formulir. PDF terenkripsi, dilindungi password, mengandung aksi otomatis terlarang atau lampiran tertanam tidak diterima.",
    ],
  },
  {
    title: "Akses PDF dan metadata QR",
    paragraphs: [
      "PDF disimpan pada penyimpanan privat. Pemilik dan penerima yang sah dapat membaca versi sesuai status permintaan; admin monitoring tidak otomatis berhak membaca PDF pengguna.",
      "Setelah persetujuan tercatat, siapa pun yang mempunyai QR atau tautan bukti dapat melihat status, waktu persetujuan, nama penandatangan, dan judul dokumen tanpa login. Email, kode akun, alasan penolakan dan PDF tidak dibuka oleh QR.",
    ],
  },
  {
    title: "Pemeriksaan file dan batas bukti",
    paragraphs: [
      "Sebelum menyimpan unggahan baru pada layanan publik, server memvalidasi PDF dan mengirim byte file ke pemindai malware pada jaringan internal layanan. File tidak disimpan apabila pemindai menemukan ancaman atau pemeriksaan tidak dapat diselesaikan.",
      "Pemeriksaan keamanan, QR dan hash tidak menjamin kebenaran isi atau keaslian penerbit. Catatan platform bukan sertifikat tanda tangan elektronik. Pencocokan file dengan catatan memerlukan pemeriksaan hash file yang tepat.",
    ],
  },
  {
    title: "Penyimpanan dan penghapusan",
    paragraphs: [
      "Dokumen, versi dan riwayat persetujuan disimpan tanpa batas hapus otomatis. Permintaan penghapusan ditangani melalui prosedur pengelola; aplikasi tidak menyediakan tombol hapus bukti atau penghapusan otomatis.",
      "Pengajuan dan keputusan yang sudah tercatat tidak ditimpa. Prosedur penghapusan harus memperhitungkan hak peserta, riwayat keputusan dan salinan cadangan. Mengirim permintaan penghapusan tidak langsung menghapus data.",
    ],
  },
  {
    title: "Undangan dan keputusan",
    paragraphs: [
      "Undangan berlaku tujuh hari. Pemilik dapat membatalkan sebelum penerima memutuskan. Penerima dapat membaca PDF selama undangan aktif dan setelah persetujuan; akses penerima berakhir bila ditolak, dibatalkan atau kedaluwarsa.",
      "Persetujuan mengikat versi serta hash PDF yang ditampilkan. Jumlah dan posisi QR dikunci saat persetujuan. Alasan penolakan wajib dan hanya dapat dibaca peserta yang berhak.",
    ],
  },
  {
    title: "Arsip pemeriksaan terdahulu",
    paragraphs: [
      "Pengajuan pemeriksaan administratif terdahulu disimpan sebagai arsip terpisah dari permintaan persetujuan antar pengguna. Status administratif tidak diubah menjadi tanda tangan dan tidak menjamin keaslian penerbit atau keabsahan hukum dokumen.",
    ],
  },
] as const;
