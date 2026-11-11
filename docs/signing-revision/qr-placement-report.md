# R3b — QR yang dapat dipindah dan bukti persetujuan di web

Checkpoint **10 November 2026, Asia/Makassar**, source **v0.7.0**. Implementasi dan pemeriksaan lokal selesai. **Migration 011 dilaporkan berhasil diterapkan dan [preflight API](qr-placement-activation-check.md) lulus 47 pemeriksaan. [Perjalanan peserta R3b](qr-placement-cloud-report.md) telah lulus pada satu fixture dua halaman.** R3 format sebelumnya sudah lulus cloud; bukti historis tersebut tetap tersimpan dan tidak dianggap sebagai hasil penerimaan format baru. R4 monitoring belum dimulai.

## Perilaku yang tersedia pada source

Sesuai jawaban pengguna yang dicatat sebagai **S-14**, penerima mengatur posisi sebelum menyetujui, semua halaman asli memiliki posisi sendiri, dan PDF hasil baru tidak mempunyai halaman bukti tambahan. QR membuka `/receipts/:id` pada web; tetap membutuhkan login dan relasi pemilik/penerima. [Kontrak penempatan](qr-placement-contract.md) melengkapi [register keputusan](decision-register.md).

Editor menampilkan PDF sumber yang byte/hash-nya cocok dengan versi undangan. Penerima dapat memilih halaman, memperbesar preview, meletakkan penanda, menggeser dengan mouse atau sentuhan, memakai tombol panah, menghapus posisi, atau menyalin posisi ke seluruh halaman bila muat. Setujui aktif setelah semua halaman memiliki posisi valid. Penanda belum dapat dipindai; QR dibuat sesudah persetujuan committed. Tolak tetap menggunakan alasan wajib, tanpa membutuhkan penempatan QR.

Server menghitung ulang geometri halaman dari sumber, memeriksa batas serta perpotongan anotasi, lalu menyimpan posisi dalam transaksi keputusan. Dimensi/actor/path bukan input yang dipercaya dari browser. Manifest, sumber dan keputusan immutable; retry berbeda tidak dapat memindahkan QR. Render baru mempertahankan CropBox, MediaBox, rotasi dan jumlah halaman sumber. Format lama tetap dapat dibaca/dirender dengan layout lamanya tanpa mengubah bukti yang sudah terbit.

## File dan konfigurasi

| Kelompok      | File utama dan perubahan                                                                                                                                                                             |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| UI            | `src/features/signing/qr-placement-editor.tsx` baru; integrasi pada `decision-panel.tsx` dan teks hasil pada `evidence-view.tsx`                                                                     |
| Kontrak       | `src/lib/signing/placement.ts` baru; validasi approve dan DTO bukti diperbarui; reject tidak menerima posisi                                                                                         |
| Worker/server | `src/server/signing/pdf-layout.mjs`, `layout-worker.mjs`, `layout.ts` baru; keputusan, pembacaan manifest dan renderer diperbarui                                                                    |
| API/build     | Batas body keputusan 256 KiB; tracing worker pada `next.config.ts`; types database diregenerasi dari schema 001–011                                                                                  |
| Database      | [Migration 011](../../supabase/migrations/202611100011_movable_qr_web_evidence.sql), tabel manifest immutable/RLS, RPC approve sempit service-only dan finalizer berdasarkan jumlah halaman manifest |
| Operator      | [Presence check SQL read-only](../../supabase/operators/check_qr_placement.sql); `scripts/check-supabase.mjs --qr-placement` menambah empat probe tanpa mutasi                                       |
| Aset PDF.js   | `scripts/prepare-pdfjs.mjs`; hook postinstall/predev/prebuild; worker/font/cmap/wasm/ICC dan lisensi disalin ke `public/pdfjs/<versi>/`, diabaikan git/lint sebagai aset generated                   |
| Tes           | `tests/unit/signing-placement.test.ts`, `tests/database/qr-placement.test.ts`, `tests/ui/qr-editor.spec.ts`, harness lokal, config Playwright editor dan probe worker/raster PDF                     |
| Dokumentasi   | Kontrak/laporan R3b, register S-14, README, kebutuhan, workflow, kontrak teknis, acceptance plan, roadmap serta contoh pada `docs/screenshots/r3b/`                                                  |

Paket baru: **PDF.js/pdfjs-dist 6.5.438** untuk preview sumber dari origin sendiri; **Vite 8.3.5** dan **@napi-rs/canvas 1.1.0** dinyatakan sebagai dev dependency untuk harness dan raster test. Versi utama tetap Next.js **16.4.3**, React **19.3.1**, TypeScript **6.0.3** strict, Tailwind **4.3.3**, Supabase JS **2.118.0**/SSR **0.12.7**, pdf-lib **1.17.1**, qrcode **1.5.4**, Vitest **4.1.12**, dan Playwright **1.64.1**. Gunakan Node.js **24 LTS**; lingkungan pemeriksaan memakai Node 25.9.0.

Tidak ada environment variable baru. `.env.local` yang telah diisi tetap digunakan; secret tetap server-only. Tidak ada CDN, layanan berbayar, QR publik atau penyalinan PDF pengguna ke direktori publik. Dokumentasi/aset asli dan migration 001–010 dipertahankan.

## Hasil pemeriksaan

| Pemeriksaan                    | Hasil dan batas bukti                                                                                                                                                                                                                           |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ESLint                         | Lulus, nol warning                                                                                                                                                                                                                              |
| Typecheck                      | Lulus, termasuk route types Next dan generated database types                                                                                                                                                                                   |
| Unit                           | **763 lulus / 32 file**; worker geometri nyata, batas posisi, hash, anotasi, orchestration, retry dan evidence; provider pada unit terkait tetap mock                                                                                           |
| PostgreSQL native              | **340 lulus / 10 file** pada database terisolasi, termasuk 17 tes R3b: grants/RLS, manifest/hash immutable, idempotensi, invalid plan, finalisasi satu halaman, kompatibilitas lama dan race approve/approve serta approve/cancel               |
| Browser production dasar       | **43 lulus + 5 skip / 48** pada desktop/tablet/mobile; tiga smoke terautentikasi tidak diaktifkan dan dua tes drawer tidak berlaku pada viewport besar                                                                                          |
| Browser editor                 | **4 lulus** pada desktop/mobile: PDF.js nyata, drag mouse/sentuhan CDP, keyboard, posisi per halaman, copy/remove, tidak meluber horizontal dan hash salah ditolak                                                                              |
| Worker PDF + decode independen | **3 skenario, 6 QR berhasil didekode**: empat halaman berotasi 0/90/180/270 termasuk UserUnit 2; sumber satu halaman; CropBox terpotong MediaBox. Pusat QR cocok dengan posisi pilihan dalam toleransi 3 piksel; hasil 4→4, 1→1 dan 1→1 halaman |
| Build production               | Lulus; trace kedua route keputusan/render mencakup worker/helper PDF yang diperlukan                                                                                                                                                            |
| Batas secret                   | Pemeriksaan nilai secret server pada **39 file browser hasil build**: **0 kecocokan**; hanya ringkasan hitungan yang dicetak                                                                                                                    |
| Preservasi                     | Tes manifest 41 file asli lulus; checksum empat receipt historis R1/R2/R3 tidak berubah; fixture cloud R3b dibuat hanya setelah persetujuan tersendiri dan dicatat pada laporan hasil                                                           |

`npm run format:check` lulus. Pemeriksaan tautan lokal README/paket revisi tidak menemukan target hilang. [Ringkasan pemeriksaan build](../screenshots/r3b/build-check.json) mencatat tracing worker, nol kecocokan secret pada browser dan checksum receipt yang dipertahankan, tanpa mencantumkan nilai secret.

Browser editor memakai komponen React yang sama melalui host Vite loopback terisolasi dengan PDF sintetis. Ini membuktikan interaksi dan preview, bukan sesi/Storage/commit cloud peserta. PostgreSQL native juga tidak menggantikan GoTrue/PostgREST/Storage HTTP. Suite cloud R3 format lama sudah terminal dan tidak dijalankan ulang.

Contoh sintetis lokal:

- [Editor desktop](../screenshots/r3b/qr-editor-desktop.png) dan [mobile](../screenshots/r3b/qr-editor-mobile.png), diperiksa secara visual.
- [Hasil empat halaman berotasi](../screenshots/r3b/rotated-four-pages.pdf), [hasil satu halaman](../screenshots/r3b/single-source-page.pdf), dan [hasil CropBox terpotong](../screenshots/r3b/clipped-crop-page.pdf).
- [Raster halaman hasil](../screenshots/r3b/result-page-1.png) dan [ringkasan decode](../screenshots/r3b/pdf-probe.json).

QR pada contoh mengarah ke ID sintetis loopback; bukan receipt database atau bukti persetujuan cloud.

## Menjalankan dan memeriksa lokal

```powershell
cd D:\Website
npm ci
npm run dev
```

Buka `http://127.0.0.1:3000`. Setelah schema 011 aktif, penerima membuka **Permintaan masuk → detail permintaan pending → Atur posisi QR**, memeriksa seluruh halaman dan mengonfirmasi Setujui. Halaman bukti menampilkan status pemrosesan serta hasil; PDF sumber tetap tersedia terpisah. Setelah scan, login harus memakai akun peserta yang berhak. QR memakai origin `APP_URL`; origin loopback hanya dapat dibuka pada komputer itu sendiri, sehingga pemindaian HP tidak otomatis dapat menjangkau aplikasi development pada komputer.

```powershell
npm run lint
npm run typecheck
npm test
npm run test:db
npm run test:ui:qr
npm run test:pdf:movable
npm run build
npm run test:e2e
npm run format:check
```

## Aktivasi migration 011 — sudah dilaporkan dan diperiksa

Operator sudah melaporkan pemasangan berikut berhasil; [preflight API](qr-placement-activation-check.md) lulus 47 pemeriksaan pada 10 November 2026. **Jangan ulangi migration 011 pada project tersebut.** Langkah ini dipertahankan sebagai referensi pemasangan; API key aplikasi tidak memiliki kewenangan DDL:

1. Buka **SQL Editor → New query (+)** dan gunakan role **postgres**.
2. Buka [202611100011_movable_qr_web_evidence.sql](../../supabase/migrations/202611100011_movable_qr_web_evidence.sql), salin **seluruh isi**, lalu klik **Run** sekali. Jangan menjalankan ulang 001–010 atau reset database.
3. Hasil yang diharapkan **“Success. No rows returned”**, tanpa error. Jika muncul error, simpan pesannya sebelum menjalankan langkah lain.
4. Jalankan [check_qr_placement.sql](../../supabase/operators/check_qr_placement.sql) dalam query baru. `placement_table` dan `placement_approval_rpc` harus terisi; `finalizer_supports_movable_qr` harus **true**.
5. Sesudah operator mengonfirmasi berhasil, jalankan preflight dari workspace:

```powershell
npm run supabase:check -- --workspace --signing --signing-r3 --qr-placement
```

Hasil aktual **47 pemeriksaan lulus, exit code 0** (43 baseline + 4 R3b). Perintah memakai HEAD dengan nol baris, actor null dan penolakan permission, tanpa membuat akun, posisi, keputusan atau PDF. Ini membuktikan ketersediaan API dan penolakan anon; **belum menjadi penerimaan alur peserta cloud R3b**. Restart dev server yang masih menjalankan source lama.

[Rencana penerimaan cloud R3b](qr-placement-cloud-acceptance-plan.md) telah disetujui dan dijalankan dengan tiga akun sintetis serta satu PDF dua halaman, 1.544 byte. **Satu skenario browser cloud dan rekonsiliasi lulus, exit code 0.** Hasil tetap dua halaman, 6.177 byte, dengan kedua QR dapat dipindai ke bukti web privat; posisi berubah saat retry ditolak dan akses pihak lain tertutup. Dua peserta serta riwayat dipertahankan; C dibersihkan setelah terbukti kosong. [Laporan cloud R3b](qr-placement-cloud-report.md) memuat ID, hash, screenshot dan batas hasil. Guard terhadap proof sukses menolak pengulangan sebelum network. Source aplikasi/SQL tidak berubah saat penerimaan, sehingga build dan tes SQL yang sudah lulus tidak diulang.

## Batas dan masalah yang ditangani

Preview PDF.js dan server kini memakai area terlihat yang sama: perpotongan CropBox/MediaBox, rotasi dan UserUnit. Ketidaksesuaian pada PDF yang crop-nya melewati MediaBox diperbaiki dan dibuktikan dengan raster/decode. Screenshot editor menunggu render selesai. API cleanup PDF.js 6 menggunakan loading task; worker dan aset versi yang cocok disertakan dalam build.

Ukuran QR tetap **90 point**, maksimum **2.000 halaman**, sumber **10 MiB**, hasil **20 MiB**, dan worker inspeksi **20 detik/256 MiB**. Penerima memilih area kosong; sistem tidak menggeser atau membuat footer secara otomatis. Posisi yang bertumpuk dengan anotasi ditolak beserta nomor halaman sehingga penerima dapat memilih area lain. PDF dengan geometri/anotasi yang tidak dapat diproses gagal dengan pesan error, tanpa keputusan baru. Scanner, kebijakan produksi/retensi dan monitoring admin tetap di luar revisi ini. Build serta bukti QR ini tidak menjadi klaim TTE tersertifikasi atau kesiapan produksi.
