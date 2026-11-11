# Addendum workflow dan sitemap — permintaan tanda tangan

Disusun 4 November 2026; checkpoint **10 November 2026**. R2 dan R3 format awal lulus cloud development. Source R3b menyediakan editor posisi QR penerima; migration 011 dilaporkan aktif dan preflight API lulus 47 pemeriksaan; [penerimaan peserta cloud format baru](qr-placement-cloud-report.md) telah lulus. Baca [kontrak posisi QR](qr-placement-contract.md), [laporan R3b](qr-placement-report.md) dan [kebutuhan produk revisi](product-requirements.md). Monitoring R4 masih tahap berikutnya. Paket sitemap/UI asli dipertahankan sebagai baseline historis.

Pengguna telah memilih **prototipe persetujuan dokumen internal dengan satu penandatangan pengguna lain pada V1**. TTE tersertifikasi dan beberapa penandatangan paralel/berurutan berada di luar MVP aktif. S-05/S-13 menetapkan konfirmasi tanpa password ulang dan alasan reject wajib. **S-14 menggantikan S-09 untuk hasil baru:** penerima menggeser posisi QR pada semua halaman asli; tidak ada halaman bukti PDF tambahan; scan membuka bukti privat di web. Wewenang admin tambahan tetap terbuka.

## 1. Dua workspace dan tujuan navigasi

**S-15/source 0.8.1:** login biasa menggunakan role database untuk memilih dashboard. `platform_admin` hanya memakai Admin Workspace, termasuk pada akun dengan role `user`; tidak ada menu pindah ke User Workspace dan URL/API pengguna dibatasi. `/profile` adalah pengaturan akun bersama yang memakai shell admin untuk administrator. [Laporan perubahan](admin-workspace-report.md) menjadi acuan pembatasan aplikasi, tanpa menghapus role atau data lama.

**R4 source 0.8.0, 11 November 2026:** S-11 sudah disetujui. Platform admin membuka `/admin/overview` atau `/admin/operations`, meninjau snapshot dan memuat ulang data; tidak ada kontrol approve/retry atas nama peserta atau akses isi PDF. Reviewer saja tetap pada arsip. API snapshot memakai guard server dan database; migration 012 dilaporkan berhasil dipasang dan [preflight API](r4-activation-check.md) lulus 49 pemeriksaan. [Setup akun dan penerimaan sesi admin](r4-cloud-acceptance-plan.md) masih menjadi langkah berikutnya. [Laporan R4](r4-report.md) merupakan status implementasi terbaru; inventaris layar yang belum dikerjakan tetap usulan.

User Workspace mengikuti pekerjaan pengguna: menyiapkan dokumen, mengirim permintaan, membaca permintaan masuk, serta melihat bukti. Admin Workspace mengikuti kebutuhan operasional: penggunaan layanan, kegagalan, dukungan, dan audit. Menu admin bukan salinan dashboard pengguna dan tidak memerlukan preview seluruh PDF.

```text
Publik yang sudah diperbolehkan
├── Login / Register / pemulihan akun
└── Kebijakan penggunaan yang disetujui

User Workspace [sesi sah]
├── Ringkasan
├── Dokumen saya [sebagai pemilik]
│   ├── Unggah / siapkan draft
│   └── Detail dokumen
│       ├── Versi sumber privat
│       ├── Penerima dan progres permintaan
│       └── Riwayat / bukti yang berwenang
├── Permintaan masuk [sebagai penerima]
│   └── Detail permintaan
│       ├── Preview versi yang diundang
│       ├── Atur posisi QR pada setiap halaman [penerima, sebelum approve]
│       ├── Konfirmasi tanda tangan / penolakan
│       └── Bukti dan status setelah aksi
├── Permintaan terkirim [sebagai pemilik/pengirim]
│   └── Detail progres
├── Periksa bukti [privat, berdasarkan relasi]
└── Profil & preferensi
    └── Kode akun / QR identitas dengan label yang jelas

Admin Workspace [platform_admin + permission yang disetujui]
├── Overview operasional
├── Aktivitas operasional [metadata minimum]
├── Kegagalan yang perlu ditangani
└── Audit administratif

Usulan lanjutan, belum aktif
├── Dukungan dan laporan
├── Pengelolaan akun
└── Pengaturan platform
```

Tindakan pengelolaan akun, perubahan role, penangguhan, konfigurasi, ekspor, atau akses isi dukungan tidak menjadi aktif hanya karena tercantum dalam sitemap. Tidak ada halaman verifikasi publik atau pencarian seluruh pengguna.

## 2. Workflow utama dan titik keputusan

| Langkah                  | Aktor dan layar                         | Hasil yang harus terlihat                                                      | Kontrol server / keputusan terbuka                                                               |
| ------------------------ | --------------------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| Menyiapkan file          | Pemilik, unggah/draft                   | File dan metadata tervalidasi, versi sumber dapat ditinjau                     | R2: Auth, email verified, PDF privat, hash server dan consent development upload baru            |
| Memilih penerima         | Pemilik, detail/draft                   | Masukkan kode akun secara eksplisit, tampil identitas minimum untuk konfirmasi | Rate limit dan anti-enumerasi; hasil lookup tidak mengirim undangan otomatis                     |
| Mengirim permintaan      | Pemilik, dialog konfirmasi kirim        | Tampilkan dokumen/versi, penerima, dan konsekuensi sharing                     | Tepat satu penerima berbeda dari pemilik dan versi sumber dibekukan; tidak ada giliran/kuorum V1 |
| Membuka undangan         | Penerima, permintaan masuk/detail       | Preview versi yang benar, identitas pengirim minimum, status saat ini          | Relasi undangan sah untuk akun aktif; versi lain tidak ikut terbuka                              |
| Memberi keputusan        | Penerima, dialog konfirmasi             | Teks persetujuan belum dicentang, aksi eksplisit, indikator proses aktual      | S-05: tanpa password ulang; konfirmasi eksplisit terikat sesi, versi dan hash                    |
| Mengonfirmasi hasil      | Pemilik/penerima yang berwenang, detail | Receipt aktual, waktu server, status aksi dan bukti/QR bila sudah committed    | Retry tidak menggandakan aksi; hasil tidak pasti bukan sukses                                    |
| Menyelesaikan permintaan | Sistem, detail progres                  | Satu penerima yang ditunjuk telah menyetujui versi beku melalui aksi committed | R3: artefak hasil transparan; akses sesudah selesai/ditolak mengikuti S-06 yang disetujui        |

Pemilik tidak memilih gambar QR milik penerima untuk dianggap sudah ditandatangani. QR identitas akun hanya membantu memilih penerima. QR bukti dokumen diperlihatkan setelah aksi sah, dan pemindaian tetap melalui login serta pengecekan relasi.

Pada detail permintaan pending, penerima meninjau preview dan menempatkan penanda di area kosong tiap halaman. Penanda mendukung mouse/sentuhan/tombol panah, nomor halaman, perbesaran dan salin posisi ke semua halaman bila muat. Setujui aktif setelah seluruh posisi valid; Tolak tetap tersedia dengan alasan wajib. Dialog konfirmasi menjelaskan bahwa posisi dikunci dan bukti hanya di web. Sesudah commit, halaman bukti menampilkan keputusan dan status PDF hasil; QR tidak diterbitkan saat editor masih berupa penanda. Hasil baru mempunyai jumlah halaman sama dengan sumber; hasil lama tetap utuh.

Tidak ada tombol approve/reject/request revision admin pada alur target baru. Source R3 menambahkan approve/reject penerima dan receipt privat; aktivasi cloud 010 dilaporkan berhasil dan preflight lulus 43 pemeriksaan; [penerimaan peserta R3](r3-cloud-report.md) lulus setelah kelanjutan yang ditinjau pada fixture yang sama. Istilah “Tolak permintaan” kelak merupakan keputusan penerima terhadap undangan, bukan review administratif lama. Masa undangan 168 jam, pembatalan pending oleh pemilik, serta pencabutan akses sesudah rejected/cancelled/expired sudah disetujui. Permintaan baru pada R2 memakai draft baru. Konfirmasi/penolakan mengikuti S-05/S-09/S-13 dan [kontrak R3](r3-implementation-plan.md).

## 3. Inventaris layar usulan

| Layar                     | Konten dan interaksi inti                                                                                | State penting                                                                                           |
| ------------------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Ringkasan pengguna        | Dokumen milik sendiri, permintaan masuk/terkirim yang menjadi relasi akun, pekerjaan yang perlu tindakan | Empty nyata, error parsial, data usang, loading; tidak ada statistik global platform                    |
| Dokumen saya              | Daftar dokumen pemilik, filter, versi, aksi menyiapkan permintaan                                        | Data owner-only; penolakan akses tidak membocorkan record akun lain                                     |
| Unggah/siapkan draft      | Metadata yang sudah disetujui, PDF, validasi, teks kebijakan baru setelah disahkan                       | Upload pending nyata, batal sebelum kirim, error field, hasil commit tidak pasti                        |
| Pilih penerima            | Input kode, tombol cari/pilih, identitas minimum, konfirmasi tujuan                                      | Belum dicari, lookup pending, penerima belum dapat dipilih, rate limited; tidak ada daftar email publik |
| Detail dokumen/terkirim   | Versi sumber, penerima, progres per aksi, riwayat, bukti yang tersedia                                   | Bukti belum tersedia sebelum committed; perubahan versi tidak diam-diam mengubah permintaan             |
| Permintaan masuk          | Daftar yang ditujukan pada akun aktif, pengirim minimum, dokumen/versi, status                           | Empty, tidak lagi dapat ditindaklanjuti, akses ditolak; status menurut state machine final              |
| Detail permintaan         | Metadata minimum, preview privat, teks persetujuan, tindakan signer                                      | Preview gagal tidak dianggap selesai membaca; tindakan dinonaktifkan jika tidak memenuhi prasyarat      |
| Dialog konfirmasi         | Identitas akun aktif, nama dan versi dokumen, tindakan yang akan dicatat                                 | Persetujuan eksplisit, pending, sesi berubah, konflik, retry, error layanan                             |
| Bukti dan QR              | Penerima/aktor terkait, versi/artefak, waktu, hasil pemeriksaan yang tepat                               | Memerlukan login dan relasi; opaque identifier tidak membuka PDF sendiri                                |
| Profil                    | Informasi akun, tema, kode akun dan opsi QR identitas                                                    | Label “QR identitas akun”; tidak mengklaim tanda tangan untuk dokumen tertentu                          |
| Admin overview            | Enam indikator operasional dengan timestamp, sumber dan cakupan                                          | Belum tersedia bila belum ada instrumentasi, error per blok, nol hanya dari query sukses                |
| Aktivitas/kegagalan admin | Metadata operasional minimum, jenis operasi, waktu, hasil, kebutuhan tindak lanjut                       | Tidak ada body PDF, secret, token, atau aksi menandatangani sebagai pengguna                            |
| Audit admin               | Aktor, waktu, target minimum, alasan tindakan dan hasil sesuai permission                                | Riwayat immutable; ekspor dan akses sensitif menunggu kebijakan                                         |

Ukuran detail atau jumlah tabel mengikuti tugas layar. Rincian kartu/dashboard tidak dibuat dengan data demo yang seolah berasal dari database. Grafik ditambahkan hanya jika event nyata, definisi metrik, dan kebutuhan operasionalnya tersedia.

## 4. Route R2 dan target berikutnya

Route draft/undangan berikut tersedia pada source R2. Route bukti/admin tambahan masih target dan tidak memperoleh permission hanya dari sitemap. Aktivasi cloud R2 mengikuti migration 009; `/documents` serta `/submit` tetap jalur administratif legacy.

| Tujuan                   | Kandidat route                                                           |
| ------------------------ | ------------------------------------------------------------------------ |
| Ringkasan                | `/dashboard`                                                             |
| Dokumen pemilik R2       | `/signing/documents`, `/signing/documents/:documentId`                   |
| Persiapan draft R2       | `/signing/new`                                                           |
| Permintaan masuk         | `/requests/incoming`, `/requests/:requestId`                             |
| Permintaan terkirim      | `/requests/outgoing`                                                     |
| Pemeriksaan bukti privat | Target R3, belum aktif; `/evidence/:opaqueEvidenceId` merupakan kandidat |
| Profil/kode akun         | `/profile`                                                               |
| Admin overview           | `/admin/overview`                                                        |
| Aktivitas operasional    | `/admin/activity`                                                        |
| Kegagalan                | `/admin/operations`                                                      |
| Audit administratif      | `/admin/audit`                                                           |

Setiap route privat memerlukan sesi, otorisasi relasi, dan guard server walaupun tautannya tidak terlihat di navigasi. Bentuk URL tidak memberi permission. QR bukti tidak memakai kode akun, raw token, atau secret sebagai URL. Generic not-found harus dipakai untuk record yang tidak boleh diketahui pengguna lain, sesuai kontrak keamanan final.

## 5. Model status UI yang masih berupa rancangan

Bahasa tampilan V1 dapat mencakup Draft, Menunggu tanda tangan, Selesai, Ditolak, Dibatalkan, atau Kedaluwarsa. Kontrak enum dan transisi terminal masih perlu dirinci; label ini tidak memetakan status administratif lama menjadi status tanda tangan. **Selesai hanya ditampilkan setelah persetujuan satu penerima committed dan PDF hasil ber-QR sudah disimpan serta diverifikasi**, sesuai kontrak teknis. Saat rendering/finalisasi belum berhasil, UI menyatakan persetujuan tercatat dengan hasil sedang diproses atau gagal diproses; kondisi itu tidak diubah menjadi penolakan pengguna.

- V1 tidak menampilkan status sebagian, giliran, kuorum, atau penambahan penandatangan kedua.
- Multi-penandatangan merupakan arah masa depan yang memerlukan keputusan baru; tidak ada route atau permission tersembunyi untuk mengaktifkannya.
- R2 mengikuti aturan tujuh hari dan akses S-06/S-07 yang disetujui, dengan status pending/cancelled dan proyeksi expired. Pembatalan sesudah keputusan dan reaktivasi tidak diaktifkan. Status consented/completed/rejected dicadangkan; aksi untuk menghasilkannya berada pada R3.
- Kegagalan teknis atau hasil commit tidak pasti adalah keadaan operasi yang membutuhkan rekonsiliasi, bukan otomatis “Ditolak” atau bukti pengguna membatalkan.

## 6. Identitas visual dan responsive

Pertahankan token dan tujuh gambar referensi asli sebagai acuan visual: permukaan silver/white, sidebar graphite, CTA biru yang kontras, tipografi konsisten, Light/Dark Mode, dan ruang kosong yang tenang. Revisi produk tidak memberi izin mengganti identitas desain atau meniru branding Privy.

Desktop menggunakan sidebar dan header yang sudah ada; halaman kerja fokus pada daftar, preview, penerima, dan aksi utama. Tablet memakai sidebar ringkas/drawer. Mobile memakai drawer, daftar dalam kartu/row yang mudah dibaca, tombol sentuh yang layak, serta preview dan konfirmasi tersusun vertikal. Tabel lebar tidak dipaksa menjadi kolom sempit yang tidak terbaca.

Gunakan komponen button, input, table/mobile list, modal, status badge, notification, empty/error/loading, dan theme switcher yang sudah ada. Tampilan menu bersumber dari permission, tetapi backend tetap menjadi sumber keputusan akses. Tindakan destruktif atau final memerlukan dialog yang jelas dan fokus keyboard kembali ke pemicu setelah dialog ditutup.

Copy antarmuka berfokus pada tindakan dan makna hasil. Detail migration, service key, nama schema, dan implementasi parser tidak masuk alur pengguna biasa. Error operasi memberi langkah pemulihan yang berguna tanpa menampilkan respons provider, path Storage, atau secret.

## 7. Kompatibilitas dan pemeriksaan sebelum handoff

| Area baseline                                | Perlakuan pada revisi                                                                                                                              |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/admin/review-queue`, review detail/history | Tidak diteruskan sebagai alur rutin produk baru; route/role lama harus ditinjau dalam migrasi, bukan diganti label menjadi tanda tangan            |
| `/submit` Phase 3                            | Masih mengirim submission administratif pada baseline; jangan memberi copy baru yang menjanjikan permintaan tanda tangan sampai backend baru aktif |
| `/documents/:id`                             | Metadata dan status legacy dipertahankan; rencana perlu pemisahan mode/model yang mencegah salah tafsir record lama                                |
| `/verify` shell lama                         | Tidak otomatis menjadi verifikasi publik atau pemeriksa tanda tangan baru                                                                          |
| Profil/tema/komponen                         | Digunakan kembali, dengan kode akun/QR identitas hanya setelah kontrak identifier aman dan server-nya tersedia                                     |
| Navigation admin                             | Baru boleh menampilkan fitur operasional yang sudah tersedia dan diotorisasi; menu tidak menandakan permission aktif                               |

Sebelum implementasi, catat target internal dan satu penerima yang sudah disetujui pada register; selesaikan metode konfirmasi, versi/artefak, sharing, masa akses, terminal state, dan wewenang admin. Sesudah implementasi, uji akses owner/penerima/pengguna lain, route langsung, versi yang tidak dibagikan, QR tanpa sesi, retry, konflik, theme, responsive, keyboard, dan kondisi layanan gagal. Screenshot tetap merupakan bukti visual, bukan bukti izin atau transaksi database.
