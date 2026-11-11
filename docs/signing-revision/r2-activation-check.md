# Pemeriksaan aktivasi Supabase R2

Checkpoint: **9 November 2026**, Asia/Makassar. Pengguna melaporkan migration `202611050009_signing_requests.sql` sudah diaktifkan pada project Supabase development. Pemeriksaan Data API berikutnya lulus **26 pemeriksaan** setelah satu gangguan jaringan sementara dan retry. Migration tidak dijalankan ulang oleh agen.

```powershell
npm run supabase:check -- --workspace --signing
```

Perintah memakai konfigurasi lokal yang sudah ada dan tidak mencetak nilai key, data akun, kode pengguna, atau isi PDF. Pemeriksaan ini tidak membuat akun, draft, undangan, notifikasi, file Storage atau counter limiter. Request POST di bawah sengaja memakai input yang ditolak sebelum penulisan.

## Bukti yang diperoleh

| Pemeriksaan                        | Hasil aktual dan batasnya                                                                                                                                                                   |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Konfigurasi dan Auth               | Format konfigurasi valid; Auth settings, tabel role dan RPC recovery merespons 200. Provider email dan signup aktif; Confirm email wajib.                                                   |
| Fondasi workspace 007/008          | RPC counts menolak anon dengan 401/42501; limiter upload menolak input invalid dengan 400/22023 sebelum counter berubah.                                                                    |
| Empat tabel signing                | Service-key HEAD dengan `limit=0` merespons 200; HEAD anon merespons 401. Nama tabel/kolom tersedia pada Data API tanpa mengambil isi baris.                                                |
| Lookup, create draft, send, cancel | Seluruh parameter RPC dikirim dengan actor null. Service-key memperoleh 403/42501 dan pesan `SIGNING_ACTOR_REQUIRED`; validasi actor adalah pernyataan pertama, sebelum lock dan penulisan. |
| Limiter operasi signing            | Input action/digest invalid ditolak dengan 400/22023 dan pesan `INVALID_SIGNING_INPUT`, sebelum lock, cleanup atau perubahan counter.                                                       |
| Larangan EXECUTE anon              | Kelima RPC merespons 401/42501 dengan pesan `permission denied for function ...`. Pesan dibedakan dari penolakan actor di dalam fungsi; kode 42501 saja tidak membuktikan pembatasan grant. |

Empat tabel yang diperiksa adalah `signing_user_identifiers`, `signing_documents`, `signing_document_versions` dan `signing_requests`. Lima RPC adalah `lookup_signing_recipient`, `create_signing_draft`, `send_signing_request`, `cancel_signing_request` dan `consume_signing_operation_limit`. Schema private tidak dibuka melalui Data API.

## Yang belum dibuktikan

HEAD service-key melewati RLS dan tidak membuktikan akses peserta. Preflight ini sendiri tidak membuktikan login/undangan/file atau seluruh backfill. Pengujian cloud peserta berikutnya telah lulus pada [laporan cloud R2](r2-cloud-report.md), termasuk kode, upload, hak versi, isolasi dan pembatalan. Kelengkapan seluruh backfill akun lama tetap belum diperiksa melalui katalog cloud. Query katalog/backfill baca saja tersedia pada [laporan R2](r2-report.md); hasil query tersebut belum dicatat sebagai bukti cloud.

Tes lokal sebelumnya tetap tercatat sebagai lapisan terpisah: 306 tes PostgreSQL native, 648 unit, dan browser 43 lulus/5 skip. Keberhasilan preflight ini tidak mengubahnya menjadi hasil UAT cloud R2 lengkap. Pengiriman SMTP, aksi keputusan penerima dan QR juga belum dibuktikan oleh perintah ini.

## Uji peserta sesudah preflight

Uji mengikuti [rencana cloud R2](r2-cloud-acceptance-plan.md): tiga akun A/B/C, satu PDF/draft dan satu undangan yang kemudian dibatalkan. Cakupan fixture disetujui secara eksplisit sebelum dijalankan. Satu skenario/tujuh kelompok lulus dan data akhir telah direkonsiliasi. A/B serta riwayat immutable dipertahankan, sedangkan C telah dibersihkan. Persetujuan ini berlaku pada satu fixture yang telah dicatat.

Satu fixture legacy R1 tetap dipertahankan sesuai persetujuan terdahulu dan tidak diubah menjadi dokumen signing. Runner lama tidak dijalankan ulang. R3 tetap mengikuti penutupan penerimaan R2 dan keputusan konfirmasi per aksi/QR yang relevan.
