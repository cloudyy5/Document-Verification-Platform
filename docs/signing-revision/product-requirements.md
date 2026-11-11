# Addendum kebutuhan produk — permintaan tanda tangan

**S-15/source 0.8.1, 11 November 2026:** pengguna meminta akun ber-role `platform_admin` hanya memakai Admin Workspace serta login email/password biasa memilih dashboard sesuai role database. Role admin mempunyai prioritas atas role `user` yang masih tercatat. Pengaturan akun sendiri tetap dapat dibuka di shell admin; halaman/API aplikasi User Workspace dibatasi. [Laporan implementasi](admin-workspace-report.md) dan [register keputusan](decision-register.md) menjadi acuan perubahan ini tanpa menghapus data/riwayat atau menambah migration.

Disusun 4 November 2026; checkpoint **10 November 2026**. Target internal dan satu penandatangan, lifecycle S-06/S-07, consent development S-08, serta keputusan S-05/S-13/S-14 sudah disetujui. R3 format awal telah lulus cloud; revisi posisi QR R3b tersedia pada source dengan migration 011 dilaporkan aktif dan preflight API lulus 47 pemeriksaan; [penerimaan peserta cloud format baru](qr-placement-cloud-report.md) telah lulus. [Kontrak posisi QR](qr-placement-contract.md) dan [laporan R3b](qr-placement-report.md) menjadi acuan hasil baru. Source monitoring R4 kini tersedia sesuai S-11; migration 012 dilaporkan berhasil dipasang dan preflight 49 lulus. Penerimaan sesi admin cloud masih menunggu.

Paket spesifikasi v1.0.2, design assets, tokens, dan migration lama dipertahankan. Source R2 menambah model undangan terpisah; Phase 3 tetap sebagai arsip administratif. Migration 009 sudah diuji pada PostgreSQL terisolasi dan pengguna melaporkan pemasangannya pada cloud. [Preflight API](r2-activation-check.md) lulus pada 9 November 2026; alur pengirim dan penerima cloud lulus satu skenario/tujuh kelompok sesuai [hasil uji R2](r2-cloud-report.md). Addendum hanya menggantikan aturan lama pada cakupan yang disahkan dalam register serta diimplementasikan melalui perubahan yang diuji; dokumen sendiri tidak mengubah role atau akses file.

## 1. Tujuan dan batas klaim

Pengguna mengunggah dokumen lalu meminta pengguna lain menandatanganinya melalui kode akun unik. Penerima membaca versi dokumen yang diminta dan mengambil keputusan melalui akunnya sendiri. Admin berfokus pada monitoring dan operasional; persetujuan admin bukan langkah rutin untuk menyelesaikan permintaan.

Pengguna secara eksplisit memilih **prototipe persetujuan dokumen internal**. TTE tersertifikasi, integrasi penyedia sertifikat, KYC, dan klaim kesetaraan dengan Privy berada di luar MVP aktif. UI tidak boleh menyebut QR, hash, login, atau catatan persetujuan sebagai sertifikasi tanda tangan, autentikasi penerbit, atau jaminan keabsahan hukum. Anggaran Rp0 dan larangan aktivasi layanan berbayar tetap berlaku. S-05/S-13 tetap memakai sesi tervalidasi dan konfirmasi eksplisit tanpa password ulang serta alasan reject wajib maksimal 1.000 karakter. S-14 menggantikan S-09 untuk hasil baru: penerima mengatur posisi QR pada setiap halaman asli dan bukti hanya di web, tanpa halaman bukti tambahan.

Pengguna secara eksplisit memilih **satu penandatangan pengguna lain untuk versi awal**. Satu permintaan menunjuk tepat satu akun penerima yang berbeda dari pemilik; pemilik tidak menandatangani mewakili penerima. Multi-penandatangan, kuorum, paralel, dan urutan giliran berada di luar MVP aktif. Usulan masa depan tidak mengubah batas ini.

## 2. Aktor dan batas wewenang

| Aktor dalam suatu permintaan | Tujuan                                                                     | Batas yang wajib dijaga                                                                                                     |
| ---------------------------- | -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Pemilik dokumen              | Mengunggah dan menyiapkan permintaan, memilih penerima, melihat progres    | Tidak boleh menandatangani sebagai penerima atau menyatakan penerima sudah setuju hanya karena kode akunnya diketahui       |
| Penerima undangan            | Membaca versi yang dituju dan memilih menandatangani atau menolak          | Hanya boleh bertindak sebagai identitas sesi sendiri pada undangan yang sah; tidak memperoleh seluruh arsip pemilik         |
| Admin operasional            | Melihat agregat, metadata operasional minimum, dan audit sesuai permission | Tidak otomatis boleh membaca semua PDF, memberi tanda tangan pihak lain, mengubah bukti persetujuan, atau menghapus riwayat |
| Pengguna lain dan guest      | Autentikasi serta halaman publik yang sudah diperbolehkan                  | Kode akun atau QR tidak memberi akses dokumen; pencarian lintas akun dan verifikasi publik tetap tertutup                   |

Pemilik dan penerima merupakan relasi pada dokumen/permintaan, bukan role global baru yang otomatis memberi akses ke dokumen lain. Satu akun dapat menjadi pemilik pada dokumen A dan penerima pada dokumen B. Admin yang juga menjadi peserta memakai hak peserta normal pada permintaan tersebut, bukan akses khusus untuk menandatangani sebagai pihak lain.

Penangguhan akun, penggantian role, akses isi untuk dukungan, pemulihan identitas, pengelolaan sengketa, ekspor audit, retensi, dan penghapusan memerlukan kebijakan terpisah. Tabel peran ini tidak memberi izin untuk mengaktifkan tindakan tersebut.

## 3. Kebutuhan fungsional

| ID      | Kebutuhan arah revisi                 | Batas penerimaan                                                                                                                                                                                                                                |
| ------- | ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SGN-001 | Autentikasi dan email terverifikasi   | Gunakan Supabase Auth dan guard server yang sudah ada. Konfirmasi email bukan verifikasi identitas hukum. S-05: sesi tervalidasi + konfirmasi eksplisit tanpa password ulang                                                                    |
| SGN-002 | Kode unik akun untuk memilih penerima | Kode merupakan identifier, bukan secret atau bukti persetujuan. Tidak menggunakan nomor berurutan yang mudah ditebak. Hasil lookup hanya menampilkan identitas minimum untuk memastikan tujuan                                                  |
| SGN-003 | Lookup penerima yang terkendali       | Sesi sah, pembatasan percobaan, respons minimum, dan perlindungan enumerasi wajib dirancang. Tidak ada direktori publik, pencarian wildcard seluruh pengguna, atau pengungkapan email/telepon hanya dari kode                                   |
| SGN-004 | Upload PDF privat dan metadata        | Pertahankan validasi server, hash byte asli, kategori, metadata delapan field, maksimum 10 MiB yang dapat diturunkan, dan penolakan enkripsi. Kebijakan sharing dan persetujuan baru harus ditinjau sebelum form baru diaktifkan                |
| SGN-005 | Menyiapkan dan mengirim permintaan    | Pemilik memilih penerima yang telah dikonfirmasi. Pengiriman membekukan versi sumber dan tepat satu penerima yang berbeda dari pemilik. Kode akun yang ditemukan tidak otomatis mengirim undangan                                               |
| SGN-006 | Kotak masuk penerima                  | Menampilkan undangan yang benar-benar ditujukan kepada akun aktif, versi sumber, identitas pengirim minimum, dan status. Data dokumen lain tetap tidak ditemukan                                                                                |
| SGN-007 | Membaca dan mengonfirmasi             | Penerima membuka PDF privat dan melihat versi yang sama dengan versi pada permintaan. Aksi menandatangani memerlukan persetujuan eksplisit, bukan checkbox yang sudah tercentang atau aksi otomatis saat preview                                |
| SGN-008 | Bukti aksi penandatanganan            | Catat identitas sesi, permintaan, versi, hash sumber, versi teks persetujuan, waktu server, dan hasil transaksi. S-05 memakai sesi tervalidasi + konfirmasi eksplisit, dengan HMAC binding audit privat; tanpa password ulang                   |
| SGN-009 | QR bukti yang terikat dokumen         | QR baru tersedia setelah aksi sah berhasil. Identifier bukti unik untuk kejadian/versi terkait, tidak memuat secret, dan tidak memberi hak tanda tangan atau akses PDF dengan sendirinya                                                        |
| SGN-010 | Riwayat dan retry                     | Aksi ganda atau respons jaringan yang hilang tidak membuat dua bukti tanda tangan. Riwayat tidak ditimpa. Hasil belum pasti ditampilkan sebagai belum terkonfirmasi sampai server merekonsiliasi                                                |
| SGN-011 | Penyelesaian permintaan               | Syarat persetujuan V1 adalah satu penerima yang ditunjuk menyetujui versi beku melalui aksi sah yang committed dan artefak hasil siap. Lifecycle/pencabutan akses S-06/S-07 sudah disetujui; aksi keputusan dan finalisasi hasil berada pada R3 |
| SGN-012 | Pemeriksaan bukti privat              | Pemilik dan peserta yang berwenang dapat memeriksa bukti untuk versi yang dibagikan. Pemindaian QR tetap memerlukan autentikasi dan pemeriksaan relasi server. Tidak ada lookup PDF publik                                                      |

Lookup yang gagal tidak boleh membocorkan apakah suatu akun diblokir, belum terverifikasi, dihapus, atau sekadar tidak cocok. Teks publik yang netral dapat berupa “Penerima belum dapat dipilih. Periksa kode dan coba kembali.” Konfirmasi penerima berhasil tidak mengungkap data pribadi yang tidak diperlukan.

Kode akun boleh mempunyai QR identitas untuk dibagikan. QR identitas harus diberi label berbeda dari QR bukti dokumen; QR tetap milik akun tidak diperlakukan sebagai tanda tangan yang dapat ditempel ke sembarang PDF.

**SGN-013 — penempatan QR oleh penerima (S-14):** sebelum approve, penerima menempatkan penanda pada area kosong di setiap halaman sumber, dapat menggesernya dengan mouse/sentuhan/tombol panah, dan mengonfirmasi seluruh posisi. Posisi terikat versi/hash dan immutable setelah commit. PDF hasil baru mempertahankan jumlah halaman sumber; scan membuka `/receipts/:id` privat di web. Tidak ada halaman bukti PDF tambahan. Hasil lama tidak diubah.

## 4. Batas akses versi dan file

Untuk SGN-009/SGN-011, PDF hasil dengan QR yang terlihat merupakan keluaran V1 yang direncanakan. Status **Selesai** dan metrik **Dokumen selesai** mensyaratkan persetujuan penerima yang committed serta artefak PDF ber-QR yang tersimpan dan terverifikasi. Persetujuan dengan rendering tertunda/gagal tetap tercatat, tetapi belum dihitung sebagai dokumen selesai. Hash PDF sumber dan hash PDF hasil dipisahkan sesuai [kontrak teknis](technical-contract.md).

Hak penerima merupakan perluasan terkontrol pada model R2 terpisah. Source/API/RLS telah diimplementasikan; perjalanan cloud undangan/pembatalan sudah lulus penerimaan development R2. Kontrak akses yang disetujui dan diuji:

- Akses harus diturunkan dari undangan sah ke akun yang terautentikasi, bukan parameter `recipientId` dari browser, kode yang diketahui, atau kepemilikan URL.
- Undangan menunjuk versi sumber tertentu yang immutable. Undangan pada versi 2 tidak memberi hak otomatis pada versi 1, versi 3, atau dokumen lain milik pengirim.
- Pembacaan metadata, PDF, download dan range response memakai pemeriksaan relasi yang konsisten. Penerima boleh preview/download tepat versi undangan selama pending aktif dan setelah consented/completed; bukti/artefak hasil baru dibangun pada R3.
- Penggantian PDF atau penerima setelah pengiriman tidak boleh mengubah diam-diam objek yang telah disetujui. R2 tidak menyediakan edit/reissue; satu request per dokumen dan permintaan baru memakai draft baru. Pembatalan pending oleh pemilik dicatat secara atomik dan dapat diaudit.
- Undangan berlaku 168 jam. Akses PDF/metadata sumber penerima dicabut sesudah rejected/cancelled/expired; riwayat minimum request tetap tersedia, tanpa menghapus dokumen/riwayat. Pemilik tetap mendapat hak atas dokumennya. Aturan penangguhan akun, perpanjangan dan reaktivasi tidak diaktifkan.
- QR hanya menunjuk record bukti privat. Tidak ada public bucket, signed URL yang dibagikan sebagai hak permanen, token login di QR, atau perubahan schema `private` menjadi exposed.

Hash PDF sumber dan hash PDF hasil yang memuat QR merupakan hal berbeda bila byte berubah. Klaim kecocokan harus menyebut artefak/versi yang diperiksa. Mekanisme R3b mengikuti manifest penempatan immutable dan render sesudah commit pada [kontrak posisi QR](qr-placement-contract.md); aktivasi 011 dilaporkan berhasil dan preflight lulus; [penerimaan peserta cloud](qr-placement-cloud-report.md) telah lulus pada satu fixture dua halaman. Beberapa penandatangan tetap di luar MVP aktif.

## 5. Admin operasional dan enam indikator awal

**S-11 disetujui pada 11 November 2026.** R4 baca-saja khusus `platform_admin`, tanpa nama/email pengguna lain, judul atau isi PDF; reviewer saja tidak memperoleh monitoring global. Dari usulan awal di bawah, indikator aktif dikonkretkan menjadi **Aktif beraktivitas dokumen (30 hari)**, berdasarkan akun unik dengan upload/kirim/keputusan signing committed selama 720 jam, bukan login. Operasi gagal dikonkretkan menjadi **Hasil PDF perlu perhatian**: kondisi gagal/proses render melewati batas waktu saat ini, dikeluarkan setelah pulih. [Kontrak R4](r4-implementation-contract.md) menetapkan definisi final; [laporan R4](r4-report.md) mencatat implementasi serta aktivasi 012 yang dilaporkan berhasil dan preflight 49 lulus; sesi admin cloud belum dibuktikan. Usulan jendela login/seluruh error pada tabel awal bukan fitur yang dirilis.

Dashboard memprioritaskan angka ringkas, daftar pekerjaan yang benar-benar perlu ditangani, serta kondisi layanan. Tidak diperlukan grafik dekoratif. Semua indikator harus memiliki definisi, cakupan lingkungan, timestamp data, dan sumber yang sah.

| Indikator              | Definisi yang diusulkan                                                                                                                       | Aturan kejujuran data                                                                                                                                      |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pengguna terdaftar     | Jumlah akun aplikasi unik pada lingkungan yang dipilih dan waktu acuan server                                                                 | Bukan jumlah sesi. Kebijakan akun terhapus/ditangguhkan dicatat pada label/filter; jangan menghitung profil parsial sebagai total Auth tanpa penjelasan    |
| Pengguna aktif 30 hari | Akun unik dengan sedikitnya satu login berhasil, upload committed, atau aksi tanda tangan committed dalam interval 30 hari hingga waktu acuan | Memerlukan event server yang sah; refresh token atau polling tidak dihitung. Jika instrumentasi belum tersedia, tampilkan belum tersedia                   |
| Dokumen diunggah       | Jumlah dokumen logis unik yang setidaknya memiliki satu upload berhasil committed                                                             | Percobaan gagal dan retry tidak menambah angka. Jumlah versi/file ditampilkan terpisah bila diperlukan                                                     |
| Dokumen selesai        | Jumlah dokumen/permintaan pada versi yang disetujui satu penerima wajib V1 dan memenuhi kontrak status hasil yang disepakati                  | `approved` administratif lama bukan `signed` atau `completed`. Status operasional bukti/artefak hasil harus dibedakan dari aksi persetujuan yang committed |
| Permintaan tertunda    | Jumlah permintaan terkirim yang masih memerlukan aksi penerima sesuai state machine baru                                                      | Draft tidak dihitung; retry pengiriman tidak membuat permintaan baru. Model agregasi per permintaan tidak dicampur dengan per penerima                     |
| Operasi gagal          | Jumlah operasi logis gagal pada jendela waktu yang ditampilkan, dipilah menurut jenis dan status rekonsiliasi                                 | Definisikan apakah satu operasi dihitung sekali meski ada retry. Error sementara yang akhirnya sukses tidak diberi label gagal permanen                    |

Jumlah aksi persetujuan merupakan metrik pendukung terpisah dan retry tidak menambahnya. Pada V1 hanya ada satu penerima per permintaan. Bila multi-penandatangan kelak disetujui, jumlah dokumen, jumlah aksi, dan penyelesaian seluruh pihak harus tetap dibedakan; kebutuhan masa depan itu tidak diaktifkan sekarang.

Tidak ada angka hardcoded atau fallback error menjadi nol. Nol hanya tampil jika query sah selesai dan hasilnya memang nol. Source belum terhubung memakai status belum tersedia; error parsial ditampilkan per blok. Data development tidak dipresentasikan sebagai produksi. Admin hanya mendapat agregat dan metadata minimum; statistik tidak memberikan hak membaca seluruh isi PDF.

## 6. Prioritas dan batas MVP

Urutan pengembangan yang diusulkan: mencatat target internal dan satu penerima yang sudah disetujui → mengunci kontrak state/permission/versi → menyediakan kode akun dan draft privat → permintaan serta kotak masuk → konfirmasi dan bukti → QR/pemeriksaan privat → monitoring admin yang bersumber dari event nyata. Rincian tahapan dan gate berada pada roadmap revisi yang dikoordinasikan pemilik proyek.

Di luar MVP aktif: TTE tersertifikasi, multi-penandatangan, kuorum, paralel/berurutan, verifikasi publik, sertifikasi keaslian penerbit, klaim sah hukum, KYC berbayar, integrasi PSrE, pembayaran, email/SMS eksternal baru, tanda tangan mewakili pihak lain, perubahan admin global terhadap dokumen, user suspension/deletion, ekspor massal, dan retensi otomatis. Hal tersebut tidak diaktifkan hanya karena ada contoh menu atau gambar.

## 7. Dampak terhadap baseline

| Baseline lama                                | Arah baru                                                       | Perlakuan sebelum implementasi                                                                        |
| -------------------------------------------- | --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Upload menghasilkan `pending_review`         | Upload menyiapkan versi/draft untuk permintaan                  | Jangan mengganti label atau arti record lama secara massal                                            |
| Empat checklist dan keputusan reviewer       | Penerima memberikan persetujuan atas dokumen yang dituju        | Tidak memetakan checklist ke persetujuan penerima dan tidak menganggap reviewer sebagai penandatangan |
| Credential setelah approve admin             | Bukti/QR setelah aksi penerima sah                              | Perlu model dan transaksi baru; credential lama tidak otomatis menjadi bukti tanda tangan             |
| C-02 owner-only                              | Relasi pemilik serta penerima yang diundang pada versi tertentu | Perlu perubahan RLS/API secara eksplisit; tidak memperluas tabel lama dengan policy allow-all         |
| R-05 antrean reviewer bersama                | Monitoring admin tanpa antrean review rutin                     | Permission reviewer lama tidak otomatis digunakan untuk membaca semua dokumen dalam produk baru       |
| Hash matching pada versi approved            | Pemeriksaan artefak sumber/hasil dan bukti terkait              | Arti kecocokan dan artefak harus dirumuskan ulang, tanpa klaim tanda tangan dari hash saja            |
| Developer consent untuk review administratif | Persetujuan penyimpanan/sharing dan aksi penandatanganan        | Teks lama tidak otomatis mencakup tujuan baru; membutuhkan versi kebijakan dan persetujuan baru       |

Auth, private Storage, pemeriksaan server, perlindungan secret, validasi PDF, SHA-256, idempotency, immutable history, komponen, dan tema dipertahankan sebagai fondasi. Aturan produksi/scanner/retensi yang masih terbuka tidak hilang karena role reviewer berkurang.

## 8. Keputusan yang menghalangi aktivasi

Target internal, satu penandatangan pengguna lain, akses/lifecycle tujuh hari, consent development serta S-05/S-09/S-13 sudah diputuskan dan tidak ditanyakan ulang. Source R3 menyediakan keputusan dan PDF ber-QR; cloud 010 dilaporkan aktif dan preflight lulus 43 pemeriksaan; [penerimaan peserta development](r3-cloud-report.md) lulus setelah kelanjutan yang ditinjau. [Kontrak R3](r3-implementation-plan.md) merinci implementasi. Gate berikutnya:

1. Peninjauan hasil R3 development sebelum perluasan scope; aktivasi, preflight dan fixture peserta sudah terbukti pada batas yang tercatat di laporan cloud.
2. Kebijakan dan teks produksi di luar persetujuan development; hak file tetap mengikuti S-06.
3. Perluasan di luar R2 seperti perpanjangan, reaktivasi, penggantian penerima pada request lama, atau pengelolaan versi tambahan.
4. Penyempurnaan format PDF/dukungan font bila diperlukan; jangan mengubah placement S-09 atau menerbitkan hasil saat render belum ready.
5. Kanal notifikasi serta batas frekuensi dan anti-spam; tidak diasumsikan ada pengiriman email baru.
6. Kewenangan admin, pengelolaan akun, dukungan, audit, dan retensi.

Keputusan di atas dicatat pada register revisi dengan sumber persetujuannya. Rekomendasi teknis dan screenshot bukan sumber persetujuan kebijakan bisnis. [Workflow dan sitemap](workflows-and-sitemap.md) membedakan layar R2 pada source dari layar target R3/R4. R2 memakai notifikasi in-app generik; email/SMS dan direktori baru tidak diasumsikan.
