# Kontrak teknis revisi — persetujuan dokumen internal

Disusun 4 November 2026; checkpoint **10 November 2026**. R2 dan R3 format awal tersedia dan lulus penerimaan cloud development. R3b/S-14 tersedia pada source; [kontrak posisi QR](qr-placement-contract.md) dan [laporan R3b](qr-placement-report.md) menjelaskan migration 011 yang telah dilaporkan aktif dan lulus 47 preflight API; [penerimaan peserta cloud format baru](qr-placement-cloud-report.md) telah lulus. Source R4 kini tersedia sesuai S-11; migration 012 dilaporkan berhasil dipasang dan preflight 49 lulus. Penerimaan sesi admin cloud masih menunggu. Pengguna telah memilih **prototipe persetujuan internal** dan **satu pengguna lain sebagai penandatangan setiap dokumen pada V1**. Multi-penandatangan, urutan paralel/berurutan, integrasi sertifikat, serta klaim TTE tersertifikasi berada di luar V1.

Dokumen ini melengkapi [kebutuhan produk](product-requirements.md) dan [alur/sitemap](workflows-and-sitemap.md). Paket spesifikasi asli dipertahankan. Migration 009/010 menyediakan undangan, keputusan, receipt dan artefak privat; migration additive 011 menambah manifest posisi immutable serta finalisasi PDF dengan jumlah halaman sumber. [Hasil cloud R3](r3-cloud-report.md) membuktikan format awal; bukti lokal R3b tidak menggantikan penerimaan cloud format baru.

## 1. Batas baseline dan revisi

| Area          | Baseline yang sedang tersedia                                           | Kontrak revisi V1                                                                                                     |
| ------------- | ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Model dokumen | `documents` / `document_submissions` dengan status review administratif | Model signing terpisah; status review lama tidak dipakai untuk menyatakan persetujuan pengguna                        |
| Pembaca PDF   | Endpoint file memeriksa owner dan submission miliknya                   | Owner dan penerima yang secara eksplisit diberi akses pada versi tertentu; perlu kontrak otorisasi baru sebelum aktif |
| Persetujuan   | RPC review dan credential lama mensyaratkan persetujuan reviewer        | Keputusan penerima undangan, tanpa reviewer dalam jalur persetujuan                                                   |
| QR            | Engine credential lama belum diaktifkan                                 | Opaque receipt terkait satu persetujuan, satu versi sumber, dan satu penandatangan                                    |
| Admin         | Role tidak otomatis memberi akses seluruh isi dokumen                   | Agregat operasional dan metadata minimum; tidak otomatis memperoleh isi PDF atau hak menandatangani                   |

`approved` pada `public.document_status` berarti lulus pemeriksaan administratif dalam model lama. Nilai itu tidak boleh diganti nama atau dimigrasikan otomatis menjadi `signed` atau `completed`. Riwayat review, submission, audit dan seluruh dokumen lama tetap mempunyai arti aslinya.

Implementasi yang dapat digunakan kembali: Supabase Auth dan sesi cookie, pemeriksaan Origin, validasi environment, client privileged server-only, batas body/PDF, parser, private streaming, SHA-256 byte asli, pola idempotensi, komponen dan token visual. DAL owner-only dan view `workspace_documents` tetap berlaku untuk model lama; keduanya tidak diperluas menjadi direktori semua dokumen.

## 2. Sifat bukti dan identitas

V1 merekam **persetujuan internal melalui aplikasi**. Receipt dan QR tidak dinyatakan sebagai tanda tangan kriptografis tertanam dalam PDF, sertifikat identitas, hasil KYC, atau jaminan keabsahan hukum dokumen. Email confirmed tetap berarti provider mengonfirmasi alamat email, bukan memverifikasi identitas hukum pemegang akun.

Tiga identifier harus berbeda:

- Kode pengguna: identifier acak untuk memilih satu penerima; bukan password, authorization token atau hak untuk menandatangani.
- ID request/versi: identifier internal relasi dan state machine; bukan bukti persetujuan.
- Opaque receipt ID: referensi QR yang baru diterbitkan setelah persetujuan penerima committed. Mengetahui ID tetap tidak melewati login dan otorisasi.

Kode akun dan QR identitas akun dapat digunakan untuk berbagi identifier bila fitur itu masuk cakupan produk. QR identitas tersebut tidak boleh diperlakukan sebagai persetujuan permanen pengguna untuk dokumen apa pun. Server tidak menerima gambar QR dari browser sebagai bukti bahwa penerima menandatangani.

Penerima V1 harus akun lain: owner tidak dapat menunjuk dirinya sendiri. V1 hanya mendukung satu penerima wajib untuk sebuah dokumen; API menolak array penerima, parameter urutan, dan penambahan penandatangan kedua. R2 membatasi satu request per dokumen; penerima/request yang sudah dikirim tidak diedit atau diaktifkan ulang. Permintaan baru memakai draft baru, tanpa menghapus riwayat sebelumnya.

## 3. Versi, hash, dan PDF hasil

Sebelum undangan dikirim, server menetapkan versi sumber yang immutable: ID versi, metadata yang disetujui, ukuran, MIME, dan `source_sha256` dari byte PDF asli. Request mengikat versi ini secara eksplisit. R2 membuat versi 1 dan tidak menyediakan edit/penggantian file draft; gunakan draft baru. Ekstensi versi berikutnya tidak boleh memindahkan request lama ke versi terbaru secara diam-diam.

Saat request terkirim, byte sumber dan data yang ditampilkan untuk persetujuan dibekukan. Owner tidak dapat menimpa byte tersebut atau mengedit isi yang sedang diminta persetujuannya. Pembatalan pending sebelum keputusan/kedaluwarsa sudah disetujui; permintaan baru memakai draft baru. Perubahan tidak boleh menghapus bukti keputusan terdahulu.

Penambahan QR menghasilkan **artefak turunan**, bukan penggantian sumber. Kontrak pemrosesannya:

1. Penerima mengatur posisi pada setiap halaman. Server menghitung ulang geometri sumber pada worker terbatas, memvalidasi posisi dan anotasi, lalu commit keputusan terhadap `source_version_id`/`source_sha256`, consent, signer, waktu database, receipt ID dan manifest posisi dalam satu transaksi.
2. Render salinan dengan QR opaque yang menunjuk receipt tersebut, sesuai manifest terkunci. Format R3b menempatkan QR pada semua halaman asli, tanpa memperbesar kanvas atau menambah halaman bukti; bukti hanya pada web privat.
3. Simpan byte hasil pada object privat baru dengan `upsert:false`, lalu hitung `artifact_sha256` atas byte hasil yang benar-benar disimpan.
4. Publikasikan pointer artefak `ready` hanya setelah ukuran/hash dan keterkaitannya dengan receipt diverifikasi. Jika render gagal, tampilkan status pemrosesan gagal/tertunda dan pertahankan bukti persetujuan yang sudah committed.

QR yang terlihat pada PDF adalah bagian hasil V1. Sistem menetapkan dokumen `completed` ketika satu persetujuan penerima yang diwajibkan sudah committed **dan** artefak PDF ber-QR telah disimpan serta diverifikasi. Sebelum itu UI menyatakan persetujuan tercatat dengan hasil sedang diproses/gagal diproses; jangan menyatakan dokumen selesai atau mengganti persetujuan itu dengan transaksi baru. S-14 menetapkan penerima sebagai pengatur posisi semua halaman sebelum approve. Hasil lama tetap memakai layout versi awal secara immutable.

Protokol R3b: body approve menambahkan `placementVersion: "per-page-draggable-web-evidence-v2"` dan `placements: [{page,x,y}, ...]` berurutan untuk seluruh halaman. `x/y` merupakan koordinat relatif sudut kiri atas area terlihat. Client tidak mengirim ukuran halaman atau actor; server menghitung ukuran fisik dari perpotongan CropBox/MediaBox, rotasi dan UserUnit. Ukuran QR tetap 90 point. Manifest kanonis disimpan pada `signing_receipt_layouts`, hash SHA-256 atas `jsonb::text`, immutable dan RLS peserta. `approve_signing_request_with_placement` hanya dapat dieksekusi service role melalui server terotorisasi. Idempotensi mencakup seluruh posisi; retry yang mengubah posisi ditolak. Finalizer format baru mensyaratkan jumlah halaman sama dengan panjang manifest. Body reject tetap tidak menerima posisi. API membatasi body JSON 256 KiB; manifest maksimal 2.000 halaman dan 512 KiB.

Jangan memasukkan hash akhir PDF ke dalam PDF yang hash-nya sedang dihitung: penyisipan hash akan mengubah byte dan menciptakan ketergantungan melingkar. QR cukup memuat referensi opaque; manifest privat menghubungkan hash sumber, receipt dan hash artefak. UI membedakan sumber yang disetujui, hasil ber-QR dan status ketersediaan hasil. Jangan menyatakan file hasil siap diunduh ketika baru persetujuannya yang selesai.

Kontrak ini tidak mengimplementasikan PAdES, sertifikat atau signing key per pengguna. Bila kelak target berubah menjadi TTE berbasis sertifikat, alur versi, incremental updates, validasi sertifikat dan provider harus dirancang ulang; hasil `pdf-lib` tidak boleh dipromosikan sebagai signature kriptografis tanpa mekanisme tersebut.

## 4. Model data konseptual yang aditif

| Entitas usulan              | Isi minimum dan invariant                                                                                                                                   |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `signing_user_identifiers`  | `user_id`, kode acak unik, waktu penerbitan/status; kode milik sendiri dapat dilihat pemilik, bukan daftar semua pengguna                                   |
| `signing_documents`         | ID dokumen, owner dari sesi, metadata draft, pointer versi; tidak memakai enum review lama                                                                  |
| `signing_document_versions` | Versi sumber immutable, owner, metadata snapshot, path privat, ukuran, MIME dan `source_sha256`; unik dokumen + nomor versi                                 |
| `signing_requests`          | Dokumen/versi sumber, owner, satu recipient, state dan waktu kirim; aturan uniqueness menolak signer kedua dan request aktif yang menduplikasi lingkup V1   |
| `signing_decisions`         | `request_id` unik, recipient yang memutuskan, keputusan, consent version, hash sumber dan timestamp database; append-only, satu keputusan final per request |
| `signing_receipts`          | ID opaque unik dan relasi ke keputusan persetujuan; tidak diterbitkan untuk draft, request pending atau penolakan                                           |
| `signing_artifacts`         | Relasi sumber/receipt, status pemrosesan, path privat, ukuran/hash hasil dan identitas render job; hasil immutable dan tidak menimpa object lama            |
| `signing_audit_events`      | Aksi, actor server-resolved, target dan outcome; append-only dan metadata minimum tanpa password/token/isi PDF                                              |

Pemisahan tabel merupakan usulan untuk menghindari benturan state dan bukti lama. Migration final perlu memuat FK/composite constraint agar owner, dokumen, versi, recipient, request dan receipt tidak dapat dipasangkan lintas resource. Referential action tidak boleh diam-diam menghapus riwayat persetujuan. Retensi, penghapusan akun dan data tetap menunggu kebijakan; jangan menganggap aturan cascade cocok untuk bukti signing.

Kolom status dokumen adalah proyeksi state yang tervalidasi, bukan field yang dapat ditulis browser. Seluruh state harus mengikuti state machine produk yang disepakati. Pemisahan status keputusan dan status render mencegah kegagalan job PDF menghapus persetujuan atau menaikkan hitungan dokumen/file siap secara keliru.

## 5. Otorisasi dan RLS

| Actor             | Akses kontrak V1                                                                                                                                              |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Anonim            | Tidak dapat membaca dokumen, receipt, QR verification, user directory, atau melakukan mutation                                                                |
| Owner             | Mengelola draft sendiri dan membaca request/bukti miliknya; tidak dapat membuat keputusan sebagai recipient                                                   |
| Recipient         | Membaca snapshot versi yang secara eksplisit diberikan kepadanya dan mengambil keputusan atas request yang masih eligible; tidak mendapat seluruh arsip owner |
| Pengguna lain     | Tidak mendapat metadata, file atau hasil verifikasi; respons scope menggunakan 404                                                                            |
| Admin operasional | Agregat dan metadata minimum melalui endpoint terotorisasi; tidak otomatis mendapat PDF, hak mengubah keputusan, reset bukti, impersonation, atau role baru   |
| Server privileged | Hanya setelah actor dan lingkup tindakan diverifikasi; key tidak diberikan kepada browser dan tidak menjadi pengganti pemeriksaan akses                       |

Grant untuk recipient adalah relasi terikat akun + request + versi sumber. Undangan baru tidak memberi akses versi historis, file lain, draft berikutnya atau versi pengganti. Menebak kode pengguna, UUID, hash atau memegang QR tidak membuat grant baru. Daftar request masuk berbeda dari daftar dokumen milik sendiri.

Setiap pembacaan file/bukti memeriksa relasi melalui client user-scoped/RLS dan kondisi resource di server sebelum mengambil object lewat client privileged. Storage tetap private dan client biasa tidak mempunyai jalur download langsung. Jangan memperbaiki akses recipient dengan policy `authenticated USING (true)`, mengaktifkan public bucket, signed URL tanpa pemeriksaan lingkup, atau mengekspos schema `private`.

Kebijakan S-06/S-07 telah disetujui: recipient preview/download versi undangan selama pending aktif dan sesudah consented/completed; akses sumber dicabut pada rejected/cancelled/expired. Masa undangan 168 jam dari pengiriman. Audit dan riwayat tidak dihapus ketika grant berakhir; penerima hanya memperoleh riwayat request minimum tanpa metadata sumber yang sudah dicabut. Tidak ada perpanjangan atau reaktivasi otomatis. R2 belum menyediakan aksi keputusan untuk menghasilkan rejected/consented/completed.

RPC/definer yang diperlukan harus berfungsi sempit, memakai `search_path` kosong dan grant eksplisit. Identitas actor tidak dipercaya dari body. Desain final harus mengikat identitas autentikasi yang diverifikasi, request, versi sumber, dan bukti konfirmasi per tindakan; sekadar parameter `p_actor_id` dari pemanggil tidak cukup. Jangan menyediakan fungsi SQL generik atau hak tulis langsung atas keputusan, receipt dan audit kepada role API biasa.

## 6. Pencarian kode pengguna

Lookup hanya tersedia bagi pengguna login yang memenuhi kebijakan akun. Gunakan pencarian exact kode, bukan pencarian nama/email, daftar publik, prefix search atau pagination seluruh identitas. Server memakai identifier acak yang sulit ditebak dan atomic uniqueness; format panjang/alphabet final ditetapkan pada spesifikasi implementasi beserta entropy yang diuji.

Rate limiter harus membatasi per actor dan global serta menahan percobaan paralel; respons generic untuk kode tidak tersedia/tidak eligible. DTO hasil hanya berisi informasi minimum untuk memastikan penerima yang dituju dan reference pemilihan yang diverifikasi server. Jangan mengembalikan email, telepon, role, aktivitas atau dokumen penerima. Lookup tidak dianggap grant membaca dokumen maupun bukti persetujuan.

Respons sukses pasti membocorkan bahwa sebuah kode dapat dipilih. Karena itu pembatasan rate, kode berentropy memadai, metadata minimum dan pengujian enumeration adalah syarat, bukan klaim bahwa endpoint sama sekali tidak mengungkap keberadaan akun. R2 memakai kode acak 80 bit, exact lookup dan DTO `{id,code,displayName}`. Direktori, pencarian nama/email, publikasi kode global atau kanal eksternal baru tidak masuk cakupan implementasi minimum tersebut.

## 7. Transaksi keputusan, konfirmasi dan idempotensi

Setiap mutation memerlukan sesi server-valid, Origin yang benar, pemeriksaan akun/email sesuai kebijakan, payload strict, dan request id untuk audit. Idempotency-Key wajib untuk upload, pengiriman dan keputusan; render memakai receipt unik dan lease/claim server sebagai identitas retry; payload fingerprint mengikat lingkup actor, operasi, versi dan metadata canonical.

Penerima harus melihat versi yang benar lalu mengambil tindakan eksplisit. **S-05 telah dipilih: tanpa memasukkan ulang password.** Server memvalidasi sesi Supabase dan signed session claim; dialog/checkbox persetujuan mengikat request, versi, hash dan policy. HMAC sesi/tindakan hanya disimpan pada audit privat. Tidak ada OTP atau penggunaan grant recovery signing. Alasan reject wajib maksimal 1.000 karakter. Login sendiri tidak mengambil keputusan; password/token mentah tidak disimpan pada bukti.

Kontrak commit atomik:

1. Tentukan actor dari autentikasi tepercaya; cocokkan tepat dengan recipient V1 dan pastikan actor bukan owner.
2. Kunci request dan relasi versi yang diperlukan dalam urutan konsisten. Periksa eligibility, integritas sumber dan validitas proof/konfirmasi yang telah dipilih, termasuk binding terhadap actor, session/action dan versi.
3. Cocokkan idempotency key/fingerprint. Retry identik dari actor yang sama mengembalikan receipt aktual. Key yang dipakai untuk aksi/payload berbeda menghasilkan 409.
4. Konsumsi proof sekali bila desain proof digunakan; insert keputusan final yang immutable dan receipt opaque untuk persetujuan saja. Simpan event audit dan update state dalam transaksi yang sama.
5. Commit pekerjaan render sebagai outbox/job beridentitas unik. Worker hanya mengerjakan versi/receipt yang sudah committed; job retry tidak membuat keputusan kedua.

Finalisasi merupakan transaksi kedua yang idempotent: verifikasi bahwa keputusan dan versi masih sesuai, cocokkan hash/ukuran object hasil, lalu tandai artefak `ready` dan dokumen `completed` bersama-sama. Respons mutation keputusan dapat menyatakan keputusan tersimpan dan artefak pending, tanpa mengklaim PDF sudah selesai. Endpoint hasil mengembalikan PDF hanya pada state ready; bila belum siap mengembalikan 409 RESULT_NOT_READY. GET receipt dan POST render mengembalikan JSON status artefak aktual, bukan PDF kosong atau sumber yang menyamar sebagai hasil ber-QR.

Sign dan reject yang bersamaan harus diserialisasikan: satu keputusan menang, pihak yang kalah mendapat state conflict; tidak ada dua keputusan atau QR ganda. Pembatalan/expiry yang kelak disetujui harus memakai lock/state check yang sama, bukan hanya perubahan tampilan. Waktu keputusan berasal dari database, bukan jam browser.

DB, Storage dan proses render tidak merupakan satu transaksi bersama. Object ditulis pada path baru dengan `upsert:false`; pointer hasil di-commit setelah hash/ukuran benar. Bila respons commit hilang, baca receipt/job lebih dahulu dan simpan artefak privat yang belum pasti statusnya untuk rekonsiliasi. Jangan menghapusnya hanya karena koneksi timeout atau menjalankan ulang submit dengan key baru tanpa pemeriksaan.

## 8. Usulan API aditif

Namespace `/api/v2` memisahkan kontrak signing dari `/api/v1/documents` yang masih memakai `pending_review`. Endpoint kode, lookup, draft, request dan pembatalan di bawah sudah tersedia pada source R2, dengan migration 009 sudah diaktifkan menurut pengguna serta preflight API lulus pada 9 November; [uji cloud R2](r2-cloud-report.md) kemudian membuktikan perjalanan peserta dan pembatalan. Keputusan/receipt/hasil tersedia pada source R3, migration 010 aktif menurut operator dan preflight lulus 43 pemeriksaan, [uji peserta cloud R3](r3-cloud-report.md) lulus melalui kelanjutan yang ditinjau pada fixture dua dokumen; source metrics R4 kini tersedia sesuai S-11, dengan aktivasi cloud 012 dilaporkan berhasil dan preflight 49 lulus; sesi admin cloud belum dibuktikan. Kontrak final R3 berada di [r3-implementation-plan.md](r3-implementation-plan.md). Envelope, UTC timestamp, cursor pagination, no-store, request id, validasi sesi dan error terkontrol mengikuti baseline; DTO tidak mengekspos storage path, service key, session token atau private proof.

| Endpoint usulan                                         | Actor dan kontrak minimum                                                                                                                |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/v2/me/user-code`                              | Pengguna membaca kode sendiri; tidak mengubah role atau membuat bukti signing                                                            |
| `POST /api/v2/recipients/lookup`                        | R2: pengguna eligible mengirim satu exact kode; hasil minimum, dibatasi rate dan tidak memberikan akses file                             |
| `POST /api/v2/signing-documents`                        | Owner mengunggah PDF ke draft model baru; owner/hash/path dari server, belum ada QR/receipt                                              |
| `POST /api/v2/signing-requests`                         | R2: owner mengikat versi frozen dan satu recipient eligible; menolak self-recipient, array, perubahan sumber atau request duplikat       |
| `GET /api/v2/signing-requests?scope=sent\|received`     | List scoped actor dengan cursor; mode received tidak membaca seluruh tabel dokumen owner lain                                            |
| `GET /api/v2/signing-requests/:id`                      | Owner/recipient yang mempunyai grant membaca snapshot dan state minimum                                                                  |
| `GET /api/v2/signing-documents/:id/file?versionId=UUID` | R2: owner/recipient terotorisasi membaca tepat byte sumber frozen, termasuk Range dan `download=1` privat                                |
| `GET /api/v2/signing-documents` / `:id`                 | R2: list draft sendiri dan detail versi sumber hanya jika RLS masih memberi akses                                                        |
| `POST /api/v2/signing-requests/:id/cancel`              | R2: owner membatalkan pending yang belum kedaluwarsa; retry cancelled idempotent                                                         |
| `GET /api/v2/signing-requests/:id/decision`             | Peserta membaca keputusan aktual atau null; reason penolakan privat tanpa membuka kembali sumber                                         |
| `POST /api/v2/signing-requests/:id/decisions`           | Recipient saja, satu `approve` atau `reject`, consent version/hash binding/proof dan idempotency; tidak menerima actor/role dari browser |
| `GET /api/v2/signing-receipts/:opaqueId`                | Login dan grant wajib; hasil menunjukkan persetujuan internal, sumber, penandatangan minimum, waktu dan status artefak                   |
| `GET /api/v2/signing-receipts/:opaqueId/file`           | Owner/recipient memperoleh byte hasil ready, Range/download privat; 409 bila belum siap                                                  |
| `POST /api/v2/signing-receipts/:opaqueId/render`        | Retry peserta dengan lease/claim server; status JSON, bukan keputusan kedua                                                              |
| `GET /api/v2/operations/metrics`                        | Admin operasional terverifikasi memperoleh agregat sesuai definisi KPI; tanpa daftar PDF atau hak signing                                |

Pembatalan dan expiry mengikuti kontrak R2 yang disetujui; expiry diproyeksikan dari waktu, tanpa job penghapusan. Penggantian recipient, perpanjangan, account suspension, penghapusan dan akses support tidak mempunyai endpoint aktif. QR diarahkan ke halaman aplikasi yang meminta login lalu memanggil endpoint receipt scoped; bukan endpoint verifikasi publik.

Status error minimum: 401 `UNAUTHENTICATED`; 403 untuk Origin/akun/konfirmasi yang tidak memenuhi syarat tanpa membuka resource asing; 404 `NOT_FOUND` untuk resource di luar scope; 409 untuk stale version/state/idempotency conflict; 413 untuk batas body/file; 415 untuk tipe; 422 untuk payload/consent yang tidak valid; 429 untuk limiter; 503 untuk provider, Storage, DB atau renderer yang belum tersedia. Detail error tidak memuat SQL, stack, token atau metadata pihak lain. Kegagalan query agregat adalah unavailable, bukan angka nol.

## 9. Monitoring dan audit

**Implementasi R4, 11 November 2026:** S-11 sudah disetujui dan mengikuti [kontrak R4](r4-implementation-contract.md). Snapshot tanpa argumen berasal dari JWT pengguna, memeriksa ulang role/email/status provider di database, menggunakan satu waktu/snapshot baca serta tidak memakai privileged client pada DAL. Aktivitas 30 hari memakai event signing committed; hasil perlu perhatian adalah kondisi render saat ini. Halaman/API tersedia pada source 0.8.0, SQL native lulus; migration 012 dilaporkan berhasil dipasang dan [preflight API](r4-activation-check.md) lulus 49 pemeriksaan. Tidak ada grant/policy tabel peserta yang diperluas. [Laporan R4](r4-report.md) memisahkan bukti lokal dari penerimaan cloud yang masih diperlukan.

Endpoint agregat memeriksa role admin pada server dan lapisan database. Definisi hitungan harus memisahkan dokumen, versi upload, request dan keputusan. `approved` legacy tidak menjadi hitungan signing. Jendela waktu dan sumber event pengguna aktif ditentukan produk; refresh token otomatis tidak membuat aktivitas pengguna baru. Jika instrumentasi belum tersedia, UI menyatakan metrik belum tersedia, bukan mengarang nilai.

Catatan audit menyimpan actor yang terverifikasi, target versi/request, action, outcome, database timestamp dan request id. Hindari menyimpan password, OTP, full JWT, service key, isi dokumen, atau identifier pencarian mentah pada counter abuse. Alasan akses support, batas retensi audit dan data perangkat/IP membutuhkan kebijakan tersendiri; jangan mengumpulkannya otomatis karena label audit.

## 10. Urutan migration dan aktivasi

1. Selesaikan keputusan konfirmasi per tindakan, akses sesudah status terminal, area QR/artifact, pembatalan/reissue, discoverability dan retensi yang memengaruhi schema/permission. Target internal dan satu signer V1 sudah dipilih; fitur di luar keputusan itu tetap gated.
2. Susun migration tambahan bernomor baru setelah 001–008, terpisah dari sumber asli. Tambahkan model baru, RLS, ACL/default privilege, constraints, indeks, narrow RPC dan gate yang default-nya tertutup. Dokumen ini tidak menyediakan atau menjalankan SQL tersebut.
3. Uji pada PostgreSQL terisolasi dengan RLS nyata, privilege role dan transaksi bersamaan. Regenerasikan tipe dari schema yang diuji. Pisahkan fixture metadata Auth/Storage dari klaim integrasi provider nyata.
4. Terapkan ke development melalui operator setelah perubahan konkret ditinjau. SQL Editor bukan kemampuan key aplikasi; jangan menambahkan generic SQL RPC sebagai jalan pintas.
5. Implementasikan DAL/endpoint baru, lalu UX inbox/sent/consent/receipt dan admin agregat. Feature gate tidak boleh dapat dilewati dengan memanggil API/RPC secara langsung.
6. Jalankan uji provider/Storage/browser nyata pada fixture development yang disetujui. Rencanakan artefak immutable dan cleanup akun sebelum membuat record. Periksa kepemilikan serta hasil commit sebelum pembersihan.
7. Alihkan navigasi dan proses baru setelah penerimaan. Riwayat lama tetap terbaca sebagai legacy administratif. Jangan menghapus role reviewer/ACL atau menutup RPC lama tanpa inventaris data, analisis dependensi dan rencana transisi operator.

Tidak ada backfill dari data review lama menjadi keputusan penandatangan. Percobaan awal cloud yang gagal sebelum penyimpanan sudah direkonsiliasi dan kedua akun dibersihkan. Retest R1 pada 5 November kemudian lulus; satu akun pemilik/dokumen sintetis dipertahankan, akun pembanding dibersihkan. Tidak ada izin reset atau pengulangan fixture cloud R2 dari hasil tersebut. Migration 009 hanya melakukan backfill identifier akun, bukan dokumen/keputusan signing.

## 11. Bukti penerimaan sebelum aktivasi

- Satu kode akun memilih penerima yang benar tanpa membuka direktori/email/telepon; lookup tidak mengizinkan signing atau file access.
- Owner, penerima sah, pengguna ketiga, admin tanpa grant dan anon diuji melalui API serta database. Grant satu versi tidak membuka versi historis/berikutnya atau PDF lain.
- Sumber yang dibaca penerima memiliki hash yang sama dengan versi yang diikat pada keputusan; mutation atau stale version ditolak. Metadata dan byte lama tidak ditimpa.
- Tidak ada keputusan/QR sebelum tindakan eksplisit dengan mekanisme konfirmasi yang telah disetujui. Replay, proof lain-user/lain-session/lain-versi dan sign/reject race tidak menghasilkan bukti ganda.
- Retry identik mengembalikan receipt yang sama; konflik key menghasilkan 409 dan tidak mengganti hasil. Batas V1 satu pengguna lain benar-benar ditegakkan pada API dan DB.
- QR memerlukan login dan grant. Recipient/owner dapat memeriksa bukti sesuai kebijakan; pengguna lain tidak mendapatkan keberadaan dokumen atau byte hasil.
- Hash sumber dan hasil dibedakan, private streaming/Range/download mempertahankan byte, render retry tidak menciptakan persetujuan baru, dan kegagalan finalisasi tidak ditampilkan sebagai hasil siap.
- Admin monitoring membaca angka nyata sesuai definisi, tidak memperoleh hak signing/read-all PDF, dan kesalahan query tidak menjadi statistik nol palsu.
- Jalur legacy tetap mempunyai arti dan pembatasan sebelumnya; review approval tidak berubah menjadi consent signature. Rahasia server tidak muncul di bundle browser, QR, URL atau log.

## Sumber baseline yang diperiksa

- [API asli](../../Document_Verification_Platform_v1.0.2/document-verification-platform-v1.0.2/API_SPECIFICATION.md) dan [arsitektur keamanan asli](../../Document_Verification_Platform_v1.0.2/document-verification-platform-v1.0.2/SECURITY_ARCHITECTURE.md).
- [Schema 001](../../supabase/migrations/202611010001_initial_schema.sql), [hardening 003](../../supabase/migrations/202611010003_access_control_foundation.sql), dan [view/RPC owner 007](../../supabase/migrations/202611040007_owner_workspace_queries.sql).
- [API envelope/guard](../../src/server/api.ts), [upload](../../src/server/documents/upload.ts), [private file](../../src/server/documents/file.ts), dan [DTO workspace](../../src/server/workspace/types.ts).
