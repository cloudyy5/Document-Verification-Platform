# Metadata QR tanpa login — source 0.12.0

Tanggal: **17 November 2026**, Asia/Makassar. Keputusan **S-19** disetujui secara eksplisit: **“Status, waktu, nama penandatangan, dan judul dokumen”**, serta **“Berlaku juga untuk QR persetujuan lama”**. Ketentuan ini menggantikan pembatasan metadata privat sebelumnya hanya untuk empat field tersebut. Lingkungan tetap prototipe sintetis; kebijakan operasional/retensi/TTE tersertifikasi tidak diubah.

**Checkpoint aktivasi:** pengguna melaporkan 014 berhasil dan tiga preflight API khusus metadata publik lulus. Namun 013 belum terdeteksi melalui API project pada `.env.local`, dan landing QR domain deployment masih redirect ke login. [Hasil pemeriksaan dan tindak lanjut](public-qr-metadata-activation-check.md) mencatat bukti tersebut; metadata publik di domain belum dinyatakan aktif.

## Perilaku

QR tetap berisi URL `/receipts/<id-acak>`. Kamera HP membuka halaman metadata tanpa login, termasuk ketika browser belum mempunyai sesi atau cookie login sudah kedaluwarsa. QR dan byte PDF lama tidak perlu diganti selama domain pada QR masih mengarah ke deployment ini.

Halaman menampilkan status **Disetujui**, waktu persetujuan, snapshot nama penandatangan dan judul dokumen. Status tersebut berarti keputusan persetujuan sudah committed; bukan klaim bahwa PDF hasil pasti sudah selesai dirender. Permintaan pending/ditolak/dibatalkan/kedaluwarsa tidak menerbitkan receipt persetujuan dan tidak ditampilkan sebagai disetujui. Identifier invalid/tidak ditemukan mendapat halaman generik tanpa metadata.

`/receipts/<id>/details` adalah halaman peserta untuk bukti lengkap serta PDF. Tombol dari workspace mengarah ke halaman ini. Guest harus login, pengguna lain ditolak dan admin monitoring tidak otomatis mendapat dokumen. Semua API bukti, PDF sumber/hasil dan Storage tetap memakai guard/RLS sebelumnya. Tidak ada URL download atau signed URL pada halaman publik. Pengunjung publik hanya melihat empat field; email, kode akun, pemilik, ID akun, hash, alasan penolakan, posisi QR dan PDF tidak diberikan.

Nama serta judul pada QR lama juga menjadi terlihat bagi pemegang tautan sesuai persetujuan S-19. Snapshot receipt lama tidak diubah menjadi profil terbaru. Teks tercetak “privat/login” pada PDF historis tetap utuh; perilaku landing web sekarang mengikuti S-19. QR membuktikan bahwa catatan tersebut ada di platform, bukan bahwa file yang memuat salinan QR cocok dengan catatan. Pencocokan hash/PDF tetap fitur privat peserta.

## Implementasi

- Migration **014** menambahkan RPC service-only `get_signing_public_metadata(text)` yang mengembalikan tepat empat field dari receipt dan keputusan yang konsisten, serta limiter persisten terpisah. Tidak ada UPDATE pada receipt/keputusan/manifest/artefak lama atau grant SELECT baru untuk anon.
- DAL publik tidak membaca sesi/cookie atau tabel privat secara langsung. Ia menjalankan gate development, limiter dan RPC proyeksi, lalu memvalidasi DTO strict. Extra field dari provider membuat respons gagal tertutup. Secret tidak masuk komponen/browser.
- Limiter: maksimal 60 pembacaan per receipt dalam lima menit dan 1.000 secara global dalam lima menit. Hanya HMAC digest yang disimpan, tanpa token URL mentah/IP/data pribadi. Penolakan global terjadi sebelum pembuatan key receipt tambahan. Ini batas teknis prototipe, bukan jaminan kapasitas atau perlindungan seluruh infrastruktur.
- Hanya landing satu segmen `/receipts/<id>` yang melewati autentikasi proxy. Subroute `details` dan API tetap meminta autentikasi. Halaman publik di luar User Workspace sehingga tidak memuat nama/email akun pengunjung.
- Respons tidak disimpan dalam cache, menggunakan `no-referrer`, serta `noindex/nofollow/noarchive`; tidak ada direktori publik atau pencarian nama/judul. `noindex` bukan kontrol akses: siapa pun yang mempunyai tautan dapat melihat empat field yang disetujui.
- Form upload, pengiriman dan persetujuan menampilkan pemberitahuan metadata publik. Versi consent/histori lama tidak ditulis ulang; keputusan perubahan akses dicatat pada S-19.

## Aktivasi

Perubahan source belum otomatis diterapkan ke server atau Supabase cloud.

1. Pastikan migration **013** dari [perubahan jumlah QR](selected-qr-pages-and-pdf-validation.md) sudah berhasil. Jika belum, jalankan 013 terlebih dahulu sekali. Jangan mengulangi migration yang sudah berhasil.
2. Supabase project aplikasi → **SQL Editor → New query (+)**, role **postgres**. Jalankan seluruh isi [202611170014_public_signing_metadata.sql](../supabase/migrations/202611170014_public_signing_metadata.sql) **sekali**. Hasil yang diharapkan: `Success. No rows returned`. Migration satu transaksi; jika gagal, simpan error dan jangan lanjut deployment.
3. Dari mesin operator dengan `.env.local` project yang benar, jalankan:

   ```powershell
   npm run supabase:check -- --public-metadata
   ```

   Pemeriksaan ini tidak mengambil record nyata atau menulis limiter: lookup memakai ID null, pemanggilan anon harus ditolak, dan input limiter null harus ditolak sebelum mutasi. Jangan kirim atau mencetak nilai key.

4. Ambil source terbaru dan rebuild/recreate container di server:

   ```sh
   docker compose --env-file .env.local build
   docker compose --env-file .env.local up -d --force-recreate
   ```

   Tidak ada environment variable baru. Pertahankan `APP_URL`, opt-in domain prototipe, key Supabase dan `AUTH_FLOW_SECRET` server-only yang sudah benar.

5. Buka QR lama dari kamera HP atau browser incognito. Metadata empat field harus langsung tampil. Tekan **Buka dokumen sebagai peserta**: login tetap diwajibkan untuk PDF. Uji juga memakai akun pembanding yang tidak berhak; API PDF harus tetap menolak.

Langkah SQL Editor diperlukan karena API key aplikasi tidak memiliki hak DDL. Pengujian cloud baru dan penayangan metadata receipt nyata belum dijalankan oleh agent. Pengujian otomatis lokal memakai fixture sintetis; tidak membuat akun, undangan atau PDF cloud.

## Verifikasi

| Pemeriksaan                                       | Hasil lokal                                                                                                                             |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| ESLint, TypeScript strict/route typegen, Prettier | Lulus                                                                                                                                   |
| Unit                                              | 1.085 lulus, 47 file; termasuk tanpa Auth, whitelist, kegagalan tertutup, HMAC limiter, escaping dan render halaman                     |
| PostgreSQL 17 terisolasi                          | 403 lulus, 13 file; migration 001–014 diterapkan; proyeksi empat field diuji untuk receipt v1/v2/v3, izin tabel/Storage dan limiter     |
| Metadata UI Chromium                              | 3 lulus pada desktop/tablet/mobile, masing-masing light/dark; layout mobile diperiksa visual                                            |
| Arsip UI Chromium                                 | 33 lulus, termasuk tautan baru ke detail peserta dan pemeriksaan PDF privat                                                             |
| Browser production lokal                          | 46 lulus, 5 dilewati; landing invalid tanpa login dengan respons 404/no-store/no-referrer/noindex, detail serta API tetap meminta login |
| Build                                             | Lulus pada retry; CLI Next.js 16.4.3 masih memberi peringatan pembaruan keamanan                                                        |
| Preservasi                                        | 41 file paket asli dan 5 receipt cloud tetap identik menurut SHA-256; migration historis 001–012 tidak berubah                          |

Lima browser test yang dilewati adalah tiga smoke sesi cloud opt-in yang tidak diaktifkan dan dua drawer khusus mobile. PostgreSQL lokal hanya memodelkan metadata Auth/Storage; bukan GoTrue/PostgREST/Storage HTTP cloud. Metadata valid diuji melalui UI lokal, unit page/DAL dan RPC SQL, sedangkan browser production memeriksa jalur publik invalid serta penolakan akses privat. Aktivasi dan smoke metadata valid pada domain cloud masih memerlukan langkah operator di atas. Docker Engine tidak tersedia, sehingga image/container Linux tidak dijalankan pada mesin ini.

Build pertama selesai kompilasi/typecheck/static generation lalu CLI berhenti untuk menampilkan `SecurityFatalError`. Retry perintah build yang sama berhasil dengan warning. Dependency tidak dinaikkan pada perubahan ini; pembaruan keamanan Next.js masih diperlukan dan build berhasil tidak menyelesaikan warning tersebut.

File utama: landing `src/app/receipts/[receiptId]`, halaman peserta `src/app/(user)/receipts/[receiptId]/details`, view publik `src/features/signing/public-metadata-view.tsx`, schema dan DAL `src/lib/signing/public-metadata.ts` / `src/server/signing/public-metadata.ts`, proxy dan header konfigurasi, migration 014, tipe database hasil generate, serta preflight `--public-metadata`. Disclosure form dan tautan dari keputusan/arsip sudah diselaraskan. Test UI tersedia melalui `npm run test:ui:public-metadata`.

Bukti pengujian historis tetap sebagai catatan perilaku saat pengujian tersebut dilakukan, bukan harapan bahwa metadata masih privat setelah S-19. Source 0.11.0 dan migration 013 dari permintaan sebelumnya juga tetap ada di working tree; perubahan ini menambah 014 tanpa menghapus atau mengulang hasil lama.
