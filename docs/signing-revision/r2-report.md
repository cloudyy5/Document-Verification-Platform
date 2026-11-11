# Laporan R2 — kode akun, draft privat dan undangan

Checkpoint: **9 November 2026**, Asia/Makassar. Versi aplikasi: **0.5.0**. **Source R2 tersedia; penerimaan development Supabase cloud R2 lulus untuk undangan dan pembatalan.** Migration 009 sudah diuji pada PostgreSQL native terisolasi. Pengguna melaporkan pemasangan cloud berhasil pada 9 November 2026; [preflight API](r2-activation-check.md) lulus 26 pemeriksaan tanpa fixture baru. [Uji cloud pengirim/penerima](r2-cloud-report.md) lulus satu skenario, tujuh kelompok pemeriksaan. Kelengkapan backfill seluruh akun lama belum diperiksa melalui katalog cloud. R2 tidak menyediakan aksi menyetujui/menolak, QR, atau statistik admin baru.

## Hasil implementasi

- Kode akun stabil `DVP-` + 20 karakter hex acak, dibuat server untuk akun baru dan di-backfill untuk akun yang sudah ada. Profil menampilkan kode sendiri. Kode merupakan identifier penerima, bukan password atau bukti persetujuan.
- Draft privat model baru dengan satu versi sumber immutable. Upload memvalidasi PDF, metadata, kategori, email terverifikasi dan consent development baru; hash berasal dari byte asli. Batas maksimum 10 MiB tetap dapat diturunkan melalui environment.
- Lookup exact kode akun lain yang memenuhi syarat, dengan informasi minimum berupa ID, kode dan nama tampilan. Tidak ada direktori email/telepon atau pencarian prefix. Limiter persisten berlaku per actor dan global.
- Pemilik memilih satu penerima, mengonfirmasi consent berbagi, lalu mengirim undangan yang mengikat versi sumber. Upload dan pengiriman memerlukan idempotency key; retry identik tidak membuat resource ganda dan payload berbeda menghasilkan konflik.
- Kotak masuk/keluar serta detail menampilkan data aktual dengan loading, empty, unavailable, status dan pagination. Notifikasi yang dibuat bersifat in-app generik, tanpa pengiriman email/SMS baru.
- Penerima dapat preview/download hanya versi yang diundang selama pending aktif dan setelah consented/completed. Status rejected/cancelled/expired mencabut akses metadata sumber/PDF penerima; riwayat request minimum tetap tersedia. Server memeriksa grant lagi setelah download sebelum mengirim byte. RLS database tetap menjadi batas utama.
- Pemilik dapat membatalkan undangan pending sebelum kedaluwarsa/keputusan. Masa berlaku 168 jam dihitung dari waktu database; expiry tidak menghapus file atau riwayat. R2 hanya menghasilkan pending/cancelled; expired adalah proyeksi waktu. Status keputusan lain dicadangkan untuk R3 dan tes batas akses.
- Sidebar, ringkasan, profil serta halaman baru memakai token dan komponen yang sama: silver/white, graphite, CTA biru, Geist dan Light/Dark. Dokumen legacy diberi konteks arsip administratif; tidak dikonversi menjadi dokumen yang sudah ditandatangani.

Satu request per dokumen berlaku pada R2. Penerima, sumber dan riwayat yang sudah dikirim tidak diedit/diaktifkan ulang; permintaan baru menggunakan draft baru. Admin/reviewer yang bukan peserta tidak memperoleh PDF melalui role tersebut. Akun dengan role user sekaligus role administratif tetap memakai hak peserta normal pada resource yang menjadi relasinya.

## Keputusan yang digunakan

Pengguna menyetujui prototipe internal, satu penandatangan pengguna lain, lifecycle tujuh hari, pembatalan sebelum keputusan, akses penerima selama aktif dan setelah selesai, serta pencabutan sesudah rejected/cancelled/expired. Pengguna juga menyetujui [consent development](development-consent.md) untuk dokumen sintetis. Persetujuan penyimpanan, berbagi, dan aksi penerima dipisahkan.

Identifier consent `internal-upload-development-2026-11-05` dan `internal-sharing-development-2026-11-05` tetap dipakai sebagai versi teks; angka tanggal tersebut bukan tanggal deployment. Teks aksi `internal-action-development-2026-11-05` belum digunakan oleh endpoint aktif. Metode konfirmasi/autentikasi per aksi S-05 dan penempatan/bukti QR S-09 berada pada R3. Kebijakan produksi, retensi, scanner serta permission admin tambahan tetap mengikuti register terpisah.

## File dan struktur

| Area               | File/folder dan perubahan                                                                                                                         |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Schema             | `supabase/migrations/202611050009_signing_requests.sql`: empat tabel public, audit private, kode akun/backfill, RLS versi, RPC sempit dan limiter |
| Tipe database      | `src/types/database.ts`, dihasilkan dari schema terisolasi setelah migration                                                                      |
| Domain dan consent | `src/lib/signing/policy.ts`, `validation.ts`                                                                                                      |
| Server             | `src/server/signing/`: query scoped, DTO, mutation, error aman, konfigurasi, upload dan file                                                      |
| API                | `src/app/api/v2/`: kode akun, lookup penerima, draft, request dan pembatalan                                                                      |
| UI                 | `src/features/signing/`, `src/app/(user)/signing/`, `src/app/(user)/requests/`; penambahan kode pada profil serta navigasi/ringkasan              |
| Fondasi bersama    | `src/server/json.ts`, `src/server/documents/pdf-response.ts`, `upload-slot.ts`; penyesuaian upload/file legacy untuk memakai helper bersama       |
| Guard dan build    | `src/proxy.ts`, redirect autentikasi, `next.config.ts` untuk route privat, header file serta tracing worker PDF                                   |
| Pengujian          | `tests/database/signing.test.ts`, unit signing/JSON dan regresi dokumen/redirect, `tests/e2e/signing.spec.ts`                                     |
| Dokumentasi        | Paket `docs/signing-revision/` dan README diperbarui untuk kontrak final R2 serta langkah operator                                                |

Migration 001–008, paket spesifikasi asli, SQL asli, tokens dan tujuh gambar referensi tetap dipertahankan. Model baru tidak memperluas RLS legacy. Privileged client berada pada server; browser tidak menerima secret atau storage path.

## Teknologi

Stack tetap memakai Next.js **16.4.3** App Router, React **19.3.1**, TypeScript **6.0.3** strict, Tailwind CSS **4.3.3**, Supabase JS **2.118.0**/SSR **0.12.7**, Zod **4.6.7**, pdf-lib **1.17.1**, Vitest **4.1.12** dan Playwright **1.64.1**. Tidak ada layanan berbayar atau dependency signing baru yang diaktifkan untuk R2.

## Pengujian dan batas bukti

| Lapisan                             | Hasil checkpoint                                                                                                                                                                                 |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| PostgreSQL native migration 001–009 | **306 lulus / 8 file**; cluster sementara terisolasi, bukan project cloud                                                                                                                        |
| ESLint dan TypeScript strict        | Lulus                                                                                                                                                                                            |
| Unit                                | **648 lulus / 23 file**; kontrak provider mock ditandai, termasuk I/O dan batas HTTP R2                                                                                                          |
| Production build                    | Lulus pada build akhir source R2; tracing route upload mencakup worker PDF                                                                                                                       |
| Format seluruh source/dokumentasi   | `npm run format:check` lulus                                                                                                                                                                     |
| Bundle browser                      | 33 aset JavaScript diperiksa, 0 kecocokan dengan nilai konfigurasi privat; nilainya tidak dicetak                                                                                                |
| Browser                             | **43 lulus, 5 skip / 48 total** pada desktop/tablet/mobile; 3 smoke terautentikasi opt-in tidak dijalankan untuk menghindari akun cloud tambahan, 2 tes drawer tidak berlaku pada desktop/tablet |
| Cloud R1                            | Sudah lulus 5 November: satu skenario upload/file legacy, tanpa QR; [bukti R1](r1-report.md)                                                                                                     |
| Cloud R2                            | 009 aktif; preflight 26 lulus; uji peserta 1 skenario/7 kelompok lulus. Satu draft/versi/request cancelled; dua peserta dipertahankan, pembanding dibersihkan                                    |

Tes unit provider memakai mock yang diberi label. SQL native membuktikan grants, constraint, transaksi, idempotensi, race, scope versi dan pencabutan akses pada PostgreSQL. Browser biasa memeriksa penolakan guest; suite cloud terpisah telah membuktikan perjalanan A mengundang B dan pembatalan dengan provider/Storage nyata. Metadata Auth/Storage fixtures lokal tidak membuktikan GoTrue/PostgREST/Storage HTTP atau rendering browser cloud. Tidak ada klaim SMTP, malware scanning produksi, TTE tersertifikasi atau pengujian seluruh jenis PDF dari hasil tersebut.

Satu akun pemilik/dokumen/PDF sintetis R1 tetap tersimpan sesuai izin terdahulu. Uji R2 yang telah disetujui membuat satu fixture signing terpisah; [hasil cloud](r2-cloud-report.md) mencatat ID, rekonsiliasi dan batas buktinya. Jangan menjalankan ulang `test:cloud:workspace` atau menghapus proof untuk membuat fixture tambahan; runner lama sengaja menolak setelah receipt sukses. Pengujian cloud R2 telah mengikuti [rencana konkret](r2-cloud-acceptance-plan.md): tiga akun sintetis A/B/C, satu PDF/draft dan satu undangan yang dibatalkan. A/B serta riwayat dipertahankan dan C telah dibersihkan. Output browser biasa dipindahkan ke test-results/browser; pengulangan suite membuktikan empat receipt R1/R2 tetap byte-identik.

## Aktivasi Supabase cloud oleh operator

**Status project development saat ini: migration 009 telah dijalankan oleh pengguna dan preflight Data API lulus pada 9 November 2026. Jangan menjalankan ulang migration tersebut.** Langkah pemasangan 1–3 di bawah dipertahankan untuk riwayat/operator project baru; query baca pada langkah 4 tetap dapat dipakai memeriksa katalog dan backfill. Pemeriksaan katalog/backfill itu belum dilakukan melalui sesi postgres oleh agen. Tidak perlu upgrade Supabase Pro, mengubah template email atau memasukkan secret baru ke chat. Gunakan project development yang sama dengan `.env.local`; API key aplikasi tidak mempunyai kemampuan menjalankan DDL.

1. Buka Supabase Dashboard → project development → **SQL Editor** → **New query** (tombol `+`). Pastikan database/role yang digunakan adalah `postgres`.
2. Buka file [migration 009](../../supabase/migrations/202611050009_signing_requests.sql) di editor lokal. Salin **seluruh isi**, mulai `begin;` sampai `commit;` beserta definisi di antaranya, ke query baru. Jalankan **Run**. Migration 001–008 dan kategori sudah menjadi prasyarat; jangan menjalankan ulang migration lama atau memakai SQL initial schema sebagai penggantinya.
3. Hasil **Success. No rows returned** adalah hasil normal untuk DDL. Jika muncul error, simpan pesan error dan jangan menghapus schema, mengubah RLS menjadi allow-all atau menjalankan sebagian SQL. Script memakai transaksi. Jika sukses, jangan jalankan 009 untuk kedua kalinya: definisi ini additive dan bukan script rerun idempotent.
4. Buat query baru untuk pemeriksaan baca saja berikut. Query tidak mencetak kode akun, data PDF, token atau secret.

```sql
-- Lima baris; object_name terisi dan rls_enabled = true pada semuanya.
with expected(object_name) as (
  values
    ('public.signing_user_identifiers'),
    ('public.signing_documents'),
    ('public.signing_document_versions'),
    ('public.signing_requests'),
    ('private.signing_audit_events')
)
select e.object_name,
       to_regclass(e.object_name) is not null as object_exists,
       c.relrowsecurity is true as rls_enabled
from expected e
left join pg_class c on c.oid = to_regclass(e.object_name)
order by e.object_name;
```

```sql
-- Lima baris; function_exists, security_definer, service_execute = true;
-- anon_execute dan authenticated_execute = false pada semuanya.
with expected(signature) as (
  values
    ('public.lookup_signing_recipient(uuid,text)'),
    ('public.create_signing_draft(uuid,uuid,uuid,text,uuid,text,date,text,text,text,bigint,text,text,text,boolean)'),
    ('public.send_signing_request(uuid,uuid,uuid,text,uuid,text,boolean)'),
    ('public.cancel_signing_request(uuid,uuid)'),
    ('public.consume_signing_operation_limit(text,text,text)')
)
select e.signature,
       p.oid is not null as function_exists,
       p.prosecdef as security_definer,
       has_function_privilege('service_role', p.oid, 'EXECUTE') as service_execute,
       has_function_privilege('anon', p.oid, 'EXECUTE') as anon_execute,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_execute
from expected e
left join pg_proc p on p.oid = to_regprocedure(e.signature)
order by e.signature;
```

```sql
-- Satu baris; missing_identifiers = 0 setelah backfill seluruh akun.
select count(*) as missing_identifiers
from auth.users u
where not exists (
  select 1 from public.signing_user_identifiers i where i.user_id = u.id
);
```

5. Sesudah hasil sesuai, restart aplikasi lokal. Jika port dev lama masih berjalan, hentikan dengan `Ctrl+C` pada terminalnya, lalu jalankan:

```powershell
cd D:\Website
npm run dev
```

6. Masuk dengan akun development terverifikasi, buka **Profil → Kode akun**, lalu buka **Dokumen persetujuan**, **Permintaan masuk** dan **Permintaan terkirim**. Kode harus tampil; daftar kosong berarti query berhasil dan memang belum ada data. Error **layanan belum tersedia** berbeda dari daftar kosong dan perlu ditelusuri. Pemeriksaan baca ini belum membuat PDF atau undangan baru.

Jika SQL benar tetapi API masih melaporkan schema cache/tabel belum ditemukan, periksa project pada `.env.local` dan lakukan refresh schema cache melalui operator (`NOTIFY pgrst, 'reload schema';`), lalu tunggu sebentar dan ulangi pembacaan. Jangan mengekspose schema `private`, membuka bucket, atau mengubah grants RPC untuk mengatasi error.

Setelah pemeriksaan baca berhasil, penerimaan R2 berikutnya adalah uji sintetis A → B pada cakupan fixture yang disepakati: kode, upload draft, kirim/retry, hak tepat versi, pemisahan C/guest/Storage langsung, pembatalan, serta pencabutan akses. R3 tetap menunggu hasil R2 dan keputusan konfirmasi/QR yang relevan.

## Menjalankan dan memeriksa source lokal

Environment yang sudah dipakai Phase 2/3 tetap berlaku: `APP_URL=http://127.0.0.1:3000`, `DOCUMENT_ENVIRONMENT=development`, public Supabase URL/publishable key serta secret server-only dan `AUTH_FLOW_SECRET` yang diisi langsung pada `.env.local`. File tersebut tidak boleh di-commit atau dicetak.

```powershell
npm ci
npm run dev
```

Untuk pemeriksaan reproducible:

```powershell
npm run lint
npm run typecheck
npm test
npm run test:db
npm run build
npm run test:e2e
npm run format:check
```

Runner browser memakai production build pada port 3100. PostgreSQL native 17+ digunakan hanya untuk cluster uji terisolasi; Docker tidak diperlukan untuk runner SQL tersebut. `npm run supabase:check -- --workspace` memeriksa legacy 007/008. Tambahkan `--signing` untuk discovery dan penolakan aman R2: `npm run supabase:check -- --workspace --signing`. Hasil 26 lulus pada 9 November dicatat dalam [catatan aktivasi](r2-activation-check.md); hasil ini belum membuktikan alur peserta atau kelengkapan backfill.
