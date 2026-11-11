# Phase 0 — Penambahan token desain

Sumber utama tetap `DESIGN_TOKENS.css` di paket asli. Salinan `src/styles/design-tokens.css` dipertahankan byte-identik. File tambahan aplikasi `src/app/globals.css` menyediakan mapping Tailwind v4 dan token berikut untuk memenuhi identitas graphite/sidebar yang telah ditentukan:

| Token                    | Light                 | Dark               | Fungsi                      |
| ------------------------ | --------------------- | ------------------ | --------------------------- |
| `--color-sidebar`        | `#292e35`             | `#181d24`          | Permukaan graphite navigasi |
| `--color-sidebar-text`   | `#f5f6f8`             | `#f0f5fb`          | Label utama sidebar         |
| `--color-sidebar-muted`  | `#b8c0cb`             | `#a9b7c8`          | Label sekunder sidebar      |
| `--color-sidebar-hover`  | `#353c45`             | `#252d38`          | Hover navigasi              |
| `--color-sidebar-active` | `#454d58`             | `#303b49`          | Halaman aktif               |
| `--color-sidebar-border` | `#454c56`             | `#303b49`          | Pemisah sidebar             |
| `--color-overlay`        | `rgb(13 23 37 / 55%)` | `rgb(0 0 0 / 65%)` | Backdrop modal/drawer       |

Warna silver/white konten, primary blue, status, spacing, radius, dan motion tetap mengikuti sumber asli. Alias Tailwind `background`, `foreground`, `muted-foreground`, `subtle`, `*-soft` mengacu pada token semantik yang sudah ada. `muted` digunakan untuk permukaan, `subtle` untuk metadata.

Font disediakan lokal melalui paket `geist` yang berlisensi OFL dan dihubungkan ke token font. Sidebar desktop 248 px, tablet 72 px, header desktop 64 px/mobile 56 px; drawer mobile menggunakan focus trap Radix. Target kontrol sentuh minimal 44 px. Preferensi reduced motion dipertahankan dari stylesheet sumber.
