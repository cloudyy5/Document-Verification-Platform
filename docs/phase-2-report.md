# Laporan Phase 2 — Authentication

Tanggal **3 November 2026**, Asia/Makassar. Versi aplikasi **0.3.0**. Implementasi source dan pemeriksaan lokal Phase 2 selesai. **Integrasi Supabase cloud dan pengiriman email nyata belum terverifikasi**; konfigurasi koneksi masih kosong. Phase 3 belum dimulai dan tidak ada deployment.

## 1. File dan folder

| Lokasi baru                                                               | Isi                                                                                                                                                    |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/app/(auth)/`                                                         | Layout/form `/login`, `/register`, `/forgot-password`, `/reset-password`, `/verify-email`, serta Server Actions                                        |
| `src/app/auth/confirm/route.ts`                                           | Verifikasi typed token hash signup/recovery melalui provider                                                                                           |
| `src/app/auth/callback/route.ts`                                          | Pertukaran confirmation PKCE; tidak menerbitkan recovery proof                                                                                         |
| `src/app/access-denied/page.tsx`, `src/app/error.tsx`                     | Pesan akses/layanan generik tanpa payload upstream                                                                                                     |
| `src/app/api/v1/me/route.ts`                                              | Identitas/role akun sendiri; 401 tanpa sesi, 503 saat layanan gagal                                                                                    |
| `src/components/auth/`                                                    | Auth layout, page, form, notice, dan password visibility control                                                                                       |
| `src/lib/auth/`                                                           | `config`, `cookies`, `origin`, `page-context`, `proof`, `provider-policy`, `rate-limit`, `recovery`, `redirects`, `session`, `types`, dan `validation` |
| `src/proxy.ts`                                                            | SSR refresh cookie, proteksi tamu halaman/API, dan cache headers                                                                                       |
| `supabase/migrations/202611030006_authentication_security.sql`            | Rate limit persisten, recovery grant sekali pakai, gate verified email                                                                                 |
| `supabase/templates/`                                                     | HTML confirmation/recovery dengan tujuan internal typed token hash                                                                                     |
| `scripts/setup-auth.mjs`                                                  | Pembuatan `.env.local` dan flow secret secara lokal tanpa menimpa file                                                                                 |
| `tests/unit/auth-*.test.ts`                                               | Unit validation/origin/redirect/config/session/cookies/proof/recovery/actions/callbacks                                                                |
| `tests/database/auth-security.test.ts`                                    | Keamanan auth pada PostgreSQL nyata terisolasi                                                                                                         |
| `tests/e2e/auth.spec.ts`                                                  | Baseline form, guest guards, tema, callback HEAD, dan API guest                                                                                        |
| `tests/integration/supabase-auth.test.ts`, `vitest.integration.config.ts` | Lima tes provider nyata dengan opt-in development eksplisit                                                                                            |
| `docs/authentication-setup.md`, `docs/screenshots/phase-2/`               | Setup cloud, batas keamanan, dan bukti visual                                                                                                          |

`/foundation` dipindahkan dari group privat ke `src/app/(public)/foundation/page.tsx`. Semua page/layout User dan Admin, root redirect, header/sidebar/workspace shell, client server Supabase, database types, fixture valid email, source boundary test, E2E foundation, `.env.example`, `supabase/config.toml`, package metadata/scripts, Next logging/headers, CI, README, dan decision notes diperbarui.

`.env.local` lokal sudah dibuat dan diabaikan Git. Hanya `APP_URL` dan `AUTH_FLOW_SECRET` yang siap; tiga field Supabase belum diisi. **41 file asli**, tujuh gambar desain, SQL 001/002, dan design tokens dipertahankan byte-identik serta diperiksa unit test.

## 2. Teknologi dan versi

Tidak ada dependency aplikasi baru pada Phase 2.

| Teknologi                 | Versi            |
| ------------------------- | ---------------- |
| Next.js App Router        | 16.4.3           |
| React / React DOM         | 19.3.1           |
| TypeScript strict         | 6.0.3            |
| Tailwind CSS              | 4.3.3            |
| Supabase JS / SSR         | 2.118.0 / 0.12.7 |
| Zod / next-themes         | 4.6.7 / 0.4.6    |
| Vitest / Playwright       | 4.1.12 / 1.64.1  |
| ESLint / Prettier         | 10.14.0 / 3.9.10 |
| PostgreSQL pengujian / pg | 17.9 / 8.23.1    |
| Supabase CLI              | 2.122.0          |

Pemeriksaan lokal memakai Node **25.9.0**, npm **11.12.1**. Node **24 LTS** tetap direkomendasikan. CI Node 24 sudah disiapkan; remote CI belum dijalankan.

## 3. Hasil implementasi

- Registrasi nama/email/password tanpa pilihan role. Hanya metadata nama dikirim; role normal dibuat trigger database. Provider email auto-confirm ditolak sebelum registrasi.
- Login email/password dengan validasi server, pesan generik, rate limit SQL, fresh user verification, dan role redirect berdasarkan tabel `user_roles` yang dibaca melalui sesi pengguna.
- Confirmation signup yang valid kembali ke login setelah cleanup sesi callback. Token salah/kedaluwarsa menampilkan pesan generik.
- Recovery hanya memperoleh izin setelah `verifyOtp` tipe recovery berhasil. Token hash biasa dan `pkce_` diteruskan utuh ke provider; flag URL/SDK sendiri tidak memberikan izin.
- Proof recovery HMAC memakai nonce acak, binding user/session, cookie HttpOnly/SameSite=Lax/Secure untuk HTTPS, TTL 10 menit, dan grant database sekali pakai. Konsumsi dilakukan sebelum update password; kegagalan setelah konsumsi memerlukan tautan baru.
- Logout memeriksa canonical Origin, mencoba sign-out lokal provider, dan membersihkan cookie project meski provider/factory atau secret auth gagal. Reset meminta sign-out global dan membersihkan cookie lokal. Revokasi remote saat provider gagal tidak diklaim berhasil.
- Proxy menyegarkan cookie request/response. Semua private page/layout tetap memiliki guard server; `/submit` memerlukan email verified, queue/history memerlukan reviewer. Workspace privat dipaksa dinamis, tanpa shared private HTML cache.
- `/api/v1/me` hanya mengembalikan DTO akun sendiri, tanpa token sesi atau data orang lain. Admin tanpa reviewer tidak memperoleh akses antrean.
- R-04 ditegakkan juga oleh trigger SQL pada initial submission dan resubmission; metadata/JWT spoofed verified tidak dapat menggantikannya.
- Limiter memakai counter SQL atomik per identitas dan global, HMAC key, serta kegagalan tertutup bila RPC tidak tersedia. Tabel private auth tidak dapat dibaca/ditulis langsung oleh anon, authenticated, atau service_role; RPC auth service-only.
- Origin canonical, tujuan redirect internal, penonaktifan log argumen Server Function, dan penyembunyian query callback dari log Next dev disiapkan. Callback memakai no-store/no-referrer; HEAD tidak mengonsumsi token.
- Silver/white, graphite, CTA biru, Geist, responsive layout, serta light/dark/system mode tetap berlaku. Tanpa env, formulir nonaktif dengan penjelasan layanan belum dikonfigurasi.

Tidak ada upload, query/statistik dokumen, keputusan review UI, QR, kode unik, atau verifikasi publik yang diaktifkan.

## 4. Menjalankan aplikasi

```powershell
cd D:\Website
npm ci
npm run auth:setup
npm run dev
```

Buka **http://127.0.0.1:3000/login** atau **/foundation** untuk komponen. `auth:setup` tidak menimpa `.env.local` yang sudah tersedia. Production lokal: `npm run build`, lalu `npm run start`.

Port 3000 sudah dilayani development server yang ada. Pemeriksaan HTTP akhir `/login` menghasilkan **200**, menampilkan halaman login Phase 2 dan pemberitahuan konfigurasi Supabase yang belum lengkap.

## 5. Hasil pemeriksaan

| Pemeriksaan                | Hasil                                                                    |
| -------------------------- | ------------------------------------------------------------------------ |
| `npm run lint`             | Lulus, tanpa warning ESLint                                              |
| `npm run typecheck`        | Lulus                                                                    |
| `npm test`                 | **252 lulus**, 11 file                                                   |
| `npm run test:db`          | **234 lulus**, 5 file; cluster terisolasi dihentikan/dihapus             |
| `npm run db:types`         | Enam migration + seed diterapkan pada cluster baru; tipe diperbarui      |
| `npm run build`            | Lulus; halaman privat dynamic, showcase public static                    |
| `npm run test:e2e`         | **31 lulus, 2 dilewati**, Chromium desktop 1440/tablet 768/mobile 390 px |
| `npm run test:integration` | **5 dilewati**, opt-in/koneksi cloud belum tersedia                      |
| `npm run format:check`     | Lulus                                                                    |
| `npm audit --omit=dev`     | **0 vulnerability runtime**                                              |
| Preservasi sumber asli     | 41 checksum + salinan SQL/tokens lulus                                   |

Dua skip browser adalah skenario drawer mobile pada viewport desktop/tablet; skenario yang sama lulus pada mobile. E2E memeriksa formulir nonaktif, password visibility dengan keyboard, guest redirect, penolakan cookie/role palsu, tujuan eksternal, guest API 401, HEAD 405, tema/reload, modal/focus/notification, dan tidak ada overflow horizontal.

Unit session/actions/callback menggunakan provider mock yang ditandai jelas. Tes SQL menjalankan PostgreSQL asli dengan fixture metadata Auth/Storage, **bukan GoTrue/PostgREST/SMTP/Storage HTTP**. Kelima tes integrasi bukan tes lulus dan bukan bukti email terkirim. Uji penerimaan browser terhadap cloud masih perlu dilakukan setelah setup.

Screenshot diperiksa pada desktop dan mobile; artefak pilihan disimpan di `docs/screenshots/phase-2/`. Report lengkap browser berada pada `playwright-report/index.html`; output ini diabaikan Git.

## 6. Masalah dan batas yang ditemukan

Tiga field koneksi Supabase masih kosong. Docker tidak tersedia untuk stack lokal lengkap; pengguna memilih cloud development. Tidak ada migration yang diterapkan ke database cloud dan tidak ada email nyata dikirim dalam pekerjaan ini.

Review memperbaiki perbedaan respons SMTP yang dapat membocorkan status akun, callback origin yang dapat dipengaruhi request Host, penolakan token berawalan `pkce_`, logout yang terlalu bergantung pada secret lain, dan validasi URL malformed. Pemeriksaan browser awal menemukan selector label wajib dan asumsi class tema pada tes yang tidak sesuai aplikasi; tes diperbaiki ke label berjangkar serta `data-theme`, kemudian seluruh suite browser lulus.

Cookie sesi standar Supabase SSR tetap browser-compatible; laporan ini **tidak mengklaim seluruh cookie sesi HttpOnly**. Hanya proof recovery tambahan memakai HttpOnly. Password change meminta pencabutan refresh sesi global; access JWT yang sudah terbit mengikuti masa berlakunya. Batas global limiter dan provider/edge abuse control dijelaskan pada panduan setup.

Audit seluruh dependency saat sinkronisasi lockfile masih mencatat **12 moderate pada toolchain development**; audit runtime terpisah menghasilkan nol. Tidak ada upgrade mayor toolchain pada fase autentikasi ini.

## 7. Konfigurasi pengguna berikutnya

1. Isi `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, dan `SUPABASE_SECRET_KEY` langsung di `.env.local`. Pertahankan secret server di file lokal.
2. Pastikan `APP_URL` sama persis dengan origin browser. Restart server atau build ulang setelah perubahan env.
3. Terapkan migration pada project development: jika 001–005 sudah ada, lanjutkan **006**; setup baru memakai 001–006 lalu seed. Jangan menjalankan fixture tes atau reset database yang berisi data.
4. Aktifkan Email provider/signup dan **Confirm email**, set Site URL dan dua redirect canonical, lalu pasang template confirmation/recovery dari `supabase/templates/`.
5. Siapkan provider email development. Uji signup → email confirmation → login → akses sesuai role → logout, serta forgot password → link sekali pakai → reset → login password baru.
6. Untuk lima tes provider otomatis, isi environment opt-in khusus project development terisolasi sesuai [authentication-setup.md](authentication-setup.md), lalu `npm run test:integration`. Suite membuat dan membersihkan akun sintetis, tanpa dokumen nyata.

**Phase 3 tetap menunggu pemeriksaan/persetujuan pengguna.**
