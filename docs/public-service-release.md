# Layanan publik — source 0.13.0

Disusun **18 November 2026**, Asia/Makassar. Pengguna mengarahkan layanan untuk penggunaan publik, memilih penyimpanan tanpa penghapusan otomatis dengan prosedur operator, menyetujui ClamAV di Docker, dan menetapkan kontak publik **KPILKOMITH / kp.ilkomith@gmail.com**. Identifier kebijakan `2026-11-17` menandai versi yang mulai disiapkan pada 17 November, bukan tanggal deployment.

## Perilaku dan kebijakan aktif

Label prototipe/dokumen sintetis/development pada formulir, halaman kebijakan, dashboard, monitoring dan pesan error telah diganti. Halaman komponen `/foundation` hanya tersedia pada origin loopback. Metadata situs menggunakan deskripsi layanan dokumen.

PDF dan riwayat disimpan tanpa penghapusan otomatis. Permintaan penghapusan diterima pengelola, diverifikasi cakupannya, lalu ditangani melalui prosedur operator. Source ini tidak menyediakan auto-purge, tombol hapus bukti atau penghapusan riwayat secara diam-diam. Keputusan dan bukti tetap immutable; permintaan tidak langsung menghapus data. Kontak tampil di halaman kebijakan dan dapat diganti melalui `SERVICE_OPERATOR_NAME` / `SERVICE_SUPPORT_EMAIL`.

Satu pemilik mengirim kepada satu penerima lain. Email terverifikasi, login, konfirmasi eksplisit, alasan penolakan, jangka undangan tujuh hari, batas 10 MiB sumber/20 MiB hasil dan posisi QR pilihan tetap berlaku. Empat metadata QR publik mengikuti S-19; PDF, email akun, kode akun dan bukti lengkap tetap privat. Admin hanya memonitor agregat, bukan reviewer atau pembaca semua PDF. Penggunaan publik tidak mengubah bukti platform menjadi TTE tersertifikasi.

Kebijakan baru memakai `internal-upload-2026-11-17`, `internal-sharing-2026-11-17`, `internal-action-2026-11-17` serta `submission-2026-11-17` untuk pengajuan administratif. Migration **015** memperluas constraint dan fungsi service-only untuk versi baru, mempertahankan versi historis tanpa UPDATE baris lama. Backend menerima persetujuan baru memakai versi saat ini; pembaca bukti masih memahami versi lama dan menampilkan teks consent sesuai versi receipt. Retry tidak boleh mengganti versi kebijakan dari keputusan yang sudah final.

## Pemindaian file

Upload baru divalidasi sebagai PDF, diperiksa ukuran/struktur/enkripsi/konten aktif, lalu byte yang sama dikirim ke ClamAV sebelum upload Storage dan commit dokumen. Scanner mengembalikan hasil bersih agar penyimpanan dilanjutkan; deteksi memberi `UNSAFE_FILE`, sedangkan error/koneksi gagal/timeout/respons tidak valid memberi `FILE_SCAN_UNAVAILABLE`. Kedua kasus mencegah file baru disimpan. Retry identik atas record yang sudah committed tetap memakai riwayat yang sama. File lama tidak dinyatakan sudah dipindai ulang oleh perubahan ini.

ClamAV memakai protokol INSTREAM dengan frame dan respons terbatas, tanpa shell, path file pengguna, atau file sementara aplikasi. Deadline default 30 detik, paling tinggi 60 detik; koneksi ditutup setelah selesai/gagal. Hanya development loopback boleh tidak mengonfigurasi scanner. Domain publik tetap memerlukan scan meski environment salah diisi sebagai development.

Compose menjalankan `clamav/clamav:1.4`, volume definisi persisten dan healthcheck bawaan; web menunggu scanner healthy. Tidak ada mapping port scanner ke host. Definisi diperbarui FreshClam pada image resmi. Image berada pada jalur LTS dan perlu di-pull berkala. Rujukan: [Docker ClamAV](https://docs.clamav.net/manual/Installing/Docker.html), [kebijakan dukungan](https://docs.clamav.net/faq/faq-eol.html), [protokol ClamD](https://docs.clamav.net/manual/Usage/ClamdProtocol.html).

Dokumentasi resmi merekomendasikan **minimum 3 GiB dan lebih baik 4 GiB RAM untuk ClamAV**, di luar kebutuhan aplikasi/OS. Tidak ada biaya lisensi scanner, tetapi kapasitas server tetap diperlukan. Jangan mematikan scanner pada domain publik untuk mengatasi kekurangan RAM; gunakan server dengan kapasitas yang memadai.

## Aktivasi pada project dan server

1. Pengguna telah mengonfirmasi migration 013, 014 dan 015 berhasil. Pada **18 November 2026**, preflight API gabungan `--selected-qr --public-metadata --service-policy` lulus **14 pemeriksaan**, termasuk kontrak kebijakan baru dari migration 015. Jangan ulangi 001–015 pada project yang sudah diperiksa ini.
2. Untuk project lain yang belum menerima perubahan ini: jalankan seluruh [202611170015_public_service_policies.sql](../supabase/migrations/202611170015_public_service_policies.sql) sekali melalui SQL Editor dengan role `postgres`, setelah migration sebelumnya. Harus `Success. No rows returned` tanpa error. DDL satu transaksi; jika gagal, simpan error dan jangan lanjut deployment. Langkah ini sudah selesai pada project pengguna.
3. Dari mesin operator dengan `.env.local` project yang benar:

   ```powershell
   npm run supabase:check -- --selected-qr --public-metadata --service-policy
   ```

   Lookup memakai input null/invalid yang tidak mengambil record pribadi atau menulis hit limiter; RPC kontrak kebijakan hanya mengembalikan versi dan pengaturan kebijakan. Key aplikasi tidak dapat menjalankan DDL.

4. Masukkan seluruh source 0.13.0 ke repository dan ambil di server. Salin `.env.production.example` ke `.env.production` bila belum ada, atau edit file env server yang memang dipakai. Pertahankan secret yang valid secara langsung di server; jangan menyalin key ke chat/source. Isi:

   ```dotenv
   APP_URL=https://dvp.ilkomith.cloud
   DOCUMENT_ENVIRONMENT=production
   DOCUMENT_MAX_FILE_BYTES=10485760
   CLAMAV_TIMEOUT_MS=30000
   SERVICE_OPERATOR_NAME=KPILKOMITH
   SERVICE_SUPPORT_EMAIL=kp.ilkomith@gmail.com
   ```

   Compose menyediakan `CLAMAV_HOST=clamav` dan `CLAMAV_PORT=3310`. Opt-in origin development lama tidak digunakan. Nama file env tidak menentukan mode; nilai `DOCUMENT_ENVIRONMENT` harus benar. Tidak perlu secret baru atau reset akun/riwayat.

5. Jalankan dari direktori aplikasi di server:

   ```sh
   docker compose --env-file .env.production config --quiet
   docker compose --env-file .env.production pull clamav
   docker compose --env-file .env.production build --pull web
   docker compose --env-file .env.production up -d --force-recreate
   docker compose --env-file .env.production ps
   docker compose --env-file .env.production exec -T web node scripts/check-clamav.mjs
   ```

   Startup definisi bisa memerlukan beberapa menit. Smoke scanner mengirim dua stream dalam memori: penanda teks bersih serta pola uji EICAR yang tidak berbahaya. Harus menerima yang bersih dan mendeteksi pola uji; tidak ada PDF, file atau record Supabase dibuat. Ini bukan pengujian dengan malware nyata. Jangan menampilkan `docker inspect` atau `compose config` lengkap karena dapat memuat secret.

6. Periksa kebijakan/kontak di `/policies/submission`, halaman dokumen, upload, pengiriman, keputusan dan scan QR tanpa login. Gunakan satu PDF tanpa data sensitif untuk uji rilis awal. Pastikan file ditolak dan tidak menjadi dokumen baru ketika scanner tidak tersedia pada lingkungan staging yang terkontrol. Penonaktifan scanner untuk uji tidak mengubah hasil menjadi lolos.
7. Periksa registrasi/konfirmasi email, recovery, isolasi dua peserta, PDF hasil dan notifikasi dengan [alur UAT](alur-pengujian-manual.md). Delivery email/SMTP serta kapasitas akun Supabase harus dibuktikan melalui lingkungan deployment, bukan berdasarkan build. Tidak ada perubahan alamat pengirim email oleh konfigurasi kontak bantuan.

Checkpoint deployment **18 November 2026**, setelah konfirmasi migration 015: GET publik ke `https://dvp.ilkomith.cloud/policies/submission` mengembalikan 200 pada path yang sama, tetapi judulnya masih “Kebijakan pengajuan development | DVP”. Versi kebijakan `submission-2026-11-17` serta kontak KPILKOMITH belum tampil pada respons tersebut. Halaman deployment masih menyajikan tampilan lama; keberhasilan migration tidak memperbarui image/container web. Masukkan source 0.13.0 ke server dan bangun ulang sesuai langkah 4–5 sebelum memeriksa hasil lagi. Pemeriksaan ini tidak memakai sesi login atau membaca PDF/data peserta.

## Prosedur permintaan penghapusan

Pengguna menghubungi kontak publik pengelola. Operator mencatat permintaan, memverifikasi pemohon melalui akun yang berhak, mengidentifikasi dokumen/versi dan peserta terkait, serta menentukan cakupan data dan cadangan yang perlu ditangani. Pertimbangkan hak peserta lain dan catatan persetujuan sebelum tindakan terhadap bukti bersama. Informasikan hasil dan cakupan kepada pemohon melalui kanal yang sah.

Riwayat signing memiliki trigger immutable dan foreign key restrict. Dokumen ini bukan script untuk melewati trigger, memberi admin akses PDF global atau melakukan DELETE massal. Pelaksanaan penghapusan kasus tertentu memerlukan langkah operator terpisah yang menjaga integritas dan mempertanggungjawabkan cakupannya. Tidak ada janji bahwa permintaan langsung menghapus bukti bersama. Perubahan ini tidak mengklaim kepatuhan hukum atau sertifikasi hanya dari hasil pengujian teknis.

## Verifikasi dan batas bukti

| Pemeriksaan                                       | Hasil                                                                                                                                       |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| ESLint, TypeScript strict/route typegen, Prettier | Lulus                                                                                                                                       |
| Unit                                              | 1.089 lulus, 49 file; termasuk transport TCP ClamD lokal, penolakan penyimpanan saat scan gagal, kontak publik dan pembacaan bukti historis |
| PostgreSQL 17 terisolasi                          | 409 lulus, 14 file; migration 001–015 diterapkan; cluster dihentikan dan dihapus                                                            |
| Compose CLI config                                | 2 kontrak lulus dengan credential sintetis; scanner private, health dependency, volume definisi, serta secret hanya runtime                 |
| Monitoring UI Chromium                            | 6 lulus pada desktop/tablet/mobile, tema terang/gelap dan error tanpa nol palsu                                                             |
| Browser production lokal                          | 49 lulus, 5 dilewati; termasuk kebijakan tanpa label uji, kontak KPILKOMITH, QR landing tanpa login serta PDF/API privat                    |
| Origin publik sintetis pada build lokal           | `/foundation` 404; kebijakan 200 dengan kontak; QR invalid 404 tanpa redirect login                                                         |
| Build Next.js 16.4.6                              | Lulus tanpa peringatan keamanan Next.js sebelumnya                                                                                          |
| Audit dependency runtime                          | 0 advisori pada pemeriksaan npm; dev dependency tidak tercakup audit ini                                                                    |
| API cloud migration 013/014/015                   | 14 preflight lulus pada 18 November; tanpa record pribadi atau fixture baru                                                                 |
| Preservasi                                        | 41 file dokumentasi/aset asli dan 5 receipt cloud tetap identik SHA-256; migration 001–014 tidak diubah pada pekerjaan layanan publik ini   |

Lima browser test yang dilewati adalah tiga smoke sesi cloud opt-in yang tidak dijalankan dan dua drawer khusus mobile. Docker Engine tidak tersedia pada workspace Windows ini, sehingga Compose dapat divalidasi tetapi image/container ClamAV Linux dan deteksi engine nyata belum dijalankan oleh agent. Tes TCP lokal memakai fixture protokol; hasilnya tidak boleh dipresentasikan sebagai hasil engine antivirus. Migration 015 telah dikonfirmasi operator dan kontrak kebijakannya tersedia melalui API cloud; preflight ini tidak menjalankan transaksi dokumen atau membuktikan seluruh definisi fungsi cloud. Deployment source baru serta engine ClamAV di server belum terverifikasi. Registrasi/delivery email serta transaksi PDF operasional sesudah deployment masih memerlukan UAT operator; tidak dibuat data cloud baru untuk pengujian ini.

File utama: konfigurasi kebijakan dokumen dan consent, UI signing/workspace/monitoring/kebijakan, `src/server/documents/malware.ts` dan `clamav-client.mjs`, dua pipeline upload, `docker-compose.yml`, Dockerfile, contoh env production, smoke scanner, migration 015, tipe database hasil generate, serta test protokol/orchestrasi/policy/database/browser. Source menambahkan arsip dokumentasi lama dan memperbarui README/panduan aktif tanpa menghapus paket dokumentasi awal.

Next.js dan plugin ESLint dinaikkan dari 16.4.3 menjadi **16.4.6**. [Rilis resmi](https://github.com/vercel/next.js/releases/tag/v16.4.6) dan [metadata npm](https://registry.npmjs.org/next/latest) diperiksa saat pembaruan. Audit dependency runtime melaporkan nol advisori; ini hasil audit saat diperiksa, bukan jaminan tidak ada kerentanan baru.

Dokumentasi/aset/SQL asli, migration historis dan receipt cloud tetap dipertahankan. Referensi rilis lama dapat menyebut target serta batas pada saat itu; [arsip README lama](history/source-through-0.12.md) dipisahkan dari petunjuk operasional sekarang. Tidak ada fixture cloud baru dibuat untuk perubahan ini.
