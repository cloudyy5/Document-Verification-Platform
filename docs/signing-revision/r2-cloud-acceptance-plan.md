# Uji penerimaan cloud R2 — rencana konkret

Checkpoint: **9 November 2026**, Asia/Makassar. Migration 009 dilaporkan sudah dijalankan oleh pengguna. Preflight Data API telah menemukan empat tabel dan lima RPC R2. Pengguna menyetujui cakupan fixture ini dengan jawaban eksplisit **“Ya, jalankan uji sintetis R2”**. Eksekusi dan hasil dicatat terpisah; persetujuan ini tidak menyatakan pengujian sudah lulus.

**Hasil pelaksanaan:** satu skenario/tujuh kelompok lulus dan rekonsiliasi selesai. A/B serta satu draft/versi/PDF/request cancelled dipertahankan; C dibersihkan. Rincian berada pada [laporan cloud R2](r2-cloud-report.md). Rencana di bawah dipertahankan sebagai cakupan uji yang telah dijalankan, bukan izin mengulang fixture.

## Data yang akan dibuat

- Tiga akun development sintetis: A sebagai pemilik, B sebagai penerima, C sebagai pengguna pembanding. Alamat memakai domain `example.invalid`, nama menyebut uji development, password acak hanya di memori. Akun dibuat terverifikasi melalui API admin khusus pengujian; tidak ada email, SMS, pembayaran, atau perubahan role administratif.
- Satu file yang sudah tersedia di `tests/fixtures/phase-3-development.pdf`, berukuran 2.831 byte dan berlabel UJI DEVELOPMENT, tanpa data pribadi. SHA-256 fixture: `6cc3a629004962b6b8df8755a1ca56c5e41cdee0dc991ea3af44617a79e8c0cc`.
- Satu draft, satu versi sumber, dan satu permintaan A → B. Pengulangan dengan idempotency key yang sama harus mengembalikan record yang sama. Tidak ada permintaan kedua, persetujuan, penolakan atau QR.
- Pada akhir alur sukses, A membatalkan undangan. Ini mengakhiri akses PDF B dan mempertahankan riwayat.

**Yang tetap tersimpan setelah sukses:** dua akun peserta A/B, satu draft/versi/PDF privat, satu permintaan berstatus cancelled, kode akun peserta, notifikasi dan riwayat audit terkait. Foreign key serta aturan immutable memang mempertahankan peserta riwayat. C dibersihkan hanya setelah ownership dan ketiadaan referensi dokumen/permintaan/Storage miliknya diperiksa. Fixture R1 terdahulu tidak digunakan atau diubah.

Counter pembatasan operasi akan berubah sesuai aktivitas uji normal. Tidak ada reset counter, penghapusan bukti, pelonggaran RLS, bucket publik, atau penghapusan dokumen immutable untuk membersihkan tes.

## Pemeriksaan yang akan dijalankan

1. Login nyata A/B/C melalui aplikasi lokal yang terhubung ke Supabase development; kode akun sendiri dapat dibaca dan berbeda.
2. A mengunggah satu PDF melalui form draft dengan consent penyimpanan development. Retry identik tidak menambah draft/object; perubahan payload dengan key yang sama ditolak.
3. Sebelum undangan, B/C tidak dapat membaca metadata atau PDF A. A menemukan kode tepat B, memilih penerima, memberikan consent berbagi, lalu mengirim undangan melalui UI.
4. Retry pengiriman mempertahankan satu request. B melihat permintaan masuk dan sumber yang benar; hash download dan Range cocok dengan byte fixture. Preview menggunakan browser Chromium penuh.
5. C dan guest ditolak oleh API. Query langsung versi melalui Data API tetap dibatasi RLS; pemanggilan RPC mutasi oleh user ditolak. Storage langsung tidak memberi byte file.
6. A membatalkan melalui konfirmasi UI. B masih melihat riwayat cancelled, sedangkan metadata sumber/preview/download dicabut. A masih dapat membaca sumber yang sama.
7. Rekonsiliasi memakai client server terbatas pada ID akun/record/prefix uji yang sudah dicatat. Status akhir dan disposition disimpan tanpa password, token, secret atau isi PDF.

Uji cloud ini tidak menunggu tujuh hari atau memodifikasi waktu/status langsung untuk memaksakan expiry. Batas expiry dan status R3 reserved telah diuji pada PostgreSQL lokal; uji cloud ini membuktikan grant pending dan pencabutan cancellation. Tidak ada klaim email delivery atau workflow R3/R4.

## Penjagaan runner

Runner `scripts/test-signing-cloud.mjs` memerlukan flag `--confirm-persistent-fixture` dan environment development/loopback. Sebelum network, runner memeriksa receipt terpisah di `test-results/cloud-signing-run.json`; hasil sukses/retained/uncertain menolak pembuatan fixture ulang. Catatan per-run dicatat sebelum tindakan yang mungkin meninggalkan data. Credentials hanya diteruskan di environment proses child, tidak disimpan pada receipt, log, trace, video atau screenshot.

Output tes browser biasa menggunakan `test-results/browser`; output cloud memakai subdirektori terpisah. Receipt operator berada di direktori induk dan harus tetap dipertahankan. Menjalankan suite browser biasa setelah R2 telah diverifikasi tidak mengubah keempat receipt R1/R2.

Jika unggahan atau commit tidak pasti, runner mempertahankan objek/akun terkait untuk rekonsiliasi dan melaporkan masalah. Tidak ada cleanup otomatis atas object yang mungkin sudah diikat riwayat. Jika akun benar-benar kosong, cleanup hanya memakai ID dan metadata run yang cocok. Memperbaiki tes tidak berarti diizinkan membuat fixture kedua atau menghapus guard receipt.

## Menjalankan sesudah persetujuan fixture

Build aplikasi terlebih dahulu. Runner memakai konfigurasi Playwright terpisah dan production server lokal pada port 3100. Menjalankan unit test atau E2E biasa tidak membuat fixture cloud ini.

```powershell
npm run build
npm run test:cloud:signing -- --confirm-persistent-fixture
```

Persetujuan consent development dan aktivasi migration sudah dicatat terpisah. Pertanyaan persetujuan fixture hanya berkaitan dengan tiga akun baru serta riwayat tambahan yang akan ditinggalkan oleh uji ini.
