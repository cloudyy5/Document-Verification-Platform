# Perbaikan Pengajuan lama

Source **0.10.1**, **17 November 2026**, Asia/Makassar.

## Penyebab dan perilaku baru

Halaman `/documents/legacy` sebelumnya hanya memanggil `getWorkspaceDocuments()` untuk view `workspace_documents`, yang bersumber dari tabel `documents` dan `document_submissions` milik alur pemeriksaan administratif terdahulu. Upload/undangan/persetujuan yang digunakan sekarang berada pada tabel signing. Data signing tersebut tidak mungkin ikut tampil pada query lama, sekalipun tanda tangan sudah berhasil.

Ini temuan dari source dan kontrak schema, bukan pernyataan bahwa tabel cloud pengguna sudah diperiksa dan terbukti kosong. Tidak ada sesi akun pengguna atau pembacaan isi dokumen cloud dalam perbaikan ini.

Pengguna meminta tab Pengajuan lama dapat dipakai untuk melihat data, lalu mengonfirmasi pilihan **“Riwayat persetujuan yang selesai, ditolak, dibatalkan, atau kedaluwarsa”**. Implementasi berikut sesuai klarifikasi tersebut, tanpa mengubah status atau hak baca:

- `/documents/legacy`: riwayat permintaan yang sudah **Selesai**, **Ditolak**, **Dibatalkan**, atau **Kedaluwarsa**. Status awal adalah Selesai; status lain dipilih satu per satu melalui filter.
- Pilihan **Pernah saya kirim** dan **Pernah saya terima** memakai relasi akun yang sama dengan kotak masuk/keluar. Saat belum memilih arah/cursor, halaman mencoba riwayat terkirim; jika hasilnya kosong secara sah, halaman beralih ke riwayat diterima. Pilihan arah eksplisit atau pagination tidak ditimpa otomatis.
- Draft, pending aktif dan persetujuan yang hasilnya masih diproses tetap berada pada Dokumen saya/Saya kirim/Saya terima. Tidak ada pemindahan record ke tabel arsip atau perubahan workflow ketika pengguna membuka tab.
- Submenu **Arsip pemeriksaan terdahulu** membuka `/documents/administrative`, memakai query, kategori, filter judul/status/tanggal dan pagination dari alur terdahulu. Ringkasan khususnya tetap `/dashboard?source=legacy`, kini berlabel Ringkasan arsip pemeriksaan.

Daftar riwayat signing diurutkan menurut waktu pengiriman seperti kotak permintaan yang sudah ada. Tautan Lihat riwayat menuju `/requests/:id`, sehingga peserta dapat membaca keputusan, sumber yang masih diizinkan, bukti dan hasil PDF dari halaman yang sudah ada. Record pemeriksaan tetap memakai detail `/documents/:id`. Link kembali dan kartu ringkasan yang merujuk pemeriksaan lama telah diarahkan ke route administratif baru.

Jika tidak ada record yang sesuai arah/status, tampilan menjelaskan cara memilih filter lain. Error sumber data tetap tampil unavailable, bukan riwayat kosong palsu. Cursor/parameter invalid mempunyai tautan reset. Parameter status pemeriksaan lama seperti `approved` tidak menjadi status signing; gunakan filter tersebut pada `/documents/administrative`.

## Batas akses dan data

Halaman baru memeriksa `requireUserWorkspace()` sebelum query, lalu memakai `getSigningRequests()` yang sudah menyediakan `apiSession("user")`, cookie client, filter owner/recipient dari sesi, status sebelum pagination dan RLS. Tidak ada privileged client atau parameter pemilik lain. Admin tetap tidak menggunakan User Workspace.

Penerima yang akses PDF-nya sudah berakhir pada Ditolak/Dibatalkan/Kedaluwarsa tetap hanya melihat metadata riwayat yang diizinkan. Judul sumber yang disembunyikan DAL tidak dibuat ulang oleh UI; PDF tetap tidak dapat dibuka melalui tab ini. Akun lain tidak memperoleh grant baru dari menu arsip.

Tidak ada schema migration, SQL/grant/RLS baru, seed, perubahan environment, penghapusan atau konversi status approved administratif menjadi tanda tangan. PDF, receipt dan riwayat lama tetap immutable. Tidak dibuat akun, permintaan, keputusan atau fixture cloud; runner historis tidak dijalankan ulang.

## File dan pemeriksaan

- Halaman Pengajuan lama dan halaman administratif terpisah pada `src/app/(user)/documents/`.
- Filter history pada `src/lib/archive/schema.ts`; tab/form/pagination menggunakan komponen arsip bersama.
- Link ke arsip pemeriksaan pada dashboard, detail pengajuan, pesan pengajuan dan footer signing diperbarui.
- Unit test `archive-history-page.test.tsx` menguji pemilihan sumber, default status, arah diterima, penolakan filter, guard sebelum query, error/cursor dan metadata penerima yang sudah disembunyikan.
- Harness arsip memakai komponen produk dengan data sintetis berlabel. Kasus baru memeriksa riwayat signing ketika arsip pemeriksaan kosong, pagination diterima/ditolak, serta status/detail pemeriksaan yang tetap terpisah pada tiga viewport.

Pemeriksaan lokal memakai Node.js 24.22.2 dan Chromium:

| Pemeriksaan             | Hasil                                                                                                                                                                                                                                    |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit                    | **999 lulus / 42 file**, termasuk 17 kasus halaman riwayat.                                                                                                                                                                              |
| Browser arsip           | **33 lulus** pada desktop/tablet/mobile; tambahan tiga pemeriksaan layout terang/gelap dan screenshot dilakukan setelah copy tampilan diperjelas. Tidak memakai data cloud.                                                              |
| Browser production      | **43 lulus, 5 dilewati / 48 total**; kedua route arsip meminta login. Tiga smoke login cloud dinonaktifkan dan dua drawer tidak berlaku pada viewport besar.                                                                             |
| Lint, typecheck, format | Lulus; diff tidak mempunyai masalah whitespace.                                                                                                                                                                                          |
| Build                   | Lulus setelah retry yang diminta CLI Next.js. Percobaan awal berhenti untuk peringatan keamanan Next.js 16.4.3; peringatan tetap ada pada retry dan pembaruan keamanan tetap disarankan. Kedua route arsip tersedia pada manifest build. |
| Preservasi              | **41 file paket asli dan 5 receipt cloud historis** sesuai checksum; **92 tautan lokal** pada dokumentasi yang diperiksa valid. Kolom hasil/status pada CSV UAT dipertahankan saat langkah skenario diselaraskan.                        |

Tidak ada pengujian ulang database karena DAL/SQL/grant tidak berubah; hasil SQL pada laporan sebelumnya tetap bukti checkpoint terdahulu, bukan run baru.

Uji unit/harness tidak membuktikan deployment telah memakai source baru atau akun pengguna cloud sudah membaca riwayat melalui versi ini. Build/run image Linux juga belum dibuktikan di workspace tanpa Docker Engine.

## Menerapkan dan memeriksa

Setelah source 0.10.1 di-commit/push dan diperbarui pada server, gunakan file environment deployment yang benar:

```bash
docker compose --env-file .env.production config --quiet
docker compose --env-file .env.production up -d --build --force-recreate web
```

Jika deployment memakai `.env.local`, gunakan nama tersebut secara konsisten. Tidak perlu menjalankan migration atau seed lagi.

Login user → Arsip administratif → Dokumen terdahulu → Pengajuan lama. Periksa status Selesai pada arah yang sesuai dengan permintaan yang sudah Anda miliki. Pilih Ditolak/Dibatalkan/Kedaluwarsa bila itu yang hendak dilihat. Buka salah satu riwayat untuk memeriksa detail. Pengguna yang hanya menandatangani dokumen dapat memakai Pernah saya terima. Pengajuan dari sistem pemeriksaan terdahulu dibuka melalui Arsip pemeriksaan terdahulu.

Catatan uji manual dan CSV mengikuti pemetaan baru; 52 skenario tetap rencana yang harus diisi saat pelaksanaan. Temuan keamanan dependency Next.js yang sebelumnya dilaporkan tidak ditutup oleh perbaikan tampilan ini.
