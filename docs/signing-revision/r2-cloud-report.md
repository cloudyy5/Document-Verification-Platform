# Hasil uji cloud R2

Tanggal: **9 November 2026**, Asia/Makassar. Versi aplikasi **0.5.0**. Pengguna menyetujui tiga akun sintetis, satu PDF dan retensi dua peserta beserta riwayatnya melalui jawaban **“Ya, jalankan uji sintetis R2”**. **Uji cloud R2 lulus: satu skenario, tujuh kelompok pemeriksaan.**

Runner menyelesaikan skenario browser dalam 45,0 detik; Playwright melaporkan **1 passed (48,8 detik)** tanpa retry. Rekonsiliasi server dan cleanup selesai dengan exit code 0. Run ID: `917e8c29-a2bd-4f07-b20a-6dd5885141e9`.

## Bukti aktual

| Kelompok      | Hasil                                                                                                                                                                                                                                                                                 |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Akun dan kode | Tiga akun sintetis normal dengan email terkonfirmasi berhasil login melalui UI; kode akun sendiri tampil dan kode A/B berbeda. Daftar model baru awal kosong.                                                                                                                         |
| Draft privat  | Upload UI dengan consent baru menghasilkan satu draft/versi. Retry dengan key/payload sama mengembalikan receipt sama; judul berbeda dengan key sama ditolak 409. B/C tidak dapat membaca sumber sebelum diundang.                                                                    |
| Undangan      | Lookup kode sendiri ditolak; lookup tepat B memberi identitas minimum. Pemilihan B dan checkbox sharing mendahului pengiriman. Retry mempertahankan satu request; expiresAt − sentAt tepat 168 jam.                                                                                   |
| Hak penerima  | B menemukan undangan masuk dan membaca versi sumber yang tepat. Query Data API user B hanya memberi versi yang diundang. Download, attachment dan Range 206 mempertahankan byte/hash fixture.                                                                                         |
| Isolasi       | C mendapat 404 pada metadata/request/file; guest mendapat 401. Query REST C tidak memperoleh versi/request tersebut. SDK Storage B/C dan URL publik tidak memberi PDF. RPC mutasi langsung oleh B/C ditolak dengan pesan permission denied.                                           |
| Preview       | Tautan UI membuka native PDF viewer pada Chromium penuh. Viewer extension terlihat; tidak ada bearer URL yang diterbitkan.                                                                                                                                                            |
| Pembatalan    | Pemilik membatalkan lewat konfirmasi UI. Retry pembatalan mengembalikan receipt yang sama. B tetap melihat riwayat cancelled tetapi metadata sumber menjadi null, link preview hilang, file/detail sumber mendapat 404 dan query versi kosong. A tetap membaca byte sumber yang sama. |

Fixture adalah `tests/fixtures/phase-3-development.pdf`, **2.831 byte**, sintetis tanpa data pribadi. SHA-256 byte sumber dan hasil download: `6cc3a629004962b6b8df8755a1ca56c5e41cdee0dc991ea3af44617a79e8c0cc`. Tidak ada persetujuan penerima, penolakan, QR atau perubahan role administratif yang dibuat.

## Rekonsiliasi dan data yang ditinggalkan

| Resource     | ID sintetis / hasil                                                                                                 |
| ------------ | ------------------------------------------------------------------------------------------------------------------- |
| Pemilik A    | `73abbfd0-8cc1-45be-87bf-6a3301afce24`, dipertahankan                                                               |
| Penerima B   | `cd0bbc3e-4010-4436-8691-8669540fcc36`, dipertahankan                                                               |
| Pembanding C | `85f8199c-7281-4768-b7e9-49797691cc6b`, berhasil dibersihkan setelah identitas dan ketiadaan referensi diverifikasi |
| Dokumen      | `8edf5e18-0a53-83fd-9231-16a025dbe83d`, satu draft                                                                  |
| Versi sumber | `ad14b9d6-712f-86bd-804b-cc4de178cda8`, satu versi/PDF privat                                                       |
| Permintaan   | `02d5ba7a-bbe5-8790-adba-e0b347e897d0`, satu record berstatus `cancelled`                                           |

Query rekonsiliasi A menemukan satu dokumen, satu versi, satu request dan satu prefix Storage; pemeriksaan object spesifik memastikan satu file dengan path/ukuran/hash yang sesuai. B tidak memiliki dokumen/versi/object dan mempunyai satu relasi request. C tidak memiliki dokumen, versi, request, object atau relasi legacy sebelum penghapusan akun. A/B beserta riwayat dan notifikasi terkait dipertahankan sesuai persetujuan. Record audit private tidak dibuka melalui Data API untuk membaca isi audit.

Record operator lokal: `test-results/cloud-signing-run.json` dan `test-results/cloud-signing-917e8c29-a2bd-4f07-b20a-6dd5885141e9.json`. Tidak ada password, token, secret atau isi PDF di record. Tracing, video dan screenshot cloud dimatikan. Password sintetis tidak disimpan untuk penggunaan akun setelah tes.

## Perlindungan bukti dan pengulangan

Pemeriksaan pascates menemukan output default Playwright berada pada direktori induk `test-results`, sehingga tes biasa dapat membersihkan receipt operator. Config tes biasa sekarang memakai `test-results/browser`; config cloud masing-masing memakai subdirektori terpisah. Tes browser biasa diulang: **43 lulus, 5 skip**, dan hash keempat receipt R1/R2 tetap identik sebelum/sesudahnya.

Receipt R1 lokal yang hilang akibat konfigurasi lama dipulihkan berdasarkan laporan R1 dan rekonsiliasi cloud baca saja yang dibatasi ID fixture lama. Owner/document/submission legacy, status pending_review, hash/ukuran sumber serta nol verification_credentials tetap cocok. Tidak ada data cloud R1 yang diubah dan runner R1 tidak dijalankan ulang untuk membuat fixture.

Smoke pengulangan kedua runner menggunakan fetch yang diblokir: receipt sukses R1 dan R2 masing-masing ditolak dengan **0 panggilan network**. Jangan menghapus receipt/lock atau menjalankan ulang runner untuk menambah fixture tanpa cakupan baru.

## Batas penerimaan

Hasil ini menutup cakupan development R2: kode akun, draft, satu undangan, hak pending dan pembatalan. Tidak ada penantian tujuh hari atau manipulasi waktu cloud untuk memaksa expiry; expiry, status keputusan reserved dan race sudah diuji pada PostgreSQL lokal. Pemeriksaan seluruh backfill akun lama melalui katalog postgres belum dilakukan; tes cloud membuktikan provisioning kode untuk tiga akun baru yang dibuat.

Pengujian ini memakai satu PDF kecil dan desktop Chromium. Responsive/tema serta batas file/parser mempunyai lapisan tes lokal terpisah. Hasil ini tidak membuktikan SMTP, produksi publik, retensi/scanner, keputusan penerima, artefak QR, atau monitoring R4. R3 tetap memerlukan keputusan autentikasi per aksi dan penempatan QR sebelum implementasi fitur terkait.
