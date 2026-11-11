# Consent development — persetujuan internal V1

Versi teks: **5 November 2026**. Checkpoint dokumentasi: **9 November 2026**, Asia/Makassar. Status: **disetujui pengguna untuk development**. Consent upload dan berbagi sudah dipasang pada source R2; migration 009 sudah dijalankan pada cloud menurut pengguna dan ketersediaan API telah diperiksa. [Uji sintetis R2](r2-cloud-acceptance-plan.md) sudah disetujui dan [lulus](r2-cloud-report.md). Persetujuan ini tidak memperluas consent review administratif lama. Scope pengujian adalah dokumen sintetis pada development; kebijakan produksi/retensi dan tinjauan hukum/privasi tetap terpisah.

Identifier versi tetap `internal-upload-development-2026-11-05`, `internal-sharing-development-2026-11-05`, dan `internal-action-development-2026-11-05`. Tanggal pada identifier adalah versi teks, bukan klaim tanggal deployment. Teks aksi penerima sudah disetujui untuk development, tetapi belum diaktifkan: metode autentikasi/konfirmasi S-05 serta bukti/QR masih berada pada R3.

## Penyimpanan draft privat

> Saya berhak mengunggah dokumen ini dan menyetujui penyimpanan PDF serta metadatanya secara privat untuk pengujian prototipe persetujuan dokumen internal. Saya menggunakan dokumen sintetis tanpa data pribadi nyata.

Ditampilkan saat upload model baru. Belum ada penerima atau undangan yang diberi akses pada tahap ini. Timestamp dan versi teks berasal dari server; checkbox tidak tercentang otomatis.

## Berbagi versi kepada penerima yang dipilih

> Saya mengizinkan penerima yang ditampilkan untuk membaca dan mengunduh versi dokumen ini guna menanggapi permintaan persetujuan melalui platform internal.

Nama dan kode penerima serta identitas versi ditampilkan sebelum pengiriman. Server memverifikasi penerima, snapshot versi dan aturan akses yang disetujui. Perubahan penerima/versi memerlukan konfirmasi baru. Hasil lookup kode saja tidak memberikan akses atau mengirim undangan.

## Aksi persetujuan penerima

> Saya telah membaca versi dokumen yang ditampilkan dan menyetujuinya melalui akun saya. Saya memahami bahwa catatan dan QR persetujuan ini merupakan bukti internal platform, bukan sertifikat tanda tangan elektronik.

Teks aksi ini baru dipakai pada R3 setelah S-05 ditetapkan. Metode autentikasi ulang tidak ditentukan hanya oleh persetujuan atas teks. Penolakan adalah tindakan tersendiri; membuka preview atau menekan link tidak mencatat persetujuan.

## Lifecycle yang disetujui untuk V1

Pengguna menyetujui aturan S-06/S-07 untuk V1: undangan kedaluwarsa tujuh hari (168 jam) setelah dikirim; pemilik boleh membatalkan sebelum keputusan penerima committed; penerima yang sah dapat preview/download versi yang diundang selama aktif dan setelah selesai; akses PDF penerima dicabut setelah penolakan, pembatalan, atau kedaluwarsa. Pemilik tetap mengakses dokumennya sendiri. Source R2 membatasi satu request per dokumen dan tidak mengedit penerima/request yang sudah dikirim; permintaan baru menggunakan draft baru.

Kedaluwarsa akses bukan penghapusan file atau riwayat. Tidak ada retensi otomatis atau job purge. R2 menerapkan akses pending, pembatalan dan kedaluwarsa pada server serta RLS. Status consented/completed/rejected dicadangkan untuk pengujian batas akses dan implementasi R3; R2 tidak menyediakan aksi untuk menghasilkannya.

Ketentuan perpanjangan, reaktivasi, akses setelah akun dibatasi, serta penghapusan tetap tidak diaktifkan tanpa aturan tersendiri. V1 tidak menawarkan self-sign atau beberapa penerima.
