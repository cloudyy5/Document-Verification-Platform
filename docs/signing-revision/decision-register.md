# Register keputusan revisi signing V1

Disusun: **4 November 2026**. Checkpoint: **10 November 2026**, Asia/Makassar. Register ini menambahkan keputusan baru, mempertahankan sejarah `DECISION_REGISTER.md` asli, dan membedakan scope yang disetujui dari rekomendasi teknis. Dokumen bukan migration atau pemberian permission.

## Persetujuan pengguna

| ID   | Keputusan                                                                                                                             | Sumber dan status                                                                                                |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| S-01 | Arah produk menjadi permintaan tanda tangan/persetujuan antar-pengguna melalui kode akun                                              | Permintaan stakeholder yang disampaikan pengguna, diikuti instruksi melanjutkan                                  |
| S-02 | Target V1 adalah prototipe persetujuan internal                                                                                       | Jawaban eksplisit: “Prototipe persetujuan internal”                                                              |
| S-03 | V1 mendukung satu penandatangan pengguna lain                                                                                         | Jawaban eksplisit: “Satu penandatangan dahulu”; permintaan awal menyebut pengguna lain                           |
| S-04 | Admin berfokus pada monitoring dan operasional, bukan reviewer rutin setiap dokumen                                                   | Arah stakeholder dan instruksi melanjutkan setelah usulan peran admin; rincian hak istimewa tetap terbatas       |
| S-06 | Penerima boleh preview/download versi undangan selama aktif dan setelah selesai; akses PDF dicabut sesudah rejected/cancelled/expired | Jawaban eksplisit: “Setuju aturan tersebut”; tidak membuka versi atau dokumen lain                               |
| S-07 | Undangan berlaku 7 hari/168 jam; pemilik boleh membatalkan sebelum penerima memutuskan; kedaluwarsa tidak menghapus dokumen/riwayat   | Jawaban eksplisit: “Setuju aturan tersebut”; reaktivasi dan perpanjangan tidak diaktifkan                        |
| S-08 | Teks consent penyimpanan, berbagi, dan aksi internal pada development-consent.md disetujui untuk dokumen sintetis development         | Jawaban eksplisit: “Setujui untuk development”; metode autentikasi aksi R3 dan kebijakan produksi tetap terpisah |

S-02 mengeluarkan TTE tersertifikasi, integrasi provider/PKI, dan klaim setara Privy dari V1. S-03 mengeluarkan multi-penandatangan, mode paralel/berurutan, self-sign dan kuorum dari implementasi awal. Perlu revisi eksplisit untuk memperluas scope tersebut.

Keputusan R3 pada **10 November 2026**:

- **S-05 disetujui:** tanpa memasukkan ulang password. Sesi Supabase divalidasi dan email harus terverifikasi; dialog konfirmasi/checkbox eksplisit mengikat tindakan ke versi/hash. Tidak ada OTP atau penggunaan proof recovery.
- **S-09 disetujui pada format awal R3:** QR kiri bawah **semua halaman asli**, serta satu halaman bukti tambahan. PDF hasil menyediakan ruang footer agar isi sumber tidak tertutup; sumber disimpan utuh. **Digantikan S-14 untuk persetujuan baru**; hasil lama tetap immutable.
- **S-13 disetujui:** alasan penolakan wajib, di-trim, maksimal 1.000 karakter; privat bagi owner dan penerima. Penolakan tidak menerbitkan QR.

Source/migration R3 mengikuti [kontrak R3](r3-implementation-plan.md); status pengujian dan aktivasi ada di [laporan R3](r3-report.md).

Revisi **S-14 disetujui**, 10 November 2026: **penerima** mengatur posisi QR sebelum menyetujui, **semua halaman asli** memiliki posisi yang dapat diatur sendiri, dan **halaman bukti tambahan dihapus dari hasil baru**. Pemindaian QR membuka bukti persetujuan di web, tetap privat bagi peserta yang berhak. [Kontrak R3b](qr-placement-contract.md) mengikat posisi ke versi/hash dan keputusan immutable. Source v0.7.0 serta tes lokal tersedia; migration 011 dilaporkan aktif dan preflight API lulus 47 pemeriksaan; [penerimaan peserta cloud format baru](qr-placement-cloud-report.md) telah lulus. S-14 tidak membuka verifikasi publik atau mengizinkan pengubahan hasil lama.

## Batas kontrak yang tetap dijaga

**11 November 2026 — S-15 disetujui melalui permintaan eksplisit pengguna:** akun yang diberi akses `platform_admin` hanya menggunakan Admin Workspace, termasuk bila masih memiliki role `user`. Login email/password biasa mengarahkan ke dashboard sesuai role authoritative; tidak perlu alamat login admin khusus. [Implementasi workspace admin](admin-workspace-report.md) memberi prioritas role admin pada tujuan login, navigasi, guard halaman dan API aplikasi; profil/preferensi akun sendiri tetap tersedia dalam shell admin. Ini tidak menghapus role/data/riwayat atau otomatis memberi permission baru pada database. Ketentuan R4 tentang monitoring baca-saja dan privasi dokumen tetap berlaku.

Kode akun hanya identifier. Persetujuan wajib berasal dari penerima yang terautentikasi dan ditujukan kepada versi dokumen yang dibacanya. QR bukti dikaitkan dengan aksi tersebut, bukan gambar identitas tetap yang dapat dianggap persetujuan untuk setiap file.

Verifikasi publik tetap dilarang oleh ketentuan proyek sebelumnya. Hak peserta harus diperiksa saat membaca metadata, PDF atau bukti; identifier, hash atau QR tidak memberi akses sendiri. Source R2 menerapkan delegasi baca ke versi yang diundang melalui endpoint dan RLS baru. Migration 009 telah diuji pada PostgreSQL terisolasi; pengguna melaporkan pemasangan pada Supabase development 9 November 2026 dan preflight API lulus 26 pemeriksaan. [Catatan aktivasi](r2-activation-check.md) membedakan bukti tersebut dari [uji peserta cloud R2](r2-cloud-report.md) yang telah lulus setelah persetujuan fixture terpisah. Data dan izin legacy tetap terpisah.

Admin tidak otomatis mendapat isi PDF, impersonation, kewenangan menandatangani, role assignment, penangguhan/penghapusan akun atau penghapusan bukti. Akses monitoring minimum harus diuji tersendiri. Budget Rp0, secret server-only, private Storage, tidak ada statistik palsu, serta preservasi dokumen/aset/migration tetap berlaku.

## Keputusan terbuka sebelum fitur terkait diaktifkan

**11 November 2026 — S-11 disetujui:** pengguna menjawab **“Setujui batas akses tersebut”**, **“Setujui aktivitas dokumen”**, dan **“Setujui indikator hasil PDF”**. R4 merupakan dashboard baca-saja khusus `platform_admin`; reviewer saja tidak memperoleh monitoring global. Data hanya agregat dan metadata minimum, tanpa nama/email pengguna lain, judul/isi PDF atau akses baru membaca dokumen. Aktif 30 hari dihitung dari akun unik yang berhasil mengunggah draft, mengirim permintaan atau memberi keputusan pada model signing, dengan label aktivitas dokumen. Hasil perlu perhatian dibatasi pada hasil yang saat ini gagal atau prosesnya melewati batas waktu; retry yang pulih tidak menjadi kegagalan permanen. Persetujuan ini tidak mencakup role assignment melalui aplikasi, suspend/delete, impersonation, retry atas nama peserta atau ekspor data pribadi. [Kontrak R4](r4-implementation-contract.md) mencatat implementasi serta batas aktivasi cloud.

| ID   | Keputusan yang diperlukan                                | Rekomendasi untuk ditinjau                                                                                                                     | Gate aktivasi                |
| ---- | -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| S-10 | Perluasan discoverability kode akun dan kanal notifikasi | R2 hanya lookup exact kode acak, DTO minimum, limiter serta notifikasi in-app generik; tidak ada direktori/pencarian email atau email/SMS baru | Perluasan di luar kontrak R2 |
| S-12 | Retensi, penghapusan, scanner dan kebijakan produksi     | Tidak ada auto-purge atau klaim lolos malware/siap produksi berdasarkan QR/hash/build                                                          | Rilis dan fitur penghapusan  |

Rekomendasi pada tabel bukan persetujuan pengguna. Implementasi minimum S-10 mengikuti scope pemilihan penerima lewat kode dan tidak dipresentasikan sebagai persetujuan eksplisit atas direktori atau kanal eksternal baru. Gate berlaku pada fitur yang bergantung padanya; pekerjaan fondasi yang independen tidak harus menunggu seluruh gate rilis. Mekanisme implementasi harus tetap diuji dengan transaksi, RLS dan layanan nyata yang relevan. R2 tidak menyediakan aksi approve/reject atau QR. Konfirmasi/penolakan R3 telah diputuskan pada S-05/S-09/S-13; cakupan monitoring R4 kini mengikuti S-11 yang sudah disetujui, sedangkan perluasan wewenang admin tetap tidak aktif.

## Dampak terhadap keputusan dan alur lama

| Baseline lama                                                  | Perubahan target V1                                           | Perlakuan aman                                                                         |
| -------------------------------------------------------------- | ------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| C-02 owner-only                                                | Owner dan satu penerima yang diberi akses pada versi tertentu | Jangan memperluas RLS legacy secara global; gunakan relasi akses model baru            |
| C-05 pemeriksaan administrator                                 | Persetujuan oleh penerima, tanpa reviewer rutin               | Tidak melanjutkan Phase 4 review lama sebagai fitur inti baru                          |
| C-03/C-04 kode, QR dan hash untuk verifikasi dokumen disetujui | Kode akun untuk penerima dan QR per bukti persetujuan         | Namespace dan arti terpisah; tidak memindahkan credential lama                         |
| R-05 antrean reviewer bersama                                  | Tidak menjadi permission model signing                        | Riwayat serta permission legacy tidak diubah diam-diam; tidak diwariskan ke tabel baru |
| `approved` administratif                                       | Persetujuan penerima dan hasil ber-QR siap                    | Tidak mengubah label/status data lama menjadi signed/completed                         |
| Consent development review                                     | Consent upload/berbagi + tindakan persetujuan internal        | Teks baru disetujui untuk development; consent lama tidak diperluas otomatis           |

## Catatan operasional

Persetujuan uji cloud satu PDF sintetis dan dua akun pada fase sebelumnya sudah diterima. Percobaan pertama gagal sebelum penyimpanan; nol dokumen/submission/object pada prefix akun uji diverifikasi, lalu kedua akun dibersihkan. Retest R1 pada 5 November 2026 kemudian berhasil, termasuk preview, idempotensi dan isolasi akses. Satu akun pemilik/dokumen sintetis immutable dipertahankan; akun pembanding dibersihkan. [Laporan R1](r1-report.md) mencatat receipt dan batas bukti. Runner fixture cloud lama menolak pengulangan setelah sukses sebelum network; jangan menghapus proof untuk melewatinya. Izin itu tidak diperluas menjadi izin membuat fixture signing R2 tambahan.
