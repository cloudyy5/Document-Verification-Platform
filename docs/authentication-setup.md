# Setup autentikasi — Phase 2

Source Phase 2 menyediakan registrasi, login, logout, email confirmation, pemulihan password, refresh sesi, dan proteksi workspace. Integrasi Supabase sesungguhnya memerlukan konfigurasi development di bawah. Tampilan formulir tanpa konfigurasi bukan bukti backend sudah terhubung.

## 1. Environment lokal

Pada workspace ini `.env.local` sudah disiapkan oleh `npm run auth:setup` dengan `AUTH_FLOW_SECRET` acak khusus server, tanpa mencetak nilainya. Perintah itu tidak menimpa file yang sudah ada. Untuk checkout baru, jalankan:

```powershell
npm ci
npm run auth:setup
```

Isi ketiga nilai Supabase melalui editor lokal:

| Variabel                               | Isi dan pemakaian                                                                                       |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`             | URL project Supabase development                                                                        |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Publishable key; legacy anon diterima untuk kompatibilitas                                              |
| `SUPABASE_SECRET_KEY`                  | Secret key server-only; legacy service_role diterima                                                    |
| `APP_URL`                              | Origin aplikasi yang persis sama dengan alamat yang dibuka pengguna, contoh `http://127.0.0.1:3000`     |
| `AUTH_FLOW_SECRET`                     | Secret server minimal 32 karakter untuk HMAC rate limit dan proof pemulihan; dibuat otomatis oleh setup |

`APP_URL` adalah origin saja: scheme, host, dan port, tanpa path, query, atau fragment. `http://localhost:3000` berbeda dari `http://127.0.0.1:3000`. Gunakan satu alamat canonical dan buka alamat itu di browser. HTTP hanya diterima untuk loopback lokal; lingkungan terbit menggunakan HTTPS. Server Action memeriksa Origin terhadap nilai ini.

Secret key diperlukan karena counter rate limit dan grant pemulihan disimpan melalui RPC server-only. Jangan menambahkan awalan `NEXT_PUBLIC_` pada secret, mengirim nilainya ke chat, atau melakukan commit `.env.local`. Secret tidak boleh berada pada argumen perintah, screenshot, atau log. Mengganti `AUTH_FLOW_SECRET` membatalkan proof pemulihan yang masih tersimpan di cookie.

Restart development server setelah mengubah environment. Untuk production build, ubah environment lalu build ulang karena nilai `NEXT_PUBLIC_*` dimasukkan saat build. Keberadaan env hanya meloloskan validasi format; tidak membuktikan project, key, email provider, atau migration sudah benar.

### Memeriksa koneksi tanpa membuat akun

Jalankan dari root proyek:

```powershell
npm run supabase:check
```

Perintah memuat `.env.local` dan menampilkan status ringkas tanpa key atau data akun. Pemeriksaan mencakup format koneksi, respons Auth API, provider Email/signup, kewajiban Confirm email, akses database ke tabel role menggunakan HEAD tanpa mengambil baris, dan RPC baca saja dari migration 006 dengan parameter acak. Tidak ada akun, email, counter, atau recovery grant yang dibuat/diubah.

Semua baris `LULUS` membuktikan endpoint/key dan objek database yang diperiksa dapat digunakan. Hasil itu belum membuktikan SMTP, template email, seluruh migration/RLS, atau sesi browser. `PERIKSA` menandai bagian gagal; `401/403` perlu pemeriksaan key/izin, `404` dapat berarti objek/migration belum tersedia, dan `NETWORK_ERROR` dapat berasal dari jaringan/timeout. Jangan mengganti RLS/grants hanya untuk meloloskan pemeriksaan.

Untuk menguji alur aplikasi, buka `/register`, daftar dengan email milik Anda, ikuti confirmation, lalu login. Setelah login, `/api/v1/me` pada browser yang sama harus menghasilkan HTTP 200 dengan identitas/role akun sendiri. Sebelum login, HTTP 401 pada endpoint itu adalah perilaku yang benar. Terakhir uji logout dan pemulihan password; status formulir yang generik bukan bukti email terkirim.

Pada **4 November 2026**, pemeriksaan baca saja terhadap konfigurasi lokal berhasil: Auth API HTTP 200, database/tabel role HTTP 200, RPC keamanan Phase 2 HTTP 200 dengan hasil false yang diharapkan untuk token acak; provider Email/signup serta Confirm email aktif. Tidak ada akun atau email dibuat pada pemeriksaan tersebut.

## 2. Database development

Gunakan project development yang terpisah dari production. Terapkan seluruh migration sesuai urutan, lalu seed:

1. `supabase/migrations/202611010001_initial_schema.sql`
2. `supabase/migrations/202611010002_workflow_rpcs.sql`
3. `supabase/migrations/202611010003_access_control_foundation.sql`
4. `supabase/migrations/202611010004_owner_approved_configuration.sql`
5. `supabase/migrations/202611010005_future_object_privileges.sql`
6. `supabase/migrations/202611030006_authentication_security.sql`
7. `supabase/migrations/202611040007_owner_workspace_queries.sql`
8. `supabase/migrations/202611040008_document_upload_limiter.sql`
9. `supabase/seed.sql`

Migration 006 menyediakan counter auth persisten, grant pemulihan sekali pakai yang terikat user/sesi, dan gate email terverifikasi sebelum submission. Dua tabel auth berada pada schema private dengan RLS dan tanpa hak baca/tulis langsung bagi anon, authenticated, maupun service_role. RPC yang diperlukan hanya dapat dipanggil service_role melalui kode server.

Jika migration 001–005 sudah diterapkan pada project development yang sama, jangan menjalankannya ulang; lanjutkan dengan 006, kemudian 007 dan 008 untuk User Workspace. Jika 001–006 sudah tersedia, jalankan hanya 007 lalu 008. Setup baru menerapkan seluruh urutan. Jangan menjalankan ulang migration atau memakai reset database untuk memperbarui project yang sudah berisi data.

Migration 007 menyediakan pembacaan/counts User Workspace khusus owner; 008 menyediakan limiter upload server-only. Hasil Auth/RPC Phase 2 yang sukses tidak membuktikan kehadiran kedua migration tersebut. Setup, pemeriksaan katalog dan helper browser development dijelaskan pada [panduan User Workspace Phase 3](user-workspace-setup.md); hasil implementasi serta keterbatasan integrasi tercatat pada [laporan Phase 3](phase-3-report.md).

Untuk Supabase cloud development, jalankan migration melalui alur migration terkelola proyek atau SQL development yang Anda kendalikan; periksa target project sebelum mengeksekusi. Untuk project development yang sudah berisi data, tinjau constraint dan backup terlebih dahulu. Jangan menjalankan `tests/database/bootstrap.sql` pada Supabase: file tersebut hanya fixture metadata untuk cluster tes native kosong.

`supabase/config.toml` menyalakan signup/email confirmation lokal untuk Phase 2 dan PostgreSQL 17. Stack Supabase lokal lengkap memerlukan Docker/container runtime kompatibel. Pengujian native `npm run test:db` tidak menghidupkan GoTrue, PostgREST, SMTP, atau Storage HTTP.

## 3. Pengaturan Auth provider

Pada project Supabase development:

- Aktifkan provider Email dan signup email.
- Aktifkan **Confirm email**. Registrasi aplikasi memeriksa provider settings dan menolak bekerja bila auto-confirm email masih aktif atau signup provider dinonaktifkan.
- Set **Site URL** sama persis dengan `APP_URL`.
- Tambahkan redirect URL canonical aplikasi, khususnya `APP_URL/auth/callback` dan `APP_URL/auth/confirm`. Gunakan URL lengkap yang sesuai environment; jangan menambahkan wildcard domain umum.
- Siapkan pengiriman email development yang benar. Untuk email nyata, pilih/configure provider SMTP sesuai kebijakan proyek. Pengiriman pesan belum dibuktikan hanya dengan menampilkan status formulir.

Kebijakan R-04 telah disetujui: email wajib diverifikasi sebelum pengajuan dokumen. Gate diterapkan di helper server dan trigger database. Metadata registrasi hanya menyimpan nama lengkap; tidak ada pilihan reviewer/admin pada formulir. Role normal dibuat oleh trigger, sedangkan privileged role melalui prosedur operator tepercaya yang sudah tersedia.

## 4. Template email wajib untuk alur confirmation/recovery

Gunakan template token hash yang menuju endpoint internal `/auth/confirm`. Endpoint itu memanggil verifikasi provider untuk jenis token yang diminta; mengubah `type` pada URL saja tidak memberikan izin pemulihan.

File siap salin tersedia di `supabase/templates/confirmation.html` dan `supabase/templates/recovery.html`. Konfigurasi lokal menunjuk langsung ke file itu. Pada cloud, salin isi masing-masing ke template Auth yang sesuai melalui dashboard project development.

**Confirm sign up**, contoh isi template:

```html
<h2>Konfirmasi alamat email Anda</h2>
<p>
  <a
    href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&amp;type=signup"
  >
    Konfirmasi email
  </a>
</p>
```

**Reset password**, contoh isi template:

```html
<h2>Pulihkan akses akun Anda</h2>
<p>
  <a
    href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&amp;type=recovery"
  >
    Buat kata sandi baru
  </a>
</p>
```

`SiteURL` harus menunjuk origin aplikasi, sedangkan `TokenHash` berasal dari provider. Jangan memasukkan raw password, service key, atau token lain ke template. Dukungan variabel tersebut dijelaskan pada [dokumentasi template Supabase](https://supabase.com/docs/guides/auth/auth-email-templates).

Confirmation signup yang valid mengakhiri sesi callback lokal dan mengarahkan pengguna ke halaman masuk; tautan tidak diam-diam mempertahankan login ke akun lain. Recovery yang valid menerbitkan proof khusus, lalu menuju `/reset-password`. Token invalid/kedaluwarsa hanya menghasilkan pesan generik. Endpoint callback/confirm memakai redirect canonical, `private, no-store`, dan `no-referrer`; query token tidak diteruskan ke halaman akhir.

`/auth/callback` mendukung pertukaran PKCE untuk confirmation, tetapi **menolak PKCE recovery**. Informasi redirectType dari penyimpanan browser bukan bukti recovery yang dapat dipercaya. Karena itu gunakan template reset password `token_hash` di atas, bukan hanya default ConfirmationURL/PKCE. OAuth dan login magic-link tidak termasuk implementasi Phase 2 ini.

## 5. Sesi dan pembatasan akses

`src/proxy.ts` menyegarkan cookie pada request dan response. Halaman/layout privat tetap memverifikasi ulang identitas melalui `getUser()` di server dan membaca role dari tabel `user_roles` dengan client sesi pengguna. Metadata role dari browser atau hasil `getSession()` tidak dipakai sebagai bukti identitas/permission.

Halaman `/dashboard`, `/documents`, `/submit`, `/verify`, `/profile`, dan `/admin` memerlukan autentikasi. Review Queue/History memerlukan role reviewer. Admin tanpa reviewer hanya memiliki akses area admin yang diizinkan, bukan antrean atau preview dokumen. Parameter `next` dibatasi ke path privat internal yang tidak ambigu dan tidak dapat memberikan role atau melewati guard halaman.

**Pembaruan S-15/source 0.8.1:** cukup gunakan `/login` biasa. Setelah autentikasi email/password, role database menentukan tujuan: `platform_admin` ke `/admin/overview`, user ke `/dashboard`. Akun admin hanya menggunakan Admin Workspace walaupun masih mempunyai role `user`; hint lama ke User Workspace diabaikan, URL halaman pengguna diarahkan ke overview dan API aplikasi pengguna menolak dengan 403. Profil/tema akun sendiri tetap tersedia melalui `/profile` dengan shell admin. [Laporan workspace admin](signing-revision/admin-workspace-report.md) memuat implementasi dan pengujian; tidak ada migration baru.

Cookie sesi standar Supabase SSR **tidak diklaim seluruhnya HttpOnly**; client SSR/browser menggunakan cookie untuk sesi, sesuai [panduan Supabase SSR](https://supabase.com/docs/guides/auth/server-side/creating-a-client). Token yang dibaca browser tetap bukan pengganti verifikasi server.

Cookie proof pemulihan khusus `dvp-password-recovery` memakai HttpOnly, SameSite=Lax, Secure pada origin HTTPS, dan masa berlaku 10 menit. Proof ditandatangani, berisi nonce acak, serta terikat user dan JWT session ID yang diverifikasi. Nonce disimpan sebagai digest pada grant database. Server memeriksa proof dan grant yang belum dipakai sebelum reset; grant dikonsumsi sekali sebelum update password. Jika update gagal setelah konsumsi, pengguna meminta tautan baru.

Setelah reset berhasil, server meminta sign-out global dan membersihkan cookie auth lokal. Logout biasa memakai sign-out sesi lokal dan membersihkan cookie project ini. Request berisi cookie atau data auth tidak boleh dicache bersama antar pengguna. Jangan menyimpan PDF, password, atau recovery token dalam localStorage aplikasi.

Cleanup logout tetap dilakukan bila provider tidak dapat dijangkau atau konfigurasi secret auth rusak, selama Origin canonical valid dan URL project masih diketahui. Cleanup lokal tidak menjamin pencabutan sesi jarak jauh saat provider gagal. JWT akses yang sudah terbit mengikuti masa berlakunya; sign-out global meminta pencabutan refresh session sesuai kemampuan provider.

## 6. Rate limit persisten

Counter SQL atomik tersimpan pada database, bukan Map proses atau localStorage. Key merupakan HMAC dengan flow secret; raw email/password/IP tidak disimpan pada counter. Limit per identitas dan global dipakai bersama sehingga pergantian identitas tidak menghindari batas seluruh aplikasi.

Login/registrasi/pemulihan/kirim ulang memakai email yang dinormalisasi sebagai identitas limiter; reset memakai ID pengguna yang telah diverifikasi.

| Operasi                | Per identitas | Global aplikasi | Window   |
| ---------------------- | ------------- | --------------- | -------- |
| Login                  | 10            | 200             | 15 menit |
| Registrasi             | 5             | 100             | 1 jam    |
| Pemulihan              | 3             | 50              | 15 menit |
| Kirim ulang verifikasi | 3             | 50              | 15 menit |
| Simpan password baru   | 5             | 100             | 15 menit |

Ini adalah default keamanan teknis pada migration 006. Jika RPC atau database limiter tidak tersedia, operasi autentikasi gagal tertutup dengan pesan layanan tidak tersedia. Rate limit bawaan Supabase/provider tetap berlaku secara terpisah.

Counter global diperiksa lebih dahulu untuk membatasi penambahan baris identitas acak. Konsekuensinya, permintaan ke identitas yang sudah dibatasi tetap dapat menghabiskan kuota global; kuota ini adalah backstop resource aplikasi, bukan jaminan ketahanan terhadap seluruh serangan denial of service. Deployment perlu pembatasan abuse di edge/provider yang sesuai trafik. Respons generik formulir menyamarkan status akun dan hasil pengiriman email; konfigurasi endpoint Auth publik milik provider memiliki batasan tersendiri dan harus ditinjau pada project development.

## 7. Pengujian dan batas klaim

Pemeriksaan lokal:

```powershell
npm run lint
npm run typecheck
npm test
npm run test:db
npm run build
npm run test:e2e
```

Unit test memeriksa validation/redirect/session/proof; SQL test menguji grants, rate limit, recovery grant, dan email gate pada PostgreSQL native. E2E tanpa konfigurasi memeriksa formulir nonaktif, penolakan akses privat, tema, serta komponen publik. Hasil itu tidak sama dengan registrasi/login/email delivery pada Supabase nyata.

Suite integrasi nyata bersifat opt-in dan memerlukan environment **khusus development** berikut:

| Variabel                             | Isi                                                        |
| ------------------------------------ | ---------------------------------------------------------- |
| `SUPABASE_AUTH_TEST_ENABLED`         | `1` untuk mengaktifkan suite                               |
| `SUPABASE_AUTH_TEST_CONFIRM`         | `development-project` sebagai konfirmasi target terisolasi |
| `SUPABASE_AUTH_TEST_URL`             | URL project development khusus tes                         |
| `SUPABASE_AUTH_TEST_PUBLISHABLE_KEY` | Publishable/anon key project tersebut                      |
| `SUPABASE_AUTH_TEST_SECRET_KEY`      | Secret/service key server-only project tersebut            |

Vitest tidak otomatis memuat `.env.local` Next.js untuk suite ini. Isi variabel koneksi integrasi langsung pada environment proses lokal yang aman, bukan di source, argumen command, atau chat. Kemudian jalankan:

```powershell
npm run test:integration
```

Tanpa opt-in, kelima tes dilewati dengan jelas. Dengan opt-in, suite membuat dua akun sintetis yang emailnya dikonfirmasi melalui Admin API, lalu membersihkannya. Ia menguji: identitas dan role normal meski metadata mencoba menaikkan role; isolasi profile/role melalui Data API; kesetaraan error login salah/tidak dikenal; token recovery nyata sekali pakai beserta pergantian password; dan sign-out global yang menolak refresh. GenerateLink/createUser pada suite ini tidak mengirim email, dan tidak ada dokumen nyata dibuat.

Suite tersebut memverifikasi GoTrue/PostgREST provider, tetapi bukan bukti pengiriman SMTP atau seluruh perjalanan browser melalui Server Action dan cookie aplikasi. Uji penerimaan signup, link email, reset, serta logout dari browser development tetap diperlukan setelah konfigurasi provider/template selesai. Jangan melaporkan kelima integrasi sebagai lulus bila masih dilewati.
