# CODEX_FIRST_PROMPT.md

## Prompt pertama untuk memulai proyek di Codex

Salin prompt berikut setelah seluruh folder
`document-verification-platform-v1.0.1` dibuka sebagai workspace Codex.

------------------------------------------------------------------------

Saya ingin membangun **Document Verification Platform**, sebuah aplikasi
web profesional untuk pengajuan, pemeriksaan administratif, pendaftaran,
dan verifikasi integritas dokumen PDF.

Sebelum menulis kode, baca seluruh dokumentasi proyek di folder ini,
terutama:

-   `PROJECT_BRIEF.md`
-   `PRODUCT_REQUIREMENTS.md`
-   `DOCUMENT_REVIEW_POLICY.md`
-   `UPLOAD_FORM_SPEC.md`
-   `TECHNICAL_ARCHITECTURE.md`
-   `DATABASE_SCHEMA.md`
-   `API_SPECIFICATION.md`
-   `SECURITY_ARCHITECTURE.md`
-   `BUSINESS_LOGIC_AND_STATE_MACHINE.md`
-   `UI_SCREEN_SPEC.md`
-   `MOBILE_LAYOUT_SPEC.md`
-   `DESIGN_SYSTEM.md`
-   `DESIGN_TOKENS.css`
-   `DECISION_REGISTER.md`
-   `IMPLEMENTATION_ROADMAP.md`
-   `CODEX_MASTER_PROMPT.md`

**Jangan langsung membuat seluruh website sekaligus.**

Mulai dengan pekerjaan berikut:

1.  Periksa isi workspace dan apakah sudah ada source code.
2.  Jika belum ada, siapkan Next.js App Router dengan TypeScript.
3.  Gunakan Tailwind CSS dan implementasikan `DESIGN_TOKENS.css`.
4.  Buat fondasi Light Mode, Dark Mode, dan System Mode.
5.  Buat struktur User Workspace dan Admin Workspace sesuai sitemap.
6.  Buat komponen dasar yang reusable: sidebar, header, button, status
    badge, input, table, modal, toast, dan responsive navigation.
7.  Siapkan integrasi Supabase dengan pemisahan client browser, server,
    dan privileged server-only client.
8.  Validasi environment variables menggunakan schema.
9.  Siapkan ESLint, typecheck, unit test, dan build scripts.
10. Jalankan seluruh pemeriksaan dan laporkan hasilnya.

Ketentuan yang tidak boleh dilanggar:

-   Pengguna hanya dapat melihat dan memverifikasi dokumen milik akunnya
    sendiri.
-   Dokumen PDF disimpan pada private storage.
-   QR dan kode unik baru diterbitkan setelah approval.
-   Hash SHA-256 dihitung di server.
-   Hash matching hanya mencari dokumen approved milik pengguna yang
    sedang login.
-   Admin reviewer memeriksa empat aspek: kelengkapan, keterbacaan,
    kesesuaian kategori, dan kelayakan pendaftaran.
-   Semua keputusan review harus tercatat dan tidak boleh ditimpa
    diam-diam.
-   Jangan menambahkan field nomor dokumen ke formulir pengajuan.
-   Tanggal dokumen, instansi penerbit, dan deskripsi bersifat opsional.
-   Kategori bukan whitelist tertutup.
-   Jangan membuat verifikasi publik atau lintas akun.
-   Jangan menampilkan angka statistik palsu sebagai data produksi.
-   Jangan menampilkan tombol privileged yang belum disetujui sebagai
    fitur aktif.

Untuk desain, gunakan silver/white workspace, graphite sidebar, dan
primary CTA biru dengan kontras jelas. Hindari tampilan dashboard
generik yang terlalu banyak kartu, gradient dekoratif, dan komponen yang
tidak memiliki fungsi.

Ikuti `IMPLEMENTATION_ROADMAP.md` fase demi fase. Pada tahap pertama,
kerjakan **Phase 0 --- Repository and Technical Foundation** saja.
Jangan lanjut ke Phase 1 sebelum melaporkan hasil Phase 0.

Di akhir pekerjaan, laporkan: - file/folder yang dibuat; - teknologi dan
versi yang digunakan; - environment variables yang diperlukan; -
perintah yang dijalankan; - hasil lint, typecheck, test, dan build; -
masalah yang ditemukan; - keputusan produk yang masih menunggu
persetujuan.

Jangan pernah meminta saya mengirim secret key atau password ke
percakapan. Berikan instruksi untuk menyimpannya pada environment lokal
atau dashboard provider.
