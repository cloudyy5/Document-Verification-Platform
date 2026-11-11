# Rencana penerimaan cloud R3b — posisi QR dan bukti web

Tanggal **10 November 2026**, Asia/Makassar. **Pengguna menyetujui fixture ini dengan jawaban “Ya, jalankan uji sintetis R3b”. Eksekusi, browser dan rekonsiliasi telah lulus, exit code 0**, run `c0ce4cd9-9a2f-4fbc-a59a-20d080319a25`. [Hasil cloud R3b](qr-placement-cloud-report.md) mencatat posisi, PDF hasil, privasi dan cleanup. Migration 011 telah melewati [47 preflight API](qr-placement-activation-check.md). Persetujuan R3b ini terpisah dari izin uji R3 sebelumnya.

## Fixture yang disetujui dan dipertahankan

- **Tiga akun sintetis terkonfirmasi**: A sebagai pemilik, B sebagai penerima, C pengguna pembanding. Tidak memakai email/data pribadi nyata dan tidak mengirim email.
- **Satu PDF baru, dua halaman, 1.544 byte**: [signing-r3b-development.pdf](../../tests/fixtures/signing-r3b-development.pdf), berlabel `UJI DEVELOPMENT R3b` dan tanpa data pribadi. SHA-256 `e3fdf4680cd01b4291822accdcc28f4461f5540bdcd35f82f655fd2fe2313d06`.
- **Satu draft/versi, satu undangan A → B, satu keputusan approve, satu receipt, satu manifest penempatan dan satu PDF hasil privat**. Hasil harus tetap dua halaman, dengan posisi QR berbeda pada tiap halaman dan tanpa halaman bukti tambahan.
- **A dan B serta dokumen/riwayat/manifest/PDF sumber dan hasil tetap tersimpan**, karena kontrak immutable. C hanya dibersihkan setelah identity marker, semua relasi dan prefix Storage terbukti kosong; hilangnya Auth/role/profile/kode C diperiksa setelah penghapusan. Fixture lama tidak diubah.

Tidak membuat pengajuan reject tambahan: fitur penolakan sudah dicakup R3; revisi ini berfokus pada manifest, interaksi, hasil dan privasi. Input invalid serta retry berbeda diuji pada request yang sama tanpa menciptakan keputusan baru. Tidak memberi role admin, mereset password lama atau menonaktifkan trigger.

## Kelompok pemeriksaan

| Bagian                 | Hasil yang diwajibkan                                                                                                                                                                                                                      |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Sesi dan upload        | Login tiga akun normal terverifikasi; A mengunggah PDF lewat UI, memilih kode B dan mengirim undangan. Hash sumber cocok; B/C tidak membaca draft sebelum undangan; receipt/QR belum terbit                                                |
| Validasi dan scope     | Guest 401; A/C tidak dapat memutuskan; actor/policy/consent palsu, versi/hash tidak cocok dan Origin eksternal ditolak; posisi QR yang melampaui halaman ditolak sebelum keputusan                                                         |
| Editor dan approve     | Pada permintaan B, Setujui masih disabled sebelum semua posisi diatur. B menggunakan preview PDF nyata, drag dan keyboard di kedua halaman, lalu konfirmasi dengan checkbox kosong pada awalnya. Tidak ada password/OTP ulang              |
| Manifest dan retry     | Manifest yang dibaca B cocok dengan posisi UI, geometri sumber dan layout baru. Exact retry mengembalikan receipt yang sama; perubahan posisi ditolak 409. Update manifest melalui Data API user ditolak; C tidak membaca manifest         |
| Hasil dan scan         | Dua halaman hasil, jumlah halaman tetap; QR pada kedua halaman didekode dari byte PDF hasil cloud dengan PDF.js/jsQR independen dan pusatnya sesuai posisi. Keduanya menunjuk halaman bukti web privat yang sama                           |
| Privasi dan integritas | A/B dapat membaca bukti dan byte hasil; hash/ukuran sesuai, sumber tetap sama, download/range benar. Guest/C ditolak pada API dan halaman bukti; Storage langsung source/result dan URL public ditolak                                     |
| Tampilan               | Screenshot editor dan bukti sintetis; desktop Light serta mobile Dark tanpa overflow. Screenshot/trace/video otomatis dinonaktifkan, header email dimask saat screenshot eksplisit                                                         |
| Rekonsiliasi           | Service memeriksa hanya ID/prefix run ini: tepat satu dokumen/versi/request/keputusan/receipt/manifest, sumber dan hasil tunggal serta hash byte benar. Simpan proof sebelum cleanup C. Tidak ada rewrite hasil atau auto-upload pengganti |

Lulus penerimaan memerlukan seluruh kelompok, exit code browser 0 dan rekonsiliasi akhir. Jika suatu hasil tidak pasti atau tes terputus, simpan proof serta peserta untuk rekonsiliasi; jangan mengulang fixture atau menghapus proof demi melewati guard. Masa undangan, akses privat dan consent development yang sudah disetujui tidak diubah.

## Runner yang disiapkan

- `scripts/test-signing-r3b-cloud.mjs`, `tests/e2e/signing-r3b-cloud.spec.ts`, dan `playwright.signing-r3b-cloud.config.ts` memakai namespace `signing-r3b` dan schema proof **4**, tanpa mengubah runner/proof R1/R2/R3.
- Lock eksklusif serta pointer/per-run proof berada pada `test-results/cloud-signing-r3b.lock`, `cloud-signing-r3b-run.json` dan `cloud-signing-r3b-<UUID>.json`. Guard berjalan sebelum network. Riwayat sukses/parsial atau lock lain menghalangi pengulangan; pointer hilang tidak mengabaikan orphan proof.
- Auth ID/email/marker direncanakan dan dipersistenkan sebelum create API. Password dan sesi hanya sementara di memori/environment proses uji; tidak disimpan pada proof atau log. Secret Supabase hanya pada runner/server; browser process menerima environment OS yang disaring.
- Satu worker dan nol retry; suite ini dikecualikan dari Playwright biasa. Runner memeriksa schema/bucket sebelum membuat akun. Tidak ada resume generik atau cleanup dokumen immutable.
- Lima tes guard subprocess lulus dengan network stub dan **nol request**; check-only offline lulus tanpa fixture/akun cloud. Typecheck, lint dan discovery suite lulus. Ini bukan hasil browser cloud.

```powershell
# Aman: hanya guard, konfigurasi lokal dan checksum PDF; nol jaringan
npm run test:cloud:signing:r3b -- --check-only

# Invocation historis yang sudah berhasil; jangan jalankan ulang fixture ini
npm run test:cloud:signing:r3b -- --confirm-persistent-fixture
```

R4 monitoring tidak menjadi bagian uji ini. Keberhasilan build, preflight dan uji lokal tidak digunakan sebagai klaim penerimaan cloud atau TTE tersertifikasi.

Fixture kini terminal dengan status `passed_with_persistent_fixture`. Guard menolak invocation ulang sebelum network; jangan menghapus proof untuk melewatinya. A/B, satu sumber dan satu hasil tetap tersimpan; C telah dibersihkan setelah terbukti kosong dan penghapusan Auth/role/profile/kode diverifikasi. [Laporan hasil](qr-placement-cloud-report.md) memuat bukti dan batas penerimaan ini.

Server pengujian berjalan di loopback `http://127.0.0.1:3100`; QR fixture mengarah ke origin tersebut dan hanya dapat dibuka saat server development itu berjalan pada komputer yang sama. Ini tidak memublikasikan aplikasi atau mengaktifkan akses pemindaian dari HP di jaringan lain.
