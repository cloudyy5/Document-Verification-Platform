# Aktivasi R4 — migration 012

Tanggal **11 November 2026**, Asia/Makassar, source **0.8.0**. Operator menjawab **“Sudah dijalankan dan berhasil”** untuk pemasangan migration 012 melalui SQL Editor. Pemeriksaan API dari workspace kemudian **lulus 49 pemeriksaan, exit code 0**. Tidak memasang ulang migration atau memberikan role admin secara otomatis.

```powershell
npm run supabase:check -- --workspace --signing --signing-r3 --qr-placement --operations
```

| Kelompok                                         | Jumlah | Hasil                                                                                                                                   |
| ------------------------------------------------ | ------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| Konfigurasi/Auth/role/recovery/workspace/limiter | 8      | Konfigurasi valid; Auth dan role API 200; konfirmasi email wajib; recovery acak false; counts anon 401/42501; limiter invalid 400/22023 |
| Tabel dan RPC R2                                 | 18     | Empat tabel service HEAD 200/anon 401; actor null 403/42501; limiter invalid 400/22023; seluruh EXECUTE anon ditolak                    |
| Tabel dan RPC R3                                 | 16     | Tiga tabel service HEAD 200/anon 401; actor null 403/42501; limiter invalid 400/22023; seluruh EXECUTE anon ditolak                     |
| Bucket hasil                                     | 1      | `signing-results` privat, maksimum 20 MiB, MIME hanya `application/pdf`                                                                 |
| Manifest dan persetujuan posisi R3b              | 4      | Manifest service HEAD 200/anon 401; approval actor null 403/42501 dan EXECUTE anon 401/42501                                            |
| RPC monitoring R4                                | 2      | Service/null actor **403/42501 OPERATIONS_ACTOR_REQUIRED**; anon **401/42501 permission denied for function get_operations_snapshot**   |
| Total                                            | **49** | **Lulus**                                                                                                                               |

Probe R4 ditolak sebelum mengambil statistik global. Probe tahap sebelumnya memakai HEAD dengan limit nol atau input invalid yang ditolak sebelum mutasi menurut source. Tidak membuat akun, role, audit aplikasi, dokumen, permintaan, keputusan, posisi QR maupun object Storage. Pemeriksaan recovery memakai token dan ID acak yang tidak dikonsumsi. Key, data akun dan respons mentah tidak dicetak.

[Catatan hasil ringkas](../screenshots/r4/activation-check.json) mencantumkan fingerprint file migration lokal dan hasil probe. Fingerprint itu mengidentifikasi source yang diperiksa; bukan hasil membaca atau membandingkan definisi seluruh object di database cloud. [Pemeriksaan build](../screenshots/r4/build-check.json) tetap merupakan checkpoint sebelum operator memasang 012 dan sengaja tidak ditulis ulang.

Ketersediaan RPC dan penolakan dua jenis caller sudah terbukti. Ini belum membuktikan sesi `platform_admin`, angka agregat nyata, izin user/reviewer pada cloud atau seluruh constraint/index/trigger cloud. Pengujian SQL native serta unit dicatat pada [laporan R4](r4-report.md). Penerimaan sesi admin mengikuti [langkah uji baca-saja](r4-cloud-acceptance-plan.md); belum dinyatakan lulus. Tidak menjalankan ulang fixture terminal R1/R2/R3/R3b. R5 belum dimulai.
