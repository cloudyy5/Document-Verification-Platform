# Rencana penerimaan cloud R3

Tanggal: **10 November 2026**. **Fixture ini sudah disetujui pengguna dan dilaksanakan.** [Hasil cloud R3](r3-cloud-report.md) lulus setelah interupsi tes dan kelanjutan pada dua dokumen serta tiga ID akun yang sama. Runner R2 tidak dipakai ulang. [Aktivasi 010](r3-activation-check.md) lulus 43 preflight. Hasil acceptance berasal dari alur peserta nyata, bukan preflight/unit saja.

## Prasyarat

Migration 010 sudah dilaporkan dijalankan operator dan preflight `npm run supabase:check -- --workspace --signing --signing-r3` lulus. Build produksi, validasi environment development, private bucket dan consent versi yang disetujui tetap berlaku. Service key hanya di runner/server; tidak dikirim ke konteks browser.

## Fixture yang disetujui dan dipertahankan

- Tiga akun sintetis terkonfirmasi: A owner, B recipient dan C pembanding; tanpa data pribadi nyata atau pengiriman email.
- **Dua dokumen baru**, masing-masing satu versi PDF sintetis `UJI DEVELOPMENT` 2.831 byte yang telah tersedia; dua request A → B. Satu untuk approve, satu untuk reject dengan alasan sintetis.
- Approve menghasilkan satu receipt, satu keputusan immutable dan satu PDF turunan privat dua halaman (satu halaman asli + satu bukti). Reject menghasilkan satu keputusan/alasan dan **nol receipt/PDF turunan**.
- A dan B, dua PDF sumber, dua dokumen/versi/request/keputusan, receipt approve dan satu PDF hasil tetap tersimpan sesuai kontrak immutable. C hanya dibersihkan setelah verifikasi tidak memiliki data/relasi. Jika hasil sebagian/tidak pasti, simpan proof dan rekonsiliasi terlebih dahulu; jangan menghapus atau membuat fixture pengganti otomatis.

Persetujuan cloud R1/R2 sebelumnya tidak diperluas; pengguna memberikan persetujuan R3 tersendiri. Fixture telah direkonsiliasi dan terminal. Akun/dokumen R1/R2 tidak diubah. Tidak melakukan reset password peserta, menonaktifkan trigger immutable, mengunggah data pribadi atau menjalankan tindakan admin monitoring.

## Kelompok pemeriksaan

| Bagian           | Bukti wajib                                                                                                                                                                                                                                 |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Setup/kode/draft | Login A/B nyata; lookup kode exact; dua upload + dua undangan melalui kontrak aplikasi, bytes/hash sumber cocok. Tidak ada QR sebelum keputusan.                                                                                            |
| Akses negatif    | Guest401; C nonpeserta404; A tidak dapat memutuskan atas nama B; body actor/status/path dan versi/hash palsu ditolak. Storage langsung source/result tetap ditolak. Admin nonpeserta dicakup SQL native, tanpa grant admin baru pada cloud. |
| Approve          | B membuka versi tepat; modal tanpa password/OTP dan checkbox awal kosong; confirm memakai versi/hash/policy dan Idempotency-Key. Tepat satu decision/receipt.                                                                               |
| Retry/integritas | Exact retry tidak menggandakan keputusan/receipt/object ready; payload berubah/key salah conflict. PDF hasil berbeda dari sumber, hash/ukuran tersimpan sesuai byte aktual, source tetap sama.                                              |
| QR               | QR footer kiri bawah halaman asli dan QR halaman bukti dapat didekode independen ke receipt sama. Semua payload bebas credential; login dan participant authorization tetap wajib.                                                          |
| Result/receipt   | A/B membaca receipt dan preview/download/Range hasil ready; nama/kode/waktu/hash sesuai snapshot. Foreign/guest tidak memperoleh PDF atau metadata. Visual desktop/mobile dan Light/Dark diperiksa.                                         |
| Reject           | Alasan kosong/lebih dari1.000 ditolak; alasan valid tercatat privat, status rejected dan nol receipt/result. B kehilangan source bytes/metadata sesuai kontrak; A tetap dapat membaca sumber. Riwayat alasan tidak membuka kembali file.    |
| Penutupan        | Enumerasi hanya prefix/ID run sendiri; verifikasi jumlah record/object dan tidak ada QR legacy baru. Simpan receipt run, ringkasan tes dan fixture yang dipertahankan; cleanup C bila terbukti kosong.                                      |

Race keputusan, lease/timeout dan kegagalan provider sudah dicakup unit/SQL terisolasi; jangan membuat banyak dokumen cloud untuk mereplikasi seluruh matriks tanpa persetujuan tambahan. Foto/screenshot/trace tidak merekam credential; artefak visual hanya sintetis.

## Runner yang sudah disiapkan

- `scripts/test-signing-r3-cloud.mjs` memakai marker suite `signing-r3`, exact Auth ID/email/run, lock eksklusif dan proof terpisah `test-results/cloud-signing-r3-run.json` serta per-run UUID. Guard memeriksa pointer dan orphan proof **sebelum network**. Run sukses/parsial menghalangi pengulangan; jangan menghapus proof untuk melewatinya.
- `tests/e2e/signing-r3-cloud.spec.ts` hanya masuk config `playwright.signing-r3-cloud.config.ts`, satu worker, tanpa retry, trace/video/screenshot otomatis dimatikan. Output khusus `test-results/signing-r3-cloud-browser` tidak membersihkan receipt operator. Screenshot eksplisit hanya pada receipt/PDF sintetis setelah login; email header dimask. Credential tidak dipersistenkan pada proof atau log.
- Runner membaca kembali dua sumber, keputusan/receipt, metadata/object hasil dan hash byte sebelum menyatakan lulus. A/B dipertahankan setelah browser dimulai; C hanya dihapus setelah identity marker dan seluruh relasi/prefix terbukti kosong. Hasil tidak pasti dipertahankan untuk rekonsiliasi, tanpa auto-reset/overwrite/delete riwayat.
- Cloud memakai C sebagai pengguna biasa. Uji admin nonpeserta tetap berasal dari SQL native; runner ini tidak memberi role admin atau mengubah kewenangan admin. Ia memeriksa guest/C, owner yang bukan recipient, Data API, Storage langsung dan EXECUTE RPC user yang ditolak.

Pemeriksaan terakhir: TypeScript, ESLint, **746 unit/30 file**, delapan tes subprocess guard dengan network stub, dan pembacaan QR dua halaman dari fixture lokal serta hasil cloud. Sebanyak 323 tes SQL serta build/browser baseline R3 sudah lulus pada laporan R3; aplikasi/SQL tidak berubah saat kelanjutan sehingga tidak diulang. Suite fixture awal berhenti setelah empat checkpoint pada asumsi HTTP404 halaman streaming; kelanjutan yang ditinjau lulus tujuh checkpoint dengan exit code0. [Laporan hasil](r3-cloud-report.md) mempertahankan bukti awal yang gagal, pemulihan C dengan ID sama, dan keadaan akhir.

```powershell
# Aman: hanya konfigurasi lokal, checksum fixture dan guard proof; nol jaringan
npm run test:cloud:signing:r3 -- --check-only

# Invocation historis yang sudah dijalankan; jangan ulangi fixture ini
npm run test:cloud:signing:r3 -- --confirm-persistent-fixture
```

Persetujuan telah dipakai untuk fixture run `4d679704-e156-4f55-be23-db7dd80578c4`. Jangan mengulang runner atau menghapus proof. Guard pointer/per-run dan kelanjutan tetap menolak eksekusi ulang setelah terminal. Kelanjutan dibatasi pada satu run/ID yang ditinjau; tidak menyediakan resume generik, upload baru atau persetujuan kedua.
