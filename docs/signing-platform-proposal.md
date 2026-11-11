# Usulan perubahan arah: permintaan tanda tangan antar-pengguna

Status: arah stakeholder telah diminta untuk dilanjutkan, dan pengguna memilih **prototipe persetujuan internal dengan satu penandatangan pengguna lain**. Paket rinci terbaru berada pada [rebaseline signing V1](signing-revision/README.md), dengan [register keputusan](signing-revision/decision-register.md) yang membedakan persetujuan dari gate terbuka. Fitur/permission baru belum diaktifkan. Permintaan awal 4 November 2026: kode akun untuk meminta persetujuan, QR terkait bukti tindakan, dan admin operasional/monitoring. Dokumentasi asli serta migration dipertahankan.

## Peran admin yang disarankan

Admin memantau penggunaan dan kondisi sistem, menangani akun bermasalah, dukungan pengguna, laporan penyalahgunaan, serta audit aktivitas administratif. Admin tidak menyetujui setiap dokumen, menandatangani mewakili pengguna, atau mengubah bukti penandatanganan. Batas wewenang penangguhan akun, penanganan sengketa, dan akses dukungan perlu disetujui sebelum implementasi.

Dashboard awal: jumlah pengguna terdaftar, pengguna aktif 30 hari, dokumen diunggah, dokumen selesai ditandatangani seluruh penerima wajib, permintaan tertunda, dan operasi gagal. Jumlah dokumen selesai berbeda dari jumlah aksi tanda tangan: satu dokumen dapat mempunyai beberapa penandatangan. Definisi pengguna aktif adalah pengguna unik yang login, mengunggah, atau menandatangani selama jendela tersebut; refresh token tidak dihitung sebagai aktivitas pengguna tersendiri.

Monitoring menggunakan agregat dan metadata minimum. Kemampuan melihat statistik tidak otomatis memberi admin akses membaca seluruh PDF. Akses isi untuk dukungan memerlukan kebijakan terpisah, pembatasan wewenang, alasan yang tercatat, dan audit.

## Kode pengguna dan QR

Kode pengguna merupakan identifier untuk memilih penerima undangan; mengetahui kode itu tidak memberi hak menandatangani. QR identitas pengguna boleh disediakan untuk berbagi identifier. QR bukti tanda tangan sebaiknya unik untuk setiap aksi pada dokumen dan versi tertentu, terikat pada penandatangan, hash dokumen, waktu, dan catatan persetujuan eksplisit.

QR atau gambar yang ditempel saja tidak membuktikan persetujuan. Aksi penandatanganan harus dilakukan oleh penerima yang login setelah membaca dokumen dan mengonfirmasi tindakan. Penambahan autentikasi ulang/MFA serta mekanisme kriptografi perlu diputuskan sesuai target jaminan. QR tidak memuat secret atau memberikan akses publik otomatis terhadap PDF.

Alur usulan: unggah draft → pilih penerima berdasarkan kode → kirim permintaan → penerima membaca dan menandatangani atau menolak → sistem mencatat bukti dan membuat QR terkait → status selesai ketika semua penerima wajib telah menandatangani. Model dokumen multi-penandatangan, versi sumber, hasil PDF, serta keterikatan hash ketika QR dibubuhkan harus dirancang sebelum coding. Jangan mengubah PDF yang sudah ditandatangani dengan menimpa byte lama.

## Keputusan yang masih diperlukan

- Target internal dan satu penandatangan pengguna lain sudah dipilih pengguna; certified TTE, multi-penandatangan, urutan, dan kuorum tidak termasuk V1.
- Autentikasi ulang/konfirmasi yang diperlukan saat menandatangani.
- Informasi minimum pada QR dan halaman pemeriksaannya, termasuk siapa yang boleh mengakses. Aturan lama yang melarang verifikasi publik tetap berlaku sampai direvisi secara eksplisit.
- Hak baca pemilik dan penerima undangan, masa akses, pembatalan, penolakan, kedaluwarsa, serta perubahan dokumen setelah permintaan dikirim.
- Batas kewenangan admin, kebijakan dukungan, retensi, dan penanganan laporan.

Perubahan ini memerlukan revisi terkoordinasi pada PRD, sitemap, API, schema, RLS, state machine, kebijakan peninjauan, dan roadmap. Fondasi autentikasi, tema, komponen, penyimpanan privat, serta parser PDF dapat digunakan kembali. Alur reviewer dan penerbitan QR setelah persetujuan admin masih merupakan perilaku baseline lama dan belum diganti.

## Rujukan

- [Privy FAQ](https://privy.id/id/faq?t=enterprise-and-partnership): identitas, OTP, sertifikat, dan tanda tangan merupakan bagian berbeda dari layanannya.
- [NIST Digital Signatures](https://csrc.nist.gov/Projects/Digital-Signatures): jaminan identitas penandatangan dan integritas informasi menjadi tujuan tanda tangan digital.

Catatan implementasi berjalan: percobaan cloud sebelumnya gagal sebelum penyimpanan akibat format payload worker di build production; nol dokumen/submission/object milik akun uji telah dibuktikan, dan kedua akun telah dibersihkan. Perbaikan lokal tidak menerapkan usulan bisnis di atas. Belum ada pengajuan cloud sukses dari percobaan tersebut.
