# LOCAL_SETUP_CHECKLIST.md

## Persiapan sebelum membuka proyek di Codex

### 1. Perangkat lunak

-   [ ] Install Node.js LTS yang didukung versi Next.js yang dipilih.
-   [ ] Install Git.
-   [ ] Install Visual Studio Code atau editor pilihan.
-   [ ] Install Codex dan pastikan dapat membuka folder proyek.
-   [ ] Install Supabase CLI.
-   [ ] Siapkan akun GitHub.
-   [ ] Siapkan akun Supabase.
-   [ ] Siapkan akun Vercel untuk deployment nanti.

### 2. Folder proyek

-   [ ] Ekstrak `document-verification-platform-preparation-v1.0.1.zip`.
-   [ ] Buka folder hasil ekstraksi sebagai workspace Codex.
-   [ ] Jangan letakkan `.env.local` di Git.
-   [ ] Pastikan folder `design-assets/` tetap ada.
-   [ ] Pastikan folder `supabase/migrations/` tetap ada.

### 3. Supabase

-   [ ] Buat project development.
-   [ ] Salin Project URL ke `.env.local`.
-   [ ] Salin publishable key ke `.env.local`.
-   [ ] Simpan secret key hanya pada environment server.
-   [ ] Jalankan migration di project lokal/development terlebih dahulu.
-   [ ] Pastikan bucket `document-submissions` berstatus private.
-   [ ] Buat akun reviewer/admin melalui prosedur operator yang aman
    setelah aplikasi siap.

### 4. Environment variables

Salin `.env.example` menjadi `.env.local`, lalu isi nilainya secara
lokal.

Jangan: - mengirim secret key ke chat; - menaruh secret key pada
variabel `NEXT_PUBLIC_*`; - melakukan commit `.env.local`; - menaruh
verification secret di source code.

### 5. Sebelum staging/production

-   [ ] Setujui keputusan di `DECISION_REGISTER.md`.
-   [ ] Pilih domain dan nama produk.
-   [ ] Tentukan batas ukuran file.
-   [ ] Tentukan kebijakan PDF terenkripsi.
-   [ ] Pilih malware scanning provider.
-   [ ] Selesaikan privacy policy, acceptable-use policy, dan retention
    policy.
-   [ ] Aktifkan MFA administrator.
-   [ ] Jalankan seluruh RLS dan security tests.
-   [ ] Uji backup dan restore.

### 6. Urutan mulai

1.  Buka folder proyek di Codex.
2.  Buka `CODEX_FIRST_PROMPT.md`.
3.  Salin prompt pertama ke Codex.
4.  Minta Codex mengerjakan Phase 0 saja.
5.  Review hasil sebelum meminta Phase 1.
