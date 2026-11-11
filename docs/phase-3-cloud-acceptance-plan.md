# Rencana uji penerimaan cloud Phase 3

**Status: retest R1 lulus pada 5 November 2026 (Asia/Makassar), dengan satu fixture persisten sesuai persetujuan pengguna.** Run `845bb91e-cda5-4870-9b1a-f568c27d2e8c` lulus satu tes cloud dengan sembilan kelompok pemeriksaan. Receipt nyata berstatus `pending_review`, versi 1; tidak ada credential verifikasi atau QR untuk dokumen uji. Akun pembanding dibersihkan, sedangkan satu akun pemilik dan PDF privat 2.831 byte dipertahankan. Hasil ini membuktikan fondasi upload legacy, bukan fitur persetujuan internal/signing baru. Lihat [laporan R1](signing-revision/r1-report.md).

Percobaan pertama `c35e4f04-609d-4c1c-b071-22fdbb21ce22` ditolak 422 sebelum penyimpanan akibat bentuk payload worker pada build production. Nol dokumen/submission/object pada prefix akun itu dibuktikan, lalu kedua akun dibersihkan. Perbaikan nested byte envelope, unit test dan build lulus sebelum retest. Kejadian awal tersebut tetap dicatat sebagai gagal yang direkonsiliasi, terpisah dari hasil retest yang lulus.

## Keputusan sebelum eksekusi

Pengguna telah secara eksplisit menyetujui pembuatan **dua akun development sintetis dengan role normal user dan satu pengajuan PDF sintetis** pada project Supabase development yang sudah dikonfigurasi. Keputusan diterima pada **2026-11-04**, termasuk konsekuensi record pengajuan yang persisten. Sesudah pengajuan berhasil, akun A, dokumen, submission, PDF privat, serta catatan transaksi terkait akan tetap berada pada project. Akun B dapat dibersihkan jika tidak mempunyai dokumen atau submission. Kredensial akun hanya digunakan dalam memori proses dan tidak dimasukkan ke laporan, screenshot, source, atau argumen perintah.

Rencana ini tidak menerapkan migration tambahan, menerbitkan aplikasi, menaikkan paket layanan, memberikan role reviewer/admin, atau melakukan keputusan review. Tidak ada email yang diminta untuk dikirim. Tidak ada dokumen pengguna atau data pribadi nyata yang dipakai.

## Catatan pelaksanaan

Runner telah dijalankan setelah persetujuan pengguna dengan command berikut. Dengan proof receipt yang kini ada, command akan ditolak sebelum jaringan; ini bukan instruksi untuk membuat fixture kedua.

```powershell
npm run test:cloud:workspace -- --confirm-persistent-fixture
```

| Item                                              | Status saat ini                                                                                   |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Keputusan pengguna                                | Disetujui, 4 November 2026                                                                        |
| Pelaksanaan runner                                | **1 tes cloud lulus**, retest 5 November 2026, Asia/Makassar                                      |
| Receipt, run marker dan record persisten          | Run `845bb91e-cda5-4870-9b1a-f568c27d2e8c`; satu receipt pending/version 1 dan satu PDF persisten |
| Upload, file privat, idempotensi dan isolasi akun | Lulus sembilan kelompok pemeriksaan; penolakan akses dinyatakan pada batas API/Storage yang diuji |
| Cleanup akun tanpa dokumen                        | Akun pembanding dibersihkan; akun pemilik dipertahankan bersama dokumen immutable                 |
| Credential verifikasi                             | Nol credential untuk dokumen uji; tidak ada QR yang diterbitkan                                   |
| Build dan migration                               | Build lokal 5 November lulus; tidak ada migration baru pada retest                                |

Proof tersimpan lokal di `test-results/cloud-workspace-run.json` dan file per-run, tanpa password, token atau path Storage. Timestamp receipt database `2026-11-04T16:55:25.32621+00:00` setara 5 November 2026 pukul 00:55 WITA; tanggal laporan memakai Asia/Makassar.

Hasil aktual mencakup baseline role normal/akun kosong, UI submit, retry identik dan konflik payload, counts/filter/detail, integritas byte current/historical/download/range, penolakan API akun lain/guest, penolakan revisi dokumen pending, penolakan Storage langsung, serta popup PDF native. Screenshot popup telah diperiksa secara visual dan menampilkan label DEVELOPMENT TEST ONLY. Profil adalah pengujian helper sementara yang terpisah, bukan langkah tulis pada fixture persisten ini.

Bagian berikut mempertahankan hasil yang direncanakan. Tidak semua skenario yang dibahas merupakan tes baru pada run ini: SMTP, revisi sukses cloud, seluruh matriks RLS cloud, fitur undangan/persetujuan/QR baru, dan produksi tetap di luar hasil R1 ini.

## Guard pengulangan dan rekonsiliasi

Runner memeriksa proof sebelumnya sebelum permintaan jaringan. Run baru ditolak bila proof belum direkonsiliasi, tidak membuktikan kedua akun lama sudah dibersihkan, atau telah mempunyai receipt. Guard penolakan ini juga diperiksa secara lokal dengan fetch pengganti: nol permintaan jaringan. Jangan menghapus/reset proof untuk melewati guard atau mengulang runner setelah fixture berhasil. Pemeriksaan lanjutan harus menggunakan record yang ada dan mengikuti kewenangan pengujian yang disepakati.

Cleanup akun kosong memerlukan kecocokan ID/email/run marker serta hasil query dokumen/submission yang secara eksplisit berupa array kosong. Akun pemilik tidak dihapus otomatis setelah browser dapat melakukan submit; respons hilang bukan bukti rollback. Guard bukan izin menghapus artefak cloud atau memperluas anggaran fixture.

## Fixture lokal yang siap diperiksa

| Properti          | Nilai                                                                                      |
| ----------------- | ------------------------------------------------------------------------------------------ |
| File              | `tests/fixtures/phase-3-development.pdf`                                                   |
| Format            | PDF asli, satu halaman, tidak terenkripsi                                                  |
| Ukuran            | **2.831 byte**                                                                             |
| SHA-256 byte file | `6cc3a629004962b6b8df8755a1ca56c5e41cdee0dc991ea3af44617a79e8c0cc`                         |
| Label tampak      | `DEVELOPMENT TEST ONLY`                                                                    |
| Label tambahan    | `SYNTHETIC DOCUMENT - NO PERSONAL DATA`                                                    |
| Isi               | Penjelasan artefak teknis, tanpa penerbit, tanda tangan, QR, attachment, atau data pribadi |

Fixture dibuat lokal dengan `pdf-lib` dan tidak berasal dari upload pengguna. Metadata tanggal file ditetapkan untuk reproduksibilitas fixture; tanggal pengajuan dan persetujuan aplikasi harus tetap berasal dari database saat uji dijalankan.

## Prasyarat dan batas eksekusi

Project tujuan harus sama dengan `.env.local`, merupakan development, dan menggunakan origin loopback aplikasi. Migration 001–008 dan seed kategori yang disetujui harus tersedia. `npm run supabase:check -- --workspace` harus lulus sebelum pembuatan akun. Sesi uji tidak mengubah konfigurasi keamanan, grant, RLS, bucket, atau batas ukuran.

Akun A dan B dibuat dengan email sintetis `@example.invalid`, password acak, serta run marker khusus untuk mengenali record yang dibuat oleh uji ini. Auth Admin API mengonfirmasi email sintetis secara langsung tanpa pengiriman email; pemeriksaan ini tidak membuktikan alur email konfirmasi atau SMTP pengguna. Kedua akun harus terbukti hanya memiliki role `user` melalui sesi masing-masing.

Jalankan alur tulis **sekali**, bukan satu kali per viewport. Batas aplikasi tetap 10 attempt per pengguna dan 50 global per 15 menit. Rencana inti memerlukan sekitar empat attempt upload oleh A: submit awal, retry identik, konflik idempotency, dan percobaan revisi ketika masih pending. Hentikan bila ada 429 atau layanan belum siap; jangan menaikkan quota agar tes lulus.

## Urutan penerimaan

| Langkah                        | Tindakan                                                                                                                                                                                                                  | Hasil yang harus diamati                                                                                                                                                                                                                              |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Baseline                    | Login A dan B, baca dashboard, daftar dokumen, profil, serta kategori melalui aplikasi                                                                                                                                    | Identitas dan role benar; akun baru mempunyai count nol dan daftar kosong yang berasal dari database. Kategori yang disetujui tersedia. Tidak ada error layanan yang diperlakukan sebagai count nol.                                                  |
| 2. Profil                      | Pada akun sementara yang tidak mempunyai dokumen, simpan nama `Uji Development` dan telepon sintetis `0000000000` melalui UI. PATCH nama saja tanpa field phone, lalu baca ulang profil                                   | UI menyimpan perubahan; phone tetap tersimpan ketika tidak dikirim. Email, owner, dan role tidak berubah. Payload dengan field email/role/owner ditolak 422. Pemeriksaan ini dapat dilakukan sebelum keputusan mengenai pengajuan persisten.          |
| 3. Pengajuan A                 | Ajukan fixture melalui formulir dengan judul `UJI DEVELOPMENT — Phase 3 — <run marker>`, kategori Pendidikan yang aktif, field penerbit/tanggal opsional kosong, dan persetujuan aktif kebijakan `development-2026-11-04` | HTTP 201 mengembalikan receipt nyata: documentId, submissionId, versionNo **1**, status **pending_review**, serta timestamp database. Tidak ada kode verifikasi atau QR.                                                                              |
| 4. Data owner                  | Baca dashboard, list/search/filter pending, dan detail dengan sesi A                                                                                                                                                      | Total dan pending A menjadi satu; detail memuat satu versi, nama file, ukuran 2.831 byte, SHA-256 fixture, policy version, dan waktu persetujuan. Status approved/rejected/revoked tetap nol. DTO tidak memuat path Storage atau credential.          |
| 5. Retry identik               | Kirim ulang byte dan metadata yang sama dengan Idempotency-Key UUID yang sama dari pengajuan pertama                                                                                                                      | Receipt documentId/submissionId/version/timestamp tetap sama, count tetap satu, dan versi tetap satu. Endpoint saat ini mengembalikan 201 juga untuk receipt retry; tidak disyaratkan status 200.                                                     |
| 6. Konflik idempotency         | Gunakan key yang sama dengan judul berbeda                                                                                                                                                                                | HTTP 409 `IDEMPOTENCY_CONFLICT`; tidak ada dokumen, versi, atau penggantian file baru.                                                                                                                                                                |
| 7. Preview dan download        | A membuka endpoint file privat untuk current version dan submissionId dari receipt; unduh dengan `download=1`                                                                                                             | HTTP 200 dengan byte PDF asli; ukuran dan SHA-256 cocok. Download memakai Content-Disposition attachment. Respons memakai private/no-store, nosniff, no-referrer, dan header file yang sesuai. Tidak ada URL publik atau signed URL yang diterbitkan. |
| 8. Byte range                  | A meminta `Range: bytes=0-15` pada endpoint file yang sama                                                                                                                                                                | HTTP 206, Content-Range benar, dan body tepat 16 byte awal fixture.                                                                                                                                                                                   |
| 9. Isolasi B                   | Dengan sesi B, buka detail/file milik A, termasuk parameter submissionId A; coba endpoint resubmission target A                                                                                                           | HTTP 404 tanpa metadata atau byte A. List dan counts B tetap kosong/nol. Guest pada endpoint file memperoleh 401.                                                                                                                                     |
| 10. Akses Storage              | Periksa bahwa endpoint publik Storage dan client pengguna biasa tidak dapat membaca object uji secara langsung                                                                                                            | Tidak ada byte PDF yang diberikan; akses tetap melalui endpoint aplikasi dan pemeriksaan owner. Jangan mencetak path atau menambah policy agar pengujian lulus.                                                                                       |
| 11. Syarat revisi              | A mencoba resubmission dokumen yang masih pending dengan PDF dan metadata valid                                                                                                                                           | HTTP 409 `DOCUMENT_NOT_ELIGIBLE`; versi tetap satu. Tidak dibuat keputusan review atau status revision_requested untuk melewati prasyarat.                                                                                                            |
| 12. Tutup sesi dan catat hasil | Logout akun uji, catat run marker, hasil pemeriksaan, dan identitas record sintetis yang harus dipertahankan pada catatan operator lokal                                                                                  | Hasil lulus/gagal dibedakan; tidak ada credential, token, secret, atau data pengguna lain dalam output. Akun B dibersihkan hanya setelah ID/email/run marker yang dibuat sendiri diverifikasi.                                                        |

Skenario revisi sukses memerlukan fixture development yang sah berstatus `revision_requested`. Rencana ini tidak menciptakan transisi review Phase 4. Perilaku versi revisi tetap menggunakan bukti tes PostgreSQL terisolasi sampai fixture yang sah tersedia.

## Mengapa pengajuan sukses tidak dapat dibersihkan otomatis

Migration 001 menetapkan `documents.owner_id` dan `document_submissions.submitted_by` sebagai foreign key ke Auth user dengan **ON DELETE RESTRICT**. Submission juga mereferensikan dokumen dengan RESTRICT. Migration 003 tidak memberikan hak DELETE atas dokumen/submission kepada service role dan trigger submission menolak DELETE dengan `IMMUTABLE_RECORD`. Catatan audit juga melarang UPDATE/DELETE melalui trigger dari migration 002.

Karena itu, menghapus akun A lewat Auth Admin API sesudah submit tidak menjadi rollback yang sah. Menghapus hanya object Storage akan merusak referensi file dari submission yang telah tersimpan. Tidak ada endpoint cleanup, perubahan trigger, atau peluasan grant yang diusulkan.

Jika hasil commit tidak pasti, hentikan uji dan periksa receipt/metadata sebelum tindakan lain. Pertahankan object privat dan record yang mungkin sudah committed untuk rekonsiliasi operator. Jangan mencoba pengajuan baru berulang kali atau menghapus artefak hanya berdasarkan pesan timeout.

Laporan setelah eksekusi harus menyebutkan dengan jelas bahwa ada **satu fixture pengajuan development persisten**, termasuk run marker dan statusnya. Pengujian ini tidak menyatakan aplikasi siap produksi, dokumen asli telah diverifikasi, atau Phase 4 telah dimulai.
