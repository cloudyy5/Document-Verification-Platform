# Laporan R3 — keputusan penerima dan QR bukti privat

Tanggal: **10 November 2026**, Asia/Makassar. Versi aplikasi **0.6.0**. **Migration 010 sudah dilaporkan aktif dan lulus 43 pemeriksaan API. Penerimaan development R3 lulus setelah kelanjutan yang ditinjau pada fixture yang sama; lihat [hasil cloud R3](r3-cloud-report.md).** R2 cloud yang telah lulus tetap dipertahankan. Uji cloud yang disetujui mempertahankan dua akun peserta, dua dokumen/versi/request/keputusan, satu receipt dan satu PDF hasil; akun pembanding telah dibersihkan.

## Perilaku yang tersedia pada source

- Penerima terautentikasi dengan email terverifikasi dapat Setujui atau Tolak versi undangan yang masih eligible. Sesuai S-05, tidak ada password ulang/OTP. Dialog menampilkan versi dan konsekuensi; approve memerlukan checkbox consent development yang belum dicentang.
- Penolakan wajib mempunyai alasan maksimal 1.000 karakter. Owner/penerima dapat membaca alasan privat, tetapi penolakan mencabut akses PDF penerima dan tidak menghasilkan QR.
- Keputusan, receipt persetujuan dan snapshot identitas/versi immutable. Idempotensi dan lock yang sama dengan pembatalan mencegah keputusan ganda. Session binding disimpan sebagai HMAC audit privat, tanpa credential mentah.
- QR kiri bawah **setiap halaman asli**, ditambah **satu halaman bukti**. PDF sumber disimpan utuh; PDF hasil menambahkan footer 126 pt di luar area sumber agar isi tidak tertutup. Semua QR menunjuk receipt privat yang sama.
- Halaman `/receipts/:id` menampilkan bukti, waktu, penandatangan, kode akun, SHA-256 sumber/hasil dan status PDF aktual. Login serta relasi owner/penerima wajib; admin monitoring atau pengetahuan kode/QR tidak memberikan akses isi.
- Render dilakukan setelah commit keputusan. Claim lease, object baru tanpa overwrite, pemeriksaan ulang byte Storage, dan finalisasi atomik melindungi retry. PDF hanya tersedia setelah ready; gagal render mempertahankan persetujuan dan menyediakan retry.
- Identitas silver/white, graphite, CTA biru, tema Light/Dark dan komponen yang sudah ada dipakai kembali. Tidak membuat statistik atau data backend palsu. Ini bukti internal development, tanpa klaim TTE tersertifikasi.

## File dan folder

| Area           | File utama                                                                                                                                                                                                                                                            |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Database       | [Migration 010](../../supabase/migrations/202611100010_signing_decisions_and_artifacts.sql), [pemeriksaan operator read-only](../../supabase/operators/check_signing_r3.sql), tipe hasil generation `src/types/database.ts`                                           |
| Validasi/DTO   | `src/lib/signing/decision-validation.ts`, `evidence-types.ts`, `receipt-link.ts`                                                                                                                                                                                      |
| Server         | `src/server/signing/decisions.ts`, `evidence.ts`, `artifacts.ts`, `r3-context.ts`, `render.ts`, `render-worker.mjs`, `evidence-qr.ts`                                                                                                                                 |
| API            | `src/app/api/v2/signing-requests/[requestId]/decision/` dan `decisions/`; `src/app/api/v2/signing-receipts/[receiptId]/` beserta `file/` dan `render/`                                                                                                                |
| Tampilan       | `src/features/signing/decision-panel.tsx`, `artifact-control.tsx`, `evidence-view.tsx`; `src/app/(user)/receipts/[receiptId]/`                                                                                                                                        |
| Batas aplikasi | `src/proxy.ts`, `src/lib/auth/redirects.ts`, `src/lib/supabase/privileged.ts`, `src/server/signing/file.ts`, `errors.ts`, `next.config.ts`; timeout opsional R3 tanpa mengubah pemanggilan legacy                                                                     |
| Tes            | `tests/database/signing-decisions.test.ts`; tujuh file unit `signing-evidence-qr`, `signing-render`, `signing-decisions`, `signing-evidence`, `signing-artifacts`, `signing-decisions-http`, `signing-r3-runner`; perluasan guest browser `tests/e2e/signing.spec.ts` |
| Operator/lokal | `scripts/check-supabase.mjs --signing-r3`, `scripts/test-signing-pdf-local.mjs`, `scripts/test-signing-r3-cloud.mjs`, `scripts/resume-signing-r3-cloud.mjs`, `playwright.signing-r3-cloud.config.ts` dan `tests/e2e/signing-r3-cloud.spec.ts`; package/lock 0.6.0     |
| Dokumentasi    | [Kontrak R3](r3-implementation-plan.md), register keputusan, kebutuhan, workflow, kontrak teknis, roadmap, README, [rencana penerimaan cloud R3](r3-cloud-acceptance-plan.md)                                                                                         |

41 file asli dalam manifest preservasi lulus pemeriksaan hash. Migration 001–009 dan consent yang telah disetujui tidak ditulis ulang. Receipt/proof runner R1/R2 tetap tersedia; hash dua receipt operator tidak berubah sesudah suite browser R3.

## Teknologi

Stack tetap Next.js **16.4.3**, React **19.3.1**, TypeScript strict **6.0.3**, Tailwind **4.3.3**, Supabase JS **2.118.0** / SSR **0.12.7**, Zod **4.6.7**, pdf-lib **1.17.1**, Vitest **4.1.12**, Playwright **1.64.1**. Tambahan terkunci: `qrcode` **1.5.4**, `@pdf-lib/fontkit` **1.1.1**, tipe development `@types/qrcode` **1.5.6** dan decoder tes `jsqr` **1.4.0**. Font Geist lokal **1.9.0**; tidak ada API QR atau email berbayar baru.

Runner SQL memakai PostgreSQL native **17.9** terisolasi. Mesin saat pemeriksaan memakai Node **25.9.0**; panduan proyek tetap menyarankan Node **24 LTS**. Tidak mengklaim sudah diuji pada Node 24 dalam checkpoint ini.

## Hasil pengujian

| Pemeriksaan        | Hasil dan batas bukti                                                                                                                                                                                                                                           |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ESLint             | Lulus, nol warning                                                                                                                                                                                                                                              |
| Typecheck          | Lulus, route type generation dan TypeScript strict                                                                                                                                                                                                              |
| Vitest unit        | **746 lulus / 30 file**. Provider Auth/Storage di-mock pada unit orkestrasi dan diberi label; parser/QR/worker memakai implementasi nyata.                                                                                                                      |
| PostgreSQL native  | **323 lulus / 9 file**, termasuk 17 tes R3. Migration 001–010 diterapkan pada cluster sementara; grants/RLS, immutable, reject, claim/finalisasi, limiter dan race approve/approve, approve/reject serta approve/cancel diuji. Bukan bukti HTTP Supabase cloud. |
| Production build   | Lulus. Worker, font TTF, fontkit dan qrcode ada dalam output trace route decisions/render.                                                                                                                                                                      |
| Playwright default | **43 lulus, 5 skip / 48 total**, desktop/tablet/mobile. Tiga smoke authenticated opt-in dan dua drawer nonmobile dilewati. Route receipt/keputusan/hasil menolak guest; ini bukan penerimaan UI peserta R3.                                                     |
| PDF/QR lokal       | Empat halaman sumber dengan rotasi **0/90/180/270** + halaman bukti menghasilkan **5 QR yang berhasil didekode independen** dari raster PDF Chromium. Semua payload sama; nol request cloud. PDF dan screenshot ditinjau visual.                                |
| Bundle browser     | **35 berkas JS/map** diperiksa terhadap nilai aktual dua secret server; **nol kecocokan**. Tidak mencetak nilainya.                                                                                                                                             |
| Format/preservasi  | Lulus; hash paket asli tetap cocok.                                                                                                                                                                                                                             |

Tambahan aktivasi/kelanjutan: delapan tes guard runner membuat total 746 unit/30 file. Lint/typecheck lulus. Suite fixture awal berhenti pada asumsi HTTP404 halaman streaming setelah empat checkpoint; kelanjutan pada resource yang sama lulus tujuh checkpoint, exit code 0. Bukti awal tetap disimpan; raw tes awal tetap gagal. [Hasil cloud R3](r3-cloud-report.md) merinci data dan bukti. Probe `npm run test:pdf:signing -- --fixture` membaca QR kedua halaman dari PDF sumber sintetis 2.831 byte, nol request cloud. Build/browser/SQL pada checkpoint implementasi tetap berlaku; perubahan lanjutan ini hanya runner, test dan dokumentasi sehingga tidak diulang.

Probe lokal menghasilkan [PDF sintetis lima halaman](../screenshots/r3/synthetic-result.pdf), [contoh halaman asli](../screenshots/r3/page-1.png) dan [halaman bukti](../screenshots/r3/page-5.png). ID/link di dalamnya sengaja sintetis lokal dan tidak merepresentasikan persetujuan cloud.

Masalah antialias QR yang ditemukan pada raster PDF telah diperbaiki dengan satu operasi paint untuk seluruh modul; decoder independen pada kelima halaman sekarang lulus. Typecheck menemukan urutan pemanggilan abortSignal Supabase yang keliru; diperbaiki sebelum hasil akhir di atas. Asumsi HTTP404 pada halaman not-found streaming juga diperbaiki pada tes; API tetap404 dan UI tidak memberikan metadata/QR. Raw hasil suite cloud awal tetap gagal sebagai riwayat, dengan acceptance akhir dari kelanjutan terdokumentasi.

Audit dependency pada pemasangan mencatat sepuluh temuan moderate pada tooling ESLint/minimatch, tanpa high/critical atau temuan pada tambahan QR/fontkit. Tidak menjalankan audit fix paksa atau downgrade lint tooling.

## Menjalankan dan mengaktifkan

```powershell
cd D:\Website
npm ci
npm run dev
```

Buka **http://127.0.0.1:3000**. Konfigurasi `.env.local` yang telah ada dipertahankan; tidak ada secret baru untuk R3. APP_URL tetap menentukan origin tautan QR. Tautan loopback hanya dapat dipakai pada mesin development; QR contoh bukan tautan layanan publik. Konfigurasi development yang sudah membatasi loopback tetap berlaku.

**Migration 010 sudah dilaporkan dijalankan operator; preflight 43 pemeriksaan lulus. Jangan mengulang pada project saat ini.** Langkah berikut hanya panduan project development baru:

1. Supabase project development → **SQL Editor → New query (+)**, role **postgres**.
2. Buka [202611100010_signing_decisions_and_artifacts.sql](../../supabase/migrations/202611100010_signing_decisions_and_artifacts.sql), salin **seluruh isinya**, lalu klik **Run** sekali. Jangan ulangi 001–009. Migration transactional; jika error, simpan pesan error dan periksa sebelum mengulang. Bucket yang sudah ada dengan konfigurasi bertentangan menyebabkan exception, bukan diubah diam-diam.
3. Hasil yang diharapkan: **Success. No rows returned**. Ini membuktikan perintah SQL berhasil, belum membuktikan perjalanan peserta. Opsional jalankan [check_signing_r3.sql](../../supabase/operators/check_signing_r3.sql): tabel/RPC tidak boleh NULL; bucket harus mempunyai public=false, batas 20971520 dan PDF-only.
4. Setelah operator melaporkan berhasil, jalankan preflight tanpa mutasi:

```powershell
npm run supabase:check -- --workspace --signing --signing-r3
```

Mode R3 menambah HEAD nol baris untuk tiga tabel, probe service actor null/limiter invalid, penolakan EXECUTE anonim untuk lima RPC, dan GET konfigurasi bucket. Semua input ditolak sebelum penulisan/lock/counter; tidak membuat fixture. Mode ini **sudah lulus 43 pemeriksaan** pada cloud, tanpa membuat fixture; lihat [catatan aktivasi](r3-activation-check.md).

Uji lokal tersedia:

```powershell
npm run lint
npm run typecheck
npm test
npm run test:db
npm run test:pdf:signing
npm run build
npm run test:e2e
npm run format:check
```

## Batas dan pekerjaan berikutnya

Migration 010 sudah aktif menurut operator dan tersedia melalui API dengan preflight 43 lulus. Alur peserta development R3 telah dibuktikan pada satu fixture dengan dua request; [hasil cloud](r3-cloud-report.md) mencatat interupsi tes, rekonsiliasi dan tujuh checkpoint kelanjutan. Delapan tes guard lulus. Riwayat uji terminal dipertahankan; runner awal/kelanjutan tidak boleh dijalankan ulang untuk membuat data pengganti. Jangan menjalankan ulang runner R1/R2, menghapus proof-nya, mengubah request cancelled atau reset password peserta lama untuk memaksakan alur R3.

Worker dibatasi 20 detik/256 MiB, maksimal 2.000 halaman sumber dan hasil 20 MiB. Halaman terlalu kecil, geometri tak didukung atau annotation di luar crop yang dapat menutup footer ditolak saat render; persetujuan tetap tercatat dan hasil tidak diklaim ready. Glyph nama/judul di luar font lokal ditampilkan dengan keterangan teks lengkap tersedia pada bukti privat; data Unicode asli tetap ada di web/database.

Lease render lima menit; tidak ada background scheduler baru. Retry dijalankan peserta dari halaman bukti. Object gagal/uncertain tidak dihapus otomatis; rekonsiliasi dan retensi tetap perlu kebijakan. Uji SMTP, kebijakan produksi/scanner/retensi, monitoring admin R4 dan rilis publik belum dikerjakan oleh R3.
