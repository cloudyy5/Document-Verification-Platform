# DESIGN_SYSTEM.md

## Document Verification Platform

**Versi:** 0.1\
**Status:** Draft design system --- arah visual dan token awal
disepakati untuk prototyping\
**Arah:** Enterprise Trust × Premium Technology\
**Theme:** Light + Dark

------------------------------------------------------------------------

## 1. Design Principles

1.  **Clarity over decoration** --- informasi harus lebih menonjol
    daripada ornamen.
2.  **Trust through consistency** --- status, istilah, warna, dan
    interaksi konsisten.
3.  **Purpose-built layouts** --- komposisi mengikuti tugas pengguna.
4.  **Accessible by default** --- kontras, fokus keyboard, dan label
    jelas.
5.  **Quiet confidence** --- profesional tanpa efek visual berlebihan.
6.  **Progressive disclosure** --- detail teknis ditampilkan ketika
    dibutuhkan, tanpa menyembunyikan informasi penting.

## 2. Color System

### 2.1 Brand palette

  Token      Hex         Peran
  ---------- ----------- -------------------------
  Navy 950   `#10243B`   Brand ink / deep navy
  Navy 900   `#18324D`   Dark brand surface
  Navy 800   `#214768`   Secondary brand tone
  Blue 700   `#2F5FCB`   Primary action light
  Blue 600   `#3B6FE0`   Hover / active emphasis
  Blue 100   `#EAF0FF`   Soft brand background
  Blue 50    `#F4F7FF`   Very subtle highlight

Brand blue digunakan pada aksi utama, link penting, focus state, dan
elemen terpilih. Jangan menggunakan biru pada semua komponen.

### 2.2 Light theme semantic tokens

  Token                          Hex         Penggunaan
  ------------------------------ ----------- --------------------------
  `--color-bg`                   `#F5F7FB`   Background aplikasi
  `--color-surface`              `#FFFFFF`   Panel dan surface utama
  `--color-surface-muted`        `#F0F4F8`   Area sekunder
  `--color-surface-raised`       `#FFFFFF`   Modal/popover
  `--color-text-primary`         `#17283D`   Teks utama
  `--color-text-secondary`       `#52657B`   Teks sekunder
  `--color-text-muted`           `#5F7188`   Metadata dan hint
  `--color-border`               `#DCE4EE`   Border standar
  `--color-border-strong`        `#C5D1DF`   Border aktif/lebih tegas
  `--color-primary`              `#2F5FCB`   Tombol dan aksi utama
  `--color-primary-hover`        `#264FAF`   Hover primary
  `--color-primary-soft`         `#EAF0FF`   Selected background
  `--color-primary-foreground`   `#FFFFFF`   Teks pada tombol primary
  `--color-focus`                `#3B6FE0`   Focus ring

### 2.3 Dark theme semantic tokens

  Token                          Hex         Penggunaan
  ------------------------------ ----------- --------------------------
  `--color-bg`                   `#0D1725`   Background aplikasi
  `--color-surface`              `#121F30`   Panel dan surface utama
  `--color-surface-muted`        `#18283A`   Area sekunder
  `--color-surface-raised`       `#203349`   Modal/popover
  `--color-text-primary`         `#F0F5FB`   Teks utama
  `--color-text-secondary`       `#B9C7D7`   Teks sekunder
  `--color-text-muted`           `#8FA2B8`   Metadata dan hint
  `--color-border`               `#2A3D52`   Border standar
  `--color-border-strong`        `#40566D`   Border aktif/lebih tegas
  `--color-primary`              `#9BB4FF`   Tombol dan aksi utama
  `--color-primary-hover`        `#B5C7FF`   Hover primary
  `--color-primary-soft`         `#1C2B46`   Selected background
  `--color-primary-foreground`   `#10213A`   Teks pada tombol primary
  `--color-focus`                `#9BB4FF`   Focus ring

Dark mode bukan sekadar membalik warna light mode. Permukaan dibedakan
dengan perubahan tone, bukan shadow tebal.

### 2.4 Status colors

Status warna harus selalu disertai label teks dan, jika relevan, ikon.

  --------------------------------------------------------------------------
  Status         Light          Light          Dark           Dark
                 foreground     background     foreground     background
  -------------- -------------- -------------- -------------- --------------
  Success /      `#176B4D`      `#E8F5EE`      `#79D6AE`      `#15382F`
  Approved                                                    

  Warning /      `#8A570B`      `#FFF3DB`      `#F0C36D`      `#3C2D18`
  Pending                                                     

  Info /         `#2855B5`      `#EAF0FF`      `#A5BCFF`      `#1D2D4B`
  Revision                                                    

  Danger /       `#A73540`      `#FCEBED`      `#F19AA2`      `#43232B`
  Rejected                                                    

  Neutral /      `#526174`      `#EDF1F5`      `#B4C0CE`      `#293747`
  Revoked                                                     
  --------------------------------------------------------------------------

Pemetaan: - `pending_review` → Warning. - `revision_requested` → Info. -
`approved` → Success. - `rejected` → Danger. - `revoked` → Neutral,
dengan penjelasan status dicabut.

Status tidak boleh diwakili warna saja. Gunakan label yang eksplisit.

## 3. Typography

### 3.1 Font families

-   **UI / Headings / Body:** Geist Sans.
-   **Technical data:** Geist Mono.
-   **Fallback sans:** Inter, system-ui, sans-serif.
-   **Fallback mono:** ui-monospace, SFMono-Regular, Menlo, monospace.

Geist dipilih sebagai arah tipografi karena memiliki karakter modern,
jelas, dan cocok untuk antarmuka produk teknologi. Geist Mono digunakan
terbatas untuk kode, hash, ID, timestamp teknis, dan data sejenis.

Sebelum produksi, font harus disediakan melalui sumber yang sah atau
self-hosted sesuai lisensi font.

### 3.2 Type scale

  Style               Size   Line height   Weight Penggunaan
  ------------ ----------- ------------- -------- ------------------------------
  Display            40 px         48 px      600 Landing hero jika diperlukan
  H1                 28 px         36 px      600 Judul halaman dashboard
  H2                 22 px         30 px      600 Judul section
  H3                 18 px         26 px      600 Judul panel
  Body               14 px         22 px      400 Teks utama aplikasi
  Body large         16 px         24 px      400 Intro dan penjelasan penting
  Label              13 px         18 px      500 Form label dan navigasi
  Small              12 px         18 px      400 Metadata dan helper text
  Button             14 px         20 px      600 Teks tombol
  Mono           12--13 px         20 px      500 Hash, kode, ID

Aturan: - Dashboard tidak membutuhkan heading display besar. - Hindari
penggunaan semua huruf kapital untuk label panjang. - Gunakan tabular
numerals untuk angka tabel dan statistik. - Jangan menurunkan metadata
di bawah 12 px pada tampilan utama. - Gunakan line-height yang cukup
untuk teks berbahasa Indonesia.

## 4. Spacing and Layout

### 4.1 Spacing scale

Gunakan grid dasar 4 px.

  Token          Value
  ------------ -------
  `space-1`       4 px
  `space-2`       8 px
  `space-3`      12 px
  `space-4`      16 px
  `space-5`      20 px
  `space-6`      24 px
  `space-8`      32 px
  `space-10`     40 px
  `space-12`     48 px
  `space-16`     64 px

### 4.2 App shell

Desktop: - Sidebar expanded: 248 px. - Sidebar collapsed: 72 px. -
Topbar: 64 px. - Main content padding: 32 px. - Max content width: 1440
px. - Main content harus tetap fleksibel untuk review workspace.

Tablet: - Sidebar dapat menjadi compact/collapsible. - Main padding: 24
px.

Mobile: - Sidebar menjadi drawer atau bottom navigation sesuai
pengujian. - Main padding: 16 px. - Form dan panel menjadi satu kolom.

### 4.3 Layout khusus

**Admin Review Detail** - Desktop: preview PDF sekitar 65--70% lebar
area kerja; review panel 30--35%. - Panel review dapat memiliki sticky
behavior hanya jika tidak mengganggu scroll dan aksesibilitas. - Mobile:
ringkasan, preview, metadata, checklist, lalu keputusan secara vertikal.

**User Upload Form** - Form satu kolom. - Lebar form ideal 640--760 px
pada desktop. - Area dropzone cukup besar dan tetap menyediakan tombol
pilih file. - Metadata opsional dikelompokkan setelah field wajib.

**Verification Result** - Status utama berada di bagian atas. - Detail
kode/hash ditampilkan dalam blok monospace yang dapat disalin. - Hasil
multiple matches menggunakan daftar terstruktur, bukan satu paragraf
panjang.

## 5. Shape, Border, and Elevation

### Radius

-   Small: 6 px --- badge kecil dan elemen kompak.
-   Medium: 8 px --- input dan tombol.
-   Large: 12 px --- panel dan modal.
-   XL: 16 px --- area khusus seperti preview container.
-   Pill: 999 px --- chip tertentu saja.

Jangan menerapkan radius besar pada semua elemen.

### Border

-   Default: 1 px solid `--color-border`.
-   Strong: 1 px solid `--color-border-strong`.
-   Gunakan border untuk membedakan struktur.
-   Hindari border pada setiap elemen anak jika grouping sudah jelas.

### Shadow

-   Default card: tanpa shadow atau shadow sangat halus.
-   Dropdown/popover: shadow kecil.
-   Modal: shadow sedang.
-   Jangan menggunakan glow atau shadow berwarna.

## 6. Component Guidelines

### Buttons

Variants: - Primary: satu aksi utama per konteks. - Secondary: aksi
alternatif. - Ghost: aksi ringan seperti Cancel atau Back. -
Destructive: reject, revoke, atau tindakan berisiko.

Ukuran: - Default height: 40 px. - Compact: 32 px. - Mobile touch
target: minimum 44 px.

Aturan: - Label berupa kata kerja yang jelas. - Jangan menampilkan dua
tombol primary yang bersaing. - Destructive action memerlukan
konfirmasi.

### Inputs

-   Default height: 44 px.
-   Label selalu terlihat; jangan hanya mengandalkan placeholder.
-   Helper text dan error ditempatkan dekat input.
-   Focus ring terlihat jelas.
-   Disabled dan read-only memiliki tampilan berbeda.
-   Field wajib dan opsional dibedakan secara eksplisit.

### Tables

-   Header ringkas dan kontras cukup.
-   Row height target: 56--64 px.
-   Hindari garis vertikal berlebihan.
-   Status ditampilkan dengan chip dan label.
-   Aksi utama konsisten pada kolom paling kanan.
-   Mobile menggunakan card/list layout jika tabel tidak muat.

### Status badges

-   Menggunakan semantic status color.
-   Selalu memiliki teks status.
-   Jangan mengandalkan warna saja.
-   Ukuran kompak dan tidak mendominasi tabel.

### Cards and panels

-   Gunakan panel jika ada kelompok informasi yang memang perlu
    dipisahkan.
-   Jangan membungkus setiap paragraf atau field dengan card.
-   Dashboard tidak harus menggunakan kumpulan kartu statistik.

### Modals and confirmation

-   Approve, Reject, dan Request Revision memerlukan dialog konfirmasi
    sesuai risiko.
-   Reject dan Request Revision wajib memiliki textarea alasan/catatan.
-   Dialog menjelaskan konsekuensi tindakan.

### PDF Viewer

-   Menjadi fokus visual Review Detail.
-   Toolbar berisi page navigation, zoom, dan fit controls yang relevan.
-   Preview harus bersumber dari private endpoint yang terotorisasi.
-   Tampilkan loading, failed, dan retry states.
-   Jangan membuat preview terlihat seperti dokumen dekoratif;
    keterbacaan isi adalah prioritas.

### Review Checklist

-   Empat aspek ditampilkan dengan label lengkap:
    1.  Kelengkapan.
    2.  Keterbacaan.
    3.  Kesesuaian kategori.
    4.  Kelayakan pendaftaran.
-   Setiap aspek memiliki pilihan Pass / Fail.
-   Approve tidak aktif sampai seluruh aspek wajib Pass.
-   Request Revision dan Reject memerlukan catatan.

### Verification Result

-   Tampilkan status yang jelas.
-   Kode dan hash memakai Geist Mono.
-   Sediakan tombol copy dengan feedback.
-   Jelaskan bahwa hash cocok berarti byte file identik, bukan jaminan
    keaslian atau legalitas.
-   Jika multiple matches, tampilkan seluruh hasil yang cocok.

## 7. Iconography

-   Gunakan satu keluarga ikon konsisten, direkomendasikan Lucide.
-   Ukuran umum: 16, 18, dan 20 px.
-   Stroke konsisten sekitar 1.75--2 px.
-   Hindari ikon berwarna dekoratif pada semua menu.
-   Ikon navigasi harus disertai label pada desktop expanded.
-   Jangan gunakan emoji sebagai ikon antarmuka produksi.

## 8. Theme Behavior

-   Mendukung Light, Dark, dan System preference.
-   Default awal: mengikuti preferensi sistem perangkat.
-   Pengguna dapat mengganti tema melalui menu akun/settings.
-   Pilihan tema harus konsisten di User Workspace dan Admin Workspace.
-   Theme switch tidak boleh mengubah layout atau status.
-   Semua semantic tokens harus memiliki pasangan light dan dark.
-   Pastikan chart/preview overlay dan status badges tetap terbaca pada
    kedua tema.

## 9. Motion and Interaction

-   Micro-interaction: 120--180 ms.
-   Panel/modal: 160--220 ms.
-   Easing: ease-out yang halus.
-   Hindari animasi dekoratif berulang.
-   Loading menggunakan skeleton atau progress yang relevan.
-   Hormati `prefers-reduced-motion`.
-   Jangan menggunakan animasi sebagai satu-satunya penanda status.

## 10. Accessibility

-   Kontras teks mengikuti WCAG AA sebagai target minimum.
-   Focus keyboard terlihat.
-   Form memiliki label yang benar.
-   Error dikaitkan dengan field.
-   Status memiliki label tekstual.
-   Touch target mobile minimal 44 × 44 px.
-   Modal memiliki focus management.
-   Jangan menyampaikan informasi hanya melalui warna.

## 11. Do / Don't

### Do

-   Gunakan whitespace dan hierarki.
-   Buat halaman mengikuti satu tugas utama.
-   Jaga konsistensi komponen.
-   Gunakan semantic tokens.
-   Tampilkan status dan feedback secara eksplisit.
-   Uji Light dan Dark mode secara terpisah.

### Don't

-   Jangan gunakan gradient besar sebagai latar dashboard.
-   Jangan gunakan glassmorphism sebagai gaya default.
-   Jangan menambahkan grafik tanpa kebutuhan.
-   Jangan menampilkan semua elemen sebagai card.
-   Jangan memakai banyak warna aksen.
-   Jangan membuat sidebar terlalu dominan.
-   Jangan memakai dummy data seolah data produksi.
-   Jangan mengubah status warna tanpa memperbarui token semantik.

## 12. Implementation Notes for Codex

-   Gunakan token dari `DESIGN_TOKENS.css`; jangan hardcode warna
    komponen.
-   Gunakan semantic names, bukan nama warna mentah, pada komponen.
-   Implementasikan theme melalui attribute/class yang konsisten.
-   Komponen reusable harus memiliki variants yang terdokumentasi.
-   Jangan membuat style baru untuk satu halaman jika komponen/tokens
    yang ada sudah mencukupi.
-   Jika desain membutuhkan token baru, tambahkan ke design system
    terlebih dahulu.
-   Jangan meniru langsung referensi produk.
-   Uji setiap halaman pada light, dark, desktop, tablet, dan mobile.

## 13. Keputusan yang Masih Terbuka

-   Nama produk dan logo final.
-   Apakah warna aksen biru final atau perlu satu putaran eksplorasi
    visual.
-   Font final setelah uji render dan lisensi.
-   Bentuk navigasi mobile setelah wireframe.
-   Design untuk landing page publik jika masuk MVP.

**Catatan:** Token ini adalah baseline untuk prototype. Sebelum
produksi, kontras perlu diuji dengan alat accessibility dan diuji pada
implementasi nyata.
