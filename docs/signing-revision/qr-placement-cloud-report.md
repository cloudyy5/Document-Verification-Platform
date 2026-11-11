# Hasil penerimaan cloud R3b — posisi QR dan bukti web

Tanggal **10 November 2026**, Asia/Makassar. **Lulus satu skenario browser cloud, exit code browser dan runner 0.** Status operator `passed_with_persistent_fixture`, run `c0ce4cd9-9a2f-4fbc-a59a-20d080319a25`. Pengguna menyetujui tiga akun sintetis dan satu PDF dua halaman melalui jawaban **“Ya, jalankan uji sintetis R3b”**. Eksekusi mengikuti [rencana uji](qr-placement-cloud-acceptance-plan.md); migration 011 telah melewati [47 preflight API](qr-placement-activation-check.md).

## Perilaku yang terbukti

| Area                     | Hasil aktual                                                                                                                                                                                                                                                                                       |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sesi, draft dan undangan | A/B/C login sebagai user biasa dengan email terkonfirmasi. A mengunggah satu sumber dan mengundang B melalui kode exact. Hash sumber cocok; B/C tidak membaca draft sebelum undangan; keputusan/receipt belum ada saat request pending                                                             |
| Validasi                 | A/C tidak dapat memutuskan sebagai penerima; guest 401. Input actor/policy/consent palsu, versi/hash salah, Origin asing dan posisi melampaui halaman ditolak sebelum keputusan                                                                                                                    |
| Posisi dan persetujuan   | Setujui belum aktif sebelum posisi lengkap. B menggunakan drag dan keyboard pada dua halaman dengan posisi berbeda, lalu checkbox/dialog eksplisit tanpa password ulang. Tepat satu keputusan dan receipt terbit                                                                                   |
| Penguncian manifest      | Manifest sesuai koordinat UI setelah kanonisasi server. Exact retry mengembalikan decision/receipt yang sama. Retry dengan posisi berbeda ditolak 409; update manifest lewat Data API user ditolak 42501; C mendapat nol manifest                                                                  |
| PDF dan QR               | Hasil **6.177 byte, dua halaman**, sumber **1.544 byte, dua halaman**. Kedua QR dari byte PDF cloud berhasil didekode memakai PDF.js/jsQR independen ke `/receipts/0bZDU8st5EW_tH0qH1yeSVYtXL9WcEs0SPkjjikVlBk`; pusat QR sesuai posisi dalam toleransi 3 piksel. Tidak ada halaman bukti tambahan |
| Privasi dan integritas   | A/B membaca bukti dan hasil; hash/ukuran aktual cocok, sumber tetap byte-identik, download dan Range 206 benar. Guest/C ditolak pada API; halaman guest menuju login dan halaman C tidak mengungkap judul/hash/QR. Storage langsung source/result serta URL public ditolak                         |
| Tampilan                 | Editor terintegrasi serta bukti desktop Light/mobile Dark diperiksa secara visual. Tidak meluber horizontal. Screenshot eksplisit hanya data sintetis, header email dimask; trace/video/screenshot otomatis tidak diaktifkan                                                                       |
| Rekonsiliasi             | Runner membaca ulang record, manifest, prefix Storage dan byte sumber/hasil menggunakan hanya ID run sendiri. Tepat satu dokumen/versi/request/keputusan/receipt, satu sumber serta satu hasil; request `completed`, artefak `ready`. C kosong lalu dibersihkan dan diverifikasi                   |

Koordinat manifest relatif terhadap sudut kiri atas halaman yang terlihat; ukuran QR tetap 90 point. Dua halaman berukuran 595,28 × 841,89 point, rotasi 0, UserUnit 1:

| Halaman | x        | y        |
| ------- | -------- | -------- |
| 1       | 0.205010 | 0.400000 |
| 2       | 0.655010 | 0.550000 |

Manifest terikat receipt dan versi immutable; `plan_sha256` tercatat `d3cc8783e9f4cc493417ef58d2075289a730ee4e4df3efd10a9e6846292f4396`. Hash ini merupakan nilai manifest database, terpisah dari SHA-256 byte PDF sumber dan hasil.

## Data uji yang dipertahankan

| Record         | ID/status                                                                                                                                        |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Run            | `c0ce4cd9-9a2f-4fbc-a59a-20d080319a25` — `passed_with_persistent_fixture`                                                                        |
| A — pemilik    | `76d72217-98f8-43bf-ad0e-eb74a1976c79` — dipertahankan                                                                                           |
| B — penerima   | `7f4a1733-846d-4af8-9596-b28cfc55a9e9` — dipertahankan                                                                                           |
| C — pembanding | `b0c4fd18-d8c3-4011-9c1e-7e4b850fbb6b` — dibersihkan setelah semua relasi/prefix kosong; Auth tidak ditemukan, role/profile/kode masing-masing 0 |
| Dokumen        | `6a62bddc-4571-8f09-ae01-ebdbe2fcc39d`                                                                                                           |
| Versi          | `87d80e9e-62d8-8131-9554-d0a5e380c42e`                                                                                                           |
| Permintaan     | `e3e93f21-450f-836a-8445-955f1a4d16b7` — `completed`                                                                                             |
| Keputusan      | `63aca5ba-02fe-8546-bfaf-479f8a7f347d` — approve                                                                                                 |
| Receipt        | `0bZDU8st5EW_tH0qH1yeSVYtXL9WcEs0SPkjjikVlBk`                                                                                                    |
| PDF sumber     | 1.544 byte, 2 halaman; SHA-256 `e3fdf4680cd01b4291822accdcc28f4461f5540bdcd35f82f655fd2fe2313d06`                                                |
| PDF hasil      | 6.177 byte, 2 halaman; SHA-256 `628e3dee44fadacf3981d89520422edcba2d15e31f83a0486f7fa4117a8d2f98`                                                |

Dokumen, manifest, keputusan, receipt dan kedua PDF sengaja tetap tersimpan sesuai persetujuan. Tidak ada pengajuan reject kedua, role admin baru atau credential legacy yang diterbitkan. Akun dan proof R1/R2/R3 tidak diubah. Password test tidak disimpan atau dibagikan; tidak ada pengiriman email pada setup fixture.

## Bukti dan preservasi

- [PDF hasil cloud](../screenshots/r3b/cloud/approved-two-page.pdf), [raster halaman 1](../screenshots/r3b/cloud/approved-page-1.png), dan [halaman 2](../screenshots/r3b/cloud/approved-page-2.png).
- [Editor posisi sebelum approve](../screenshots/r3b/cloud/source-position-editor.png), [bukti desktop Light](../screenshots/r3b/cloud/receipt-light.png), dan [bukti mobile Dark](../screenshots/r3b/cloud/receipt-dark.png).
- [Salinan proof operator tanpa credential](../screenshots/r3b/cloud/operator-proof.json) dan [proof checksum/guard](../screenshots/r3b/cloud/preservation-proof.json).

Receipt asli berada pada `test-results/cloud-signing-r3b-run.json` dan `test-results/cloud-signing-r3b-c0ce4cd9-9a2f-4fbc-a59a-20d080319a25.json`. SHA-256 keduanya `f63c975f260cdeb85ebe3c074c871c880977b3c8b2515ba432acc0259e2fe9e9`. Checksum empat proof historis R1/R2/R3 tetap sama. Uji guard terhadap receipt sukses ini menolak invocation ulang sebelum network, dengan nol request dan proof byte-identik; lock milik probe sudah dilepas. Jangan menghapus proof atau mengulang runner untuk membuat fixture lain.

Browser menyelesaikan skenario dalam 45,3 detik; runner juga menyelesaikan rekonsiliasi dan cleanup dengan exit code 0. Source aplikasi dan SQL tidak diubah selama penerimaan ini. Lint/typecheck/build, 763 unit, 340 SQL native serta browser lokal yang sudah lulus tetap tercatat pada [laporan implementasi](qr-placement-report.md); tes tersebut tidak diulang tanpa perubahan yang relevan.

## Batas hasil dan tahap berikutnya

Hasil ini menutup penerimaan development R3b pada satu fixture dua halaman. Geometri rotasi/crop/UserUnit, race dan kegagalan provider lain tetap berasal dari pengujian lokal/SQL yang disebutkan terpisah. Admin nonpeserta dicakup SQL native, bukan pemberian role admin pada fixture cloud ini. Uji ini tidak membuktikan delivery email, scanner, retensi/backup produksi atau TTE tersertifikasi.

QR fixture memakai `http://127.0.0.1:3100`; URL tersebut membutuhkan server lokal yang berjalan pada komputer yang sama dan login peserta. Pemindaian dari HP ke loopback komputer belum merupakan pengujian deployment. Aplikasi belum dipublikasikan oleh uji ini.

R3b development siap ditinjau pengguna. Tahap berikut dalam roadmap adalah **R4 — admin monitoring**, dengan keputusan S-11 tentang permission dan definisi metrik tetap perlu ditetapkan sebelum aktivasi; R4 belum dimulai.
