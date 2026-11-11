# Hasil penerimaan cloud R3

Tanggal: **10 November 2026**, Asia/Makassar. **Fixture development R3 lulus setelah kelanjutan yang ditinjau**, status operator `passed_after_reviewed_resume`. Pengguna menyetujui tiga identitas sintetis, dua PDF sumber, satu approve dan satu reject. Semua aktivitas memakai project Supabase development dan production server loopback, bukan layanan publik.

## Hasil yang dibuktikan

| Area                 | Bukti                                                                                                                                                                                                                                                       |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Login/draft/undangan | Tiga login password sintetis terverifikasi dan role normal user; dua upload serta dua undangan tepat penerima melalui UI. Tidak ada receipt sebelum keputusan.                                                                                              |
| Keputusan sah        | Owner/C/guest, injeksi actor/status, consent salah, versi/hash salah dan Origin asing ditolak. Approve memakai checkbox awal kosong serta konfirmasi eksplisit tanpa password ulang.                                                                        |
| Approve/retry        | Satu approve committed, satu receipt dan satu hasil ready. Exact retry tidak membuat keputusan/receipt kedua; perubahan tindakan dengan key sama dan pembatalan setelah approve ditolak.                                                                    |
| Byte PDF             | A/B memperoleh PDF hasil yang sama, hash/ukuran sesuai metadata, preview/download dan Range206. Dua sumber tetap tepat 2.831 byte dan hash asal cocok.                                                                                                      |
| Batas akses          | API receipt/hasil/keputusan/source menolak C404 dan guest401. C tidak membaca receipt melalui Data API; SDK user dan URL publik Storage tidak memberikan byte. Halaman C menampilkan not-found/noindex tanpa judul/hash/QR.                                 |
| QR                   | QR pada halaman sumber dan halaman bukti didekode dari raster PDF Chromium dengan jsQR ke URL receipt yang sama. Cloud fixture mempunyai satu halaman asli; semua halaman asli/rotasi sudah diuji terpisah dengan PDF lokal empat halaman.                  |
| Tampilan             | Receipt desktop Light dan mobile Dark terlihat benar tanpa horizontal overflow. PDF sumber/footer/bukti dan screenshot ditinjau visual.                                                                                                                     |
| Reject               | Alasan kosong/lebih dari1.000 ditolak. Alasan sah dicatat privat sekali; exact retry mengembalikan keputusan yang sama. Nol receipt/hasil untuk reject. B kehilangan akses sumber/metadata; A tetap membaca sumber; riwayat alasan tetap tersedia bagi A/B. |
| Rekonsiliasi         | Tepat dua dokumen/versi/request/keputusan, satu receipt, dua object sumber dan satu object hasil. Nol credential verifikasi legacy pada ID dokumen uji. C sudah dihapus; Auth, role, profil dan kode C terbukti kosong.                                     |

## Interupsi tes dan kelanjutan

Runner awal menjalankan **satu skenario Playwright dan berhenti dengan satu kegagalan**, setelah empat checkpoint lulus. Persetujuan dan PDF hasil telah committed; request kedua masih pending. Bukti awal tidak dihapus, tidak diubah menjadi sukses, dan tidak dijalankan ulang untuk membuat fixture baru.

Penyebabnya adalah asumsi tes bahwa halaman receipt milik pengguna lain harus selalu menghasilkan HTTP404. Panduan Next.js terpasang `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/not-found.md` menjelaskan notFound setelah streaming dimulai mempertahankan HTTP200. Pemeriksaan lanjutan mengamati **200 + UI “Bukti tidak ditemukan” + noindex**, sementara API tetap404 dan data judul/hash/QR tidak muncul. Tes diperbaiki agar memeriksa batas akses tersebut, bukan menganggap status halaman HTML saja sebagai bukti izin.

Sebelum kelanjutan, rekonsiliasi read-only membuktikan dua sumber utuh, satu approve/completed, hasil ready 17.527 byte, dan request kedua masih pending. `scripts/resume-signing-r3-cloud.mjs` kemudian melanjutkan **run, dua dokumen, dua request dan tiga ID akun yang sama**, exit code **0**, dengan **tujuh checkpoint kelanjutan lulus**. Script dibatasi pada run/ID/marker tersebut dan mempunyai guard sebelum jaringan; delapan tes subprocess guard lulus dengan network stub.

A/B menggunakan sesi provider sementara dari [generateLink](https://supabase.com/docs/reference/javascript/auth-admin-generatelink) dan [verifyOtp](https://supabase.com/docs/reference/javascript/auth-verifyotp), dikonsumsi dalam memori. Tidak melakukan reset password A/B, mengirim email, menyimpan token/cookie atau mengubah alur autentikasi produk. Login password melalui UI sudah lulus pada percobaan awal. Akun C sebelumnya telah dibersihkan oleh runner; identitas C yang sama dipulihkan sementara setelah seluruh relasinya terbukti kosong, kemudian dibersihkan lagi. Total tetap **tiga ID akun unik**, dengan empat operasi create Auth karena pemulihan C; tidak membuat ID akun keempat atau dokumen pengganti.

Status akhir bukan klaim bahwa tes Playwright awal berubah menjadi hijau. Acceptance akhir berasal dari empat checkpoint awal, tujuh checkpoint kelanjutan, pemeriksaan byte/DB nyata dan peninjauan visual. Tidak menjalankan ulang suite pembuat fixture karena state immutable sudah terminal dan guard harus tetap memblokir pengulangan.

## Identitas fixture yang dipertahankan

Run: `4d679704-e156-4f55-be23-db7dd80578c4`.

| Resource          | ID / keadaan akhir                                                            |
| ----------------- | ----------------------------------------------------------------------------- |
| Owner A           | `a9cec1cc-8c6d-43d7-8cba-05f2d4b53d13`, dipertahankan                         |
| Recipient B       | `a0c376bf-b5e1-4bcb-85c8-366c5b1f130f`, dipertahankan                         |
| Pembanding C      | `196ef9e2-5ac8-4084-abb7-0308c288280a`, dibersihkan dan absennya dikonfirmasi |
| Dokumen approve   | `3ed61f96-b47a-8383-baea-16581010ed6d`                                        |
| Versi approve     | `265463df-eae8-8b9f-9b27-9c6c4e48cae1`                                        |
| Request approve   | `b8abc527-edf9-8951-aea5-8532f6d8b288`, completed                             |
| Keputusan approve | `b74a8757-732c-8e0f-9018-7fb42c90c036`, 13:43:08 WITA / 05:43:08 UTC          |
| Receipt           | `oUpR_vXaDsqZJFLUiVnTR8xZkASuk3BXciY5TD7feDo`                                 |
| Dokumen reject    | `d29a0f11-f386-8f2e-9088-88ffffa0cd31`                                        |
| Versi reject      | `ef081c8d-b5b5-85ff-b160-33732d0c35a2`                                        |
| Request reject    | `ae236e3e-2c28-8882-b065-1450eaa7a582`, rejected                              |
| Keputusan reject  | `bc6a5e6e-9fe5-8704-977b-de4286de16d3`, 13:58:25 WITA / 05:58:25 UTC          |

Dua object sumber masing-masing **2.831 byte** dengan SHA-256 `6cc3a629004962b6b8df8755a1ca56c5e41cdee0dc991ea3af44617a79e8c0cc`. Satu PDF hasil **17.527 byte, dua halaman**, SHA-256 `baaf74a44c7d05d1bcb4036666e527724764ef1c33b3825a2befd962b507df12`. Bucket sumber `document-submissions` dan hasil `signing-results` tetap privat. PDF fixture sumber memuat teks lama Phase 3 sebagai konten sintetis; status signing aktual berasal dari request/keputusan database di atas.

## Bukti lokal

- `test-results/cloud-signing-r3-run.json`: ringkasan akhir, status passed_after_reviewed_resume.
- `test-results/cloud-signing-r3-4d679704-e156-4f55-be23-db7dd80578c4.json`: percobaan awal yang gagal, tetap byte-identik. SHA-256 `7f8f0073c9906941094b56fa425bb442003255b48fc6062727ac1c0a440ed889`.
- `test-results/cloud-signing-r3-initial-reconciliation.json`: pemeriksaan sebelum kelanjutan.
- `test-results/cloud-signing-r3-resume-4d679704-e156-4f55-be23-db7dd80578c4.json`: tujuh checkpoint dan hasil kelanjutan.
- `test-results/cloud-signing-r3-final-state.json`: waktu keputusan, absennya C dan nol credential legacy.
- [PDF hasil sintetis](../screenshots/r3/cloud-approved-result.pdf), [halaman asli + footer](../screenshots/r3/approved-pdf-page-1.png), [halaman bukti](../screenshots/r3/approved-pdf-page-2.png), [receipt desktop Light](../screenshots/r3/receipt-light.png), [receipt mobile Dark](../screenshots/r3/receipt-dark.png).

Artefak visual hanya sintetis; email header dimask. QR fixture mengarah ke origin server uji `http://127.0.0.1:3100` dan tetap memerlukan akun peserta. Ini contoh untuk peninjauan, bukan URL layanan online atau verifier publik. Helper server/browser dan sesi sementara telah ditutup setelah pemeriksaan.

Proof R1/R2 tidak berubah: hash pointer workspace `fe7c6db6cfa1036bd11aa76a5be621e3d7f1245d7b35158e465b75e56d29418b`; pointer signing R2 `1a626aaf04bdd920d185d201d5e771795554fe3bb202404bcc0c2bd71fb9296e`. Dokumen/aset/migration asli tetap lulus preservasi unit.

## Batas hasil

Regresi terakhir: **746 unit/30 file**, ESLint, TypeScript strict dan format lulus. SQL lokal **323/9 file**, production build dan browser default **43 lulus/5 skip** berasal dari checkpoint implementasi R3; aplikasi dan SQL tidak berubah pada kelanjutan ini. Tidak menjalankan ulang tes tersebut hanya untuk mengubah status raw suite fixture.

Uji cloud mencakup dua dokumen sintetis satu halaman dan sesi user biasa. Admin nonpeserta dan race diuji SQL native, bukan pemberian role admin baru di cloud. SMTP, scanner, retensi, pemulihan backup, beban besar, sertifikasi dan kebijakan produksi tetap di luar bukti ini. R3 development siap ditinjau; R4 monitoring admin belum dimulai.
