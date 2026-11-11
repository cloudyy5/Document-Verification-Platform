# Pemeriksaan aktivasi R3 — migration 010

Tanggal: **10 November 2026**, Asia/Makassar. Pengguna melaporkan migration 010 selesai dengan hasil sukses. Pemeriksaan melalui API Supabase kemudian **lulus 43 pemeriksaan** pada percobaan ini, exit code 0. Tidak memasang ulang migration atau membuat akun, dokumen, keputusan, receipt maupun object Storage.

```powershell
npm run supabase:check -- --workspace --signing --signing-r3
```

## Hasil

| Kelompok                                                  | Jumlah | Hasil                                                                                                                                                                                                                                                               |
| --------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Konfigurasi/Auth/role/recovery/workspace/limiter baseline | 8      | Koneksi valid; Auth dan role API 200; email confirmation wajib. Counts anon 401/42501; input limiter invalid 400/22023. Recovery token acak menghasilkan false.                                                                                                     |
| Tabel R2                                                  | 8      | Empat tabel: service HEAD 200, anon HEAD 401; tidak mengambil baris akun/dokumen.                                                                                                                                                                                   |
| RPC R2                                                    | 10     | Empat RPC actor null ditolak 403/42501; limiter invalid 400/22023. Kelimanya menolak EXECUTE anon 401/42501.                                                                                                                                                        |
| Tabel R3                                                  | 6      | `signing_decisions`, `signing_receipts`, `signing_artifacts`: service HEAD 200 dan anon HEAD 401.                                                                                                                                                                   |
| RPC R3                                                    | 10     | `decide_signing_request`, `claim_signing_render`, `complete_signing_render`, `fail_signing_render`: actor null ditolak 403/42501 `SIGNING_ACTOR_REQUIRED`. Limiter R3 invalid ditolak 400/22023. Kelimanya menolak EXECUTE anon 401/42501 dengan permission denied. |
| Bucket hasil                                              | 1      | GET metadata 200; `signing-results` mempunyai `public=false`, batas **20971520 byte/20 MiB**, MIME hanya `application/pdf`.                                                                                                                                         |
| Total                                                     | **43** | **Lulus**                                                                                                                                                                                                                                                           |

Probe actor null dan limiter invalid sudah diperiksa pada source migration: penolakan terjadi sebelum lock, audit, notifikasi, cleanup atau penulisan counter. Service HEAD memakai limit=0; tidak membaca isi dokumen atau data akun. Nilai key dan response mentah provider tidak dicetak.

## Batas bukti dan langkah berikutnya

Hasil ini membuktikan ketersediaan schema/RPC melalui Data API, batas panggilan anonim dan konfigurasi bucket. Belum membuktikan approve/reject dari sesi peserta, RLS peserta, byte hasil, QR cloud, UI receipt terautentikasi atau pengiriman email.

[Rencana penerimaan R3](r3-cloud-acceptance-plan.md) memerlukan persetujuan fixture baru: tiga akun sintetis dan dua dokumen sumber, dengan satu approve dan satu reject. Runner khusus `scripts/test-signing-r3-cloud.mjs` serta suite `tests/e2e/signing-r3-cloud.spec.ts` kemudian dijalankan sesuai persetujuan; [hasil cloud R3](r3-cloud-report.md) lulus setelah interupsi tes dan kelanjutan pada fixture yang sama. Check-only offline lulus tanpa jaringan. Delapan tes subprocess memeriksa opt-in, lock, proof sukses, orphan proof parsial dan check-only; semua memakai network stub dan nol request.

Tidak menjalankan ulang runner R1/R2 atau memakai kembali request cancelled. R4 monitoring belum dikerjakan. Keberhasilan aktivasi bukan pernyataan R3 cloud selesai atau siap produksi.
