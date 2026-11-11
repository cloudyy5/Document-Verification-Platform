# R3 — keputusan penerima dan QR bukti privat

Checkpoint: **10 November 2026**, Asia/Makassar. Scope: prototipe persetujuan internal, satu penerima pengguna lain. Source R3 tersedia; migration 010 lulus PostgreSQL terisolasi, kemudian pengguna melaporkan aktivasi cloud dan [preflight API](r3-activation-check.md) lulus **43 pemeriksaan**. [Penerimaan peserta R3](r3-cloud-report.md) lulus setelah kelanjutan yang ditinjau pada fixture yang sama. R4 monitoring tidak dikerjakan di tahap ini.

## Keputusan yang disetujui

| Bagian | Kontrak                                                                                                                                                                                                                                                             |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S-05   | Pengguna memilih **tidak perlu memasukkan ulang password**. Gunakan sesi Supabase yang divalidasi, email terverifikasi dan dialog konfirmasi eksplisit. Persetujuan memerlukan checkbox yang belum dicentang; tidak ada OTP, password signing, atau grant recovery. |
| S-09   | QR pada **kiri bawah semua halaman asli**, ditambah **satu halaman bukti baru**. PDF hasil menambah ruang footer di luar area halaman sumber agar isi tidak ditutup. PDF sumber tetap immutable.                                                                    |
| S-13   | Alasan penolakan wajib, di-trim, maksimal 1.000 karakter, hanya untuk owner/penerima. Penolakan tidak membuat receipt atau QR dan mencabut akses PDF penerima.                                                                                                      |

Consent tindakan development `internal-action-development-2026-11-05` tetap memakai teks yang sudah disetujui pada [development-consent.md](development-consent.md). Login saja tidak menyetujui dokumen: POST keputusan harus membawa tindakan, konfirmasi, versi/hash dan consent yang benar. Server memeriksa getUser/signed claims, mengikat sesi dengan HMAC audit privat, dan tidak menyimpan credential mentah.

## Kontrak implementasi

Migration [010](../../supabase/migrations/202611100010_signing_decisions_and_artifacts.sql) menambah keputusan dan receipt immutable, metadata hasil, antrean render privat dan bucket privat `signing-results`. Tidak mengubah migration 001–009 atau memberikan admin akses seluruh PDF.

Keputusan memakai lock dokumen yang sama dengan pembatalan R2, lalu row lock request. Database memeriksa penerima, eligibility, status pending, waktu kedaluwarsa, versi/hash, kebijakan dan idempotensi. Satu keputusan final per request; receipt opaque 32 byte acak/43 karakter hanya dibuat di transaksi approve yang committed. Reject tidak membuat receipt. Audit/notifikasi generik dibuat atomik.

Rendering berjalan setelah commit. Lease dan token claim membatasi satu pekerjaan aktif; retry tidak membuat keputusan baru. Worker terisolasi tanpa environment secret memeriksa hash sumber, menambahkan footer QR di semua halaman dan satu halaman bukti. Rotasi 0/90/180/270 dan crop ditangani. Nama/judul dengan glyph yang tidak didukung font memakai keterangan bahwa teks lengkap tersedia di bukti privat; nilai aslinya tetap tersimpan di database dan web.

Object hasil ditulis pada path baru dalam bucket `signing-results` dengan `upsert:false`, dibaca ulang dan diperiksa hash/ukuran sebelum RPC finalisasi menetapkan artifact ready dan request completed atomik. Sumber dibatasi 10 MiB; hasil maksimal 20 MiB. Kegagalan render tidak membatalkan persetujuan. Tidak ada penghapusan otomatis object yang status commit-nya belum pasti.

QR hanya memuat URL `/receipts/:opaqueId`, tanpa credential, nama, email, path Storage atau hash dalam payload. Seluruh QR dalam satu PDF menunjuk receipt yang sama. Halaman receipt, metadata dan PDF memerlukan login serta relasi peserta. Hash sumber dan hasil terpisah; hash hasil tidak dimasukkan kembali ke PDF yang sedang dihitung. Menempelkan QR ke file lain tidak menciptakan persetujuan atau membuktikan kecocokan file.

## Endpoint yang tersedia pada source

| Endpoint                                             | Fungsi                                                                                                             |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `GET /api/v2/signing-requests/:requestId/decision`   | Keputusan/bukti aktual untuk peserta; pending mengembalikan null.                                                  |
| `POST /api/v2/signing-requests/:requestId/decisions` | Recipient saja; strict payload, UUID Idempotency-Key, Origin, konfirmasi dan consent/reason sesuai tindakan.       |
| `GET /api/v2/signing-receipts/:receiptId`            | DTO bukti minimum, tanpa path Storage/claim/session digest.                                                        |
| `POST /api/v2/signing-receipts/:receiptId/render`    | Peserta meminta/retry hasil dengan claim lease server.                                                             |
| `GET /api/v2/signing-receipts/:receiptId/file`       | Byte PDF ready yang diperiksa ulang, private no-store, Range dan download. Bila belum ready: 409 RESULT_NOT_READY. |
| `/receipts/:receiptId`                               | Halaman bukti privat, QR dan status/download hasil. Tamu diarahkan ke login.                                       |

Tidak ada endpoint confirmations/password reauth, verifier anonim atau shortcut approve/reject tanpa kontrak versi. Retry render menggunakan receipt dan claim unik, bukan header Idempotency-Key browser; keputusan tetap memakai key wajib. State render dibaca dari receipt; POST render mengembalikan JSON state aktual, tidak menyamar sebagai PDF.

## Pengujian dan aktivasi

Lihat [laporan R3](r3-report.md) untuk hasil final, file dan batas bukti. Probe lokal `npm run test:pdf:signing` menghasilkan PDF sintetis, membuka hasil pada Chromium, lalu mendekode QR dari kelima halaman memakai decoder independen. Tidak membaca .env.local atau menghubungi cloud. Opsi `--fixture` juga memeriksa PDF sintetis 2.831 byte yang akan dipakai suite cloud; dua halaman hasil berhasil didekode lokal.

Pengguna sudah melaporkan migration 010 berhasil dijalankan dan preflight lulus 43 pemeriksaan. Jangan jalankan ulang pada project ini. API key aplikasi tidak mempunyai hak DDL; aktivasi dilakukan operator melalui SQL Editor. Uji peserta cloud mengikuti [rencana fixture R3](r3-cloud-acceptance-plan.md) yang telah disetujui dan dilaksanakan. [Hasil cloud](r3-cloud-report.md) mencatat dua dokumen, satu approve dan satu reject; jangan membuat fixture pengganti atau mengulang runner. Fixture R2 cancelled dan riwayatnya tidak direset untuk membuat persetujuan.

## Referensi teknis

- Panduan Next.js lokal node_modules/next/dist/docs/ untuk route handlers dan server boundaries.
- [Supabase getUser](https://supabase.com/docs/reference/javascript/auth-getuser) dan [getClaims](https://supabase.com/docs/reference/javascript/auth-getclaims) untuk validasi identitas server.
- [node-qrcode](https://github.com/soldair/node-qrcode), [jsQR](https://github.com/cozmo/jsQR), [pdf-lib](https://pdf-lib.js.org/) dan [fontkit](https://github.com/Hopding/fontkit) untuk encoding, decoding tes dan PDF lokal.

Tidak ada layanan QR eksternal, layanan berbayar, atau klaim TTE tersertifikasi. Produksi, scanner, retensi dan hak admin tambahan tetap memerlukan keputusan terpisah.
