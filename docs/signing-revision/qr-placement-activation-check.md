# Aktivasi R3b — migration 011

Tanggal **10 November 2026**, Asia/Makassar. Operator melaporkan migration 011 berhasil dijalankan. Pemeriksaan API dari workspace kemudian **lulus 47 pemeriksaan, exit code 0**. Tidak memasang ulang SQL atau membuat akun, dokumen, posisi QR, keputusan, receipt maupun object Storage.

```powershell
npm run supabase:check -- --workspace --signing --signing-r3 --qr-placement
```

| Kelompok                                         | Jumlah | Hasil                                                                                                                                     |
| ------------------------------------------------ | ------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Konfigurasi/Auth/role/recovery/workspace/limiter | 8      | Konfigurasi valid; Auth dan role API 200; email confirmation wajib; recovery acak false; counts anon 401/42501; limiter invalid 400/22023 |
| Tabel dan RPC R2                                 | 18     | Empat tabel service HEAD 200/anon 401; RPC actor null 403/42501; limiter invalid 400/22023; seluruh EXECUTE anon ditolak                  |
| Tabel dan RPC R3                                 | 16     | Tiga tabel service HEAD 200/anon 401; RPC actor null 403/42501; limiter invalid 400/22023; seluruh EXECUTE anon ditolak                   |
| Bucket hasil                                     | 1      | `signing-results` privat; maksimum 20 MiB; MIME hanya `application/pdf`                                                                   |
| Manifest posisi R3b                              | 2      | `signing_receipt_layouts` service HEAD **200**, anon HEAD **401**; limit=0, tidak mengambil baris                                         |
| RPC persetujuan R3b                              | 2      | `approve_signing_request_with_placement`: actor null **403/42501 SIGNING_ACTOR_REQUIRED**, anon **401/42501 permission denied**           |
| Total                                            | **47** | **Lulus**                                                                                                                                 |

Penolakan probe terjadi sebelum lock, penulisan data, audit/notifikasi maupun perubahan counter sesuai source migration. Nilai key, data akun dan respons mentah tidak dicetak. Tidak ada fixture cloud baru pada pemeriksaan ini; receipt R1/R2/R3 tetap dipertahankan.

Ini membuktikan ketersediaan object baru melalui Data API dan penolakan panggilan anonim. Status ini tidak menggantikan pemeriksaan setiap constraint/trigger pada database cloud, sesi peserta, RLS antar-peserta, commit posisi, penyimpanan hasil, decode QR cloud atau alur scan/login. SQL native dan pengujian lokal dicatat pada [laporan R3b](qr-placement-report.md).

Sesudah preflight, pengguna menyetujui [rencana penerimaan cloud R3b](qr-placement-cloud-acceptance-plan.md). Runner terpisah menyelesaikan satu skenario pada satu PDF sintetis dua halaman, exit code 0; [hasil cloud R3b](qr-placement-cloud-report.md) mencatat persetujuan, posisi terkunci, PDF/QR, isolasi dan cleanup C. Bukti itu terpisah dari 47 probe di atas. Jangan mengulang migration 011 atau runner fixture terminal. R4 monitoring belum dimulai.
