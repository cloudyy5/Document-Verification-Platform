# Rebaseline Document Verification Platform — persetujuan internal V1

**Pembaruan source 0.8.1, 11 November 2026 — S-15:** akun `platform_admin` hanya memakai Admin Workspace. Login email/password biasa otomatis memilih dashboard sesuai role; hint menuju halaman pengguna tidak mengembalikan admin ke User Workspace. Profil/preferensi akun sendiri tetap tersedia dengan shell admin. [Laporan implementasi dan uji](admin-workspace-report.md) membedakan pengujian lokal dari sesi cloud yang masih diperlukan; tidak ada migration baru atau perubahan role cloud otomatis.

**Checkpoint 11 November 2026 — source R4 v0.8.0.** S-11 sudah disetujui: monitoring baca-saja khusus platform admin, aktivitas dokumen 30 hari dan hasil PDF perlu perhatian. [Kontrak](r4-implementation-contract.md) serta [laporan R4](r4-report.md) memuat halaman/API, RPC serta 805 unit/365 SQL native yang lulus. Migration 012 dilaporkan berhasil dipasang dan [preflight API](r4-activation-check.md) lulus 49 pemeriksaan. [Setup admin dan uji baca-saja](r4-cloud-acceptance-plan.md) adalah langkah berikutnya; penerimaan sesi admin cloud belum dibuktikan. R5 belum dimulai. Checkpoint 10 November di bawah mencatat hasil R3b sebelumnya.

Disusun: **4 November 2026**. Checkpoint: **10 November 2026**, Asia/Makassar. Versi spesifikasi revisi: **0.4**, source **0.7.0**. Ini adalah addendum terhadap paket v1.0.2. R1/R2 dan R3 format awal telah lulus penerimaan cloud development; [aktivasi 010](r3-activation-check.md) lulus 43 pemeriksaan. **R3b menambahkan posisi QR yang diatur penerima per halaman dan bukti hanya di web. Source serta pengujian lokal tersedia; migration 011 dilaporkan aktif dan preflight API lulus 47 pemeriksaan. [Penerimaan peserta cloud R3b](qr-placement-cloud-report.md) lulus pada satu fixture dua halaman.** Monitoring R4 belum dikerjakan.

Pengguna sudah memilih **prototipe persetujuan internal** dan **satu pengguna lain sebagai penandatangan**. Arah yang diteruskan adalah pemilik mengunggah dokumen, memilih penerima melalui kode akun, penerima membaca dan mengonfirmasi tindakan, lalu sistem menghasilkan bukti serta PDF ber-QR. Admin berfokus pada monitoring/operasional, tanpa menjadi reviewer rutin.

Pada **10 November 2026**, pengguna menyetujui S-05/S-09/S-13 untuk format awal R3. Revisi **S-14** kemudian menggantikan posisi tetap dan halaman bukti tambahan: penerima mengatur posisi pada setiap halaman asli sebelum approve; bukti dibuka di web setelah scan. Sesi terverifikasi tanpa password ulang, alasan reject wajib dan akses privat tetap berlaku. [Kontrak R3b](qr-placement-contract.md) serta [laporan R3b](qr-placement-report.md) menjadi acuan hasil baru. [Laporan R3](r3-report.md) dan [hasil cloud R3](r3-cloud-report.md) mempertahankan bukti historis format awal.

## Panduan membaca

| Dokumen                                                  | Kegunaan                                                                                        |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| [Register keputusan](decision-register.md)               | Memisahkan persetujuan eksplisit, batas yang tetap berlaku, dan keputusan yang belum ditetapkan |
| [Kebutuhan produk](product-requirements.md)              | Aktor, kebutuhan V1, batas klaim, enam indikator admin, dan perubahan terhadap baseline         |
| [Workflow dan sitemap](workflows-and-sitemap.md)         | Alur pemilik/penerima/admin, layar, route usulan, responsive dan identitas visual               |
| [Kontrak teknis](technical-contract.md)                  | Model data aditif, API, RLS, transaksi, hash sumber/hasil, QR, dan rollout                      |
| [Roadmap R0–R5](implementation-roadmap.md)               | Tahapan kecil dan syarat penerimaan tanpa mengubah sejarah Phase 0–3                            |
| [Rencana penerimaan](acceptance-plan.md)                 | Matriks akses, uji state/race/idempotensi, Storage, admin dan pembuktian hasil                  |
| [Laporan R1](r1-report.md)                               | Bukti upload/file privat cloud pada 5 November 2026 dan fixture yang dipertahankan              |
| [Consent development](development-consent.md)            | Teks yang disetujui untuk upload/berbagi R2 dan aksi R3; metode autentikasi aksi tetap terpisah |
| [Kontrak implementasi R2](r2-implementation-contract.md) | Nama tabel, DTO, API dan batas source R2 yang final                                             |
| [Laporan dan aktivasi R2](r2-report.md)                  | Hasil per lapisan, file, batas bukti dan langkah operator migration 009                         |
| [Kontrak posisi QR R3b](qr-placement-contract.md)        | Aturan S-14, koordinat dan penguncian posisi pada semua halaman sebelum approve                 |
| [Laporan R3b](qr-placement-report.md)                    | File, pengujian lokal, contoh desktop/mobile/PDF dan langkah operator migration 011             |

Pemeriksaan cloud format awal tercatat pada [aktivasi R3](r3-activation-check.md) dan [hasil cloud R3](r3-cloud-report.md). Fixture R1/R2/R3 yang sudah terminal tetap disimpan; runner pembuat data tidak diulang untuk R3b. Bukti cloud format awal tidak membuktikan editor/manifest/hasil format baru.

[Aktivasi R3b](qr-placement-activation-check.md) mencatat 47 pemeriksaan API lulus; [rencana cloud R3b](qr-placement-cloud-acceptance-plan.md) dan runner terpisah sudah tersedia, telah dijalankan sesuai persetujuan fixture; [hasil cloud](qr-placement-cloud-report.md) lulus satu skenario.

## Keputusan inti yang sudah jelas

- V1 merupakan persetujuan internal, bukan layanan TTE tersertifikasi atau integrasi berbayar.
- Satu dokumen dimintakan kepada satu penandatangan pengguna lain; multi-penandatangan, urutan dan kuorum bukan fitur V1.
- Kode akun memilih penerima; mengetahui kode bukan persetujuan dan bukan hak membaca dokumen.
- QR bukti berkaitan dengan aksi dan versi dokumen tertentu. QR identitas pengguna, jika disediakan kemudian, tidak menggantikannya.
- Pemilik dan penerima sah mendapat hak berbasis relasi resource. Admin monitoring tidak otomatis membaca seluruh PDF atau menandatangani atas nama pengguna.
- Desain silver/white, graphite, CTA biru, Light/Dark, serta stack yang sudah dipakai tetap menjadi fondasi.

## Status spesifikasi dan implementasi

| Lapisan              | Status pada checkpoint ini                                                                                                                 |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Scope produk V1      | Internal + satu penandatangan disetujui pengguna                                                                                           |
| Paket kontrak revisi | Tersedia untuk peninjauan; keputusan terbuka ditandai dalam register                                                                       |
| Kode aplikasi        | Source R3b: editor QR semua halaman, manifest immutable, PDF tanpa halaman tambahan; baseline Phase 3 tetap arsip                          |
| SQL dan cloud        | 001-011 tersedia; 011 dilaporkan aktif dan preflight lulus 47 pemeriksaan; satu skenario penerimaan peserta R3b lulus                      |
| Akses penerima       | Server/RLS baru membatasi versi undangan dan lifecycle yang disetujui; lulus perjalanan cloud R2 untuk undangan pending dan pembatalan     |
| QR persetujuan       | QR format awal sudah terbukti pada fixture R3; hasil baru memakai posisi penerima setelah approve committed; satu skenario cloud R3b lulus |
| Bukti lokal R3b      | 763 unit, 340 SQL native, browser dasar 43 lulus/5 skip, editor 4 lulus dan enam QR hasil PDF berhasil dipindai                            |
| Upload cloud legacy  | R1 lulus pada 5 November 2026: upload/file/idempotensi/isolasi akun dan preview nyata; satu fixture dipertahankan                          |

Bug payload worker PDF telah diperbaiki. Probe lokal terhadap factory Turbopack dan worker hasil build nyata menerima fixture 2.831 byte sebagai satu halaman dengan hash fixture yang cocok. Ini membuktikan perbaikan worker production, tidak membuktikan upload/Storage cloud atau alur signing baru.

Checkpoint **5 November 2026** menutup uji cloud fondasi R1: satu skenario penuh lulus dan preview PDF diperiksa secara visual. [Laporan R1](r1-report.md) membedakan hasil fondasi tersebut dari alur signing V1. Akun pembanding dibersihkan; akun pemilik dan satu fixture legacy tetap tersimpan sesuai izin pengguna. Runner lama tidak dijalankan ulang untuk membuat fixture R2.

## Urutan sumber kebenaran

1. Instruksi dan jawaban eksplisit pengguna yang dicatat pada [register revisi](decision-register.md).
2. Persetujuan terdahulu yang masih berlaku pada [catatan keputusan implementasi](../decision-notes.md).
3. Addendum revisi ini, terbatas pada cakupan yang sudah diputuskan. Bagian berstatus usulan tidak dianggap persetujuan kebijakan.
4. Paket spesifikasi asli v1.0.2 untuk bagian yang tidak digantikan secara eksplisit.

Perbedaan antara **target produk** dan **perilaku aplikasi yang masih berjalan** harus tetap jelas. Approval administratif lama tidak menjadi tanda tangan pengguna; kode verifikasi lama tidak menjadi kode akun; reviewer lama tidak otomatis memperoleh akses model signing baru. SQL yang sudah diterapkan tidak diedit atau di-reset.

## Langkah implementasi

Gunakan [roadmap revisi](implementation-roadmap.md), satu tahap per pekerjaan. Fondasi yang tidak bergantung kebijakan dapat diteruskan; delegasi akses, keputusan penandatanganan, penerbitan QR dan hak admin tambahan hanya diaktifkan setelah kontraknya ditetapkan dan diuji. Tidak ada kebutuhan mengulang pemilihan target internal atau jumlah penandatangan yang sudah dijawab pengguna.

## Pemeriksaan paket revisi

- `npm run format:check`: lulus.
- `npx vitest run tests/unit/source-boundaries.test.ts`: 5 lulus, termasuk preservasi 41 file asli dan batas server/browser.
- Pemeriksaan tautan lokal paket pada penyusunan awal: 7 dokumen diperiksa; tidak ada target yang hilang. Paket kini juga memuat laporan R1/R2, kontrak implementasi dan consent yang telah disetujui.
- Penyusunan awal paket tidak membuat data cloud. Uji R1 berikutnya membuat satu fixture yang sudah diizinkan, tanpa migration atau grant baru.

Hasil pemeriksaan paket awal di atas adalah checkpoint historis; hasil source R2 terkini berada pada [laporan R2](r2-report.md). S-06/S-07/S-08 sudah disetujui untuk development. Keputusan terbuka pada register tetap berlaku untuk fitur terkait pada R3–R5, tanpa meminta ulang persetujuan yang sudah diberikan.
