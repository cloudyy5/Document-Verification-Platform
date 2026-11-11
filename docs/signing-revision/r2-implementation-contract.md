# Kontrak implementasi R2

Versi kontrak/policy: **5 November 2026**. Checkpoint dokumentasi: **9 November 2026**, Asia/Makassar. Nama/versi consent tetap dipertahankan; migration 009 sudah diuji terisolasi, dilaporkan telah dipasang oleh pengguna pada cloud, dan lulus preflight API pada 9 November 2026. Lihat [preflight](r2-activation-check.md) dan [hasil cloud R2](r2-cloud-report.md): satu skenario/tujuh kelompok lulus dengan satu fixture yang telah disetujui.

Scope yang disetujui: prototipe internal, satu penerima pengguna lain, undangan 168 jam, owner dapat membatalkan sebelum keputusan, recipient preview/download selama aktif dan setelah selesai; tidak ada akses PDF sesudah rejected/cancelled/expired. Expiry tidak menghapus riwayat. Consent pada development-consent.md disetujui untuk development; metode aksi R3 belum dipilih. R2 tidak menyediakan approve/reject/signature/QR.

## Interface bersama implementasi

SQL baru `202611050009_signing_requests.sql`, additive setelah 001–008. Tidak mengubah tabel/enum/RPC legacy. R2 mempunyai tabel public dengan SELECT user-scoped/RLS; tidak ada INSERT/UPDATE/DELETE/TRUNCATE bagi authenticated/anon/service_role secara langsung. Narrow mutation RPC hanya untuk service_role, actor parameter hanya berasal dari sesi server-valid. postgres owner fungsi menggunakan search_path kosong. RLS/helper tidak mengizinkan admin/reviewer membaca PDF karena role tersebut.

Tabel:

- `signing_user_identifiers`: user_id, code unik acak, created_at. Trigger Auth dan backfill untuk kode akun stabil; kode bukan secret. Code format `DVP-` diikuti 20 uppercase hex, minimal 80 bit dari random bytes; display dapat dikelompokkan UI. Code immutable dan tidak dapat dipilih browser. SELECT hanya akun sendiri.
- `signing_documents`: id, owner_id, created_at; unique id+owner.
- `signing_document_versions`: id, document_id, owner_id, version_no, title, category_id, custom_document_type, document_date, issuing_institution, description, original_filename, file_size_bytes, source_sha256, storage_path, upload_policy_version, consented_at, created_at. Immutable; R2 membuat versi 1 saja. Relasi composite mencegah pasangan lintas owner/document. Storage path `${ownerId}/signing/${documentId}/${versionId}.pdf` pada bucket private `document-submissions`.
- `signing_requests`: id, document_id, source_version_id, owner_id, recipient_id, owner_display_name, recipient_display_name, status, sent_at, expires_at, cancelled_at, sharing_policy_version, sharing_consented_at. Satu request per document pada R2; request yang dibatalkan tidak diedit/diaktifkan ulang. Pilih draft baru untuk permintaan baru. Status yang dicadangkan pending/cancelled/rejected/consented/completed; R2 hanya menghasilkan pending/cancelled. Status expired dihitung dari pending + waktu DB, bukan aksi keputusan. Recipient SELECT row request miliknya sebagai riwayat minimum; metadata/source file berada pada versions dan dicabut RLS ketika terminal tanpa akses. Tidak ada snapshot judul/file/hash pada request yang melewati pencabutan.
- Audit append-only pada schema private, dan notifikasi in-app generik memakai notifications yang sudah ada, tanpa judul PDF/secret, tidak ada email/SMS.

Fungsi public (semuanya service-only kecuali SELECT tabel melalui RLS):

1. `lookup_signing_recipient(p_actor_id uuid, p_code text) returns jsonb`: `{id,code,displayName}`; exact code, recipient lain normal user+email confirmed, generic unavailable untuk tak cocok/self/tidak eligible.
2. `create_signing_draft(p_actor_id uuid,p_document_id uuid,p_version_id uuid,p_title text,p_category_id uuid,p_custom_document_type text,p_document_date date,p_issuing_institution text,p_description text,p_original_filename text,p_file_size_bytes bigint,p_source_sha256 text,p_storage_path text,p_upload_policy_version text,p_upload_consent boolean) returns jsonb`: `{documentId,versionId,versionNo:1,status:'draft',createdAt}`. Metadata canonical, actor user+verified, kategori aktif, Others conditional, policy version tepat. Upload consent version `internal-upload-development-2026-11-05`.
3. `send_signing_request(p_actor_id uuid,p_request_id uuid,p_source_version_id uuid,p_recipient_code text,p_recipient_id uuid,p_sharing_policy_version text,p_sharing_consent boolean) returns jsonb`: `{requestId,documentId,sourceVersionId,status,sentAt,expiresAt,cancelledAt}`. DB lock dan uniqueness menahan duplicate/race; recipient id/code di-revalidate, snapshot nama minimum; consent sharing version `internal-sharing-development-2026-11-05`. Retry request id+payload sama mengembalikan receipt sama; beda payload 409.
4. `cancel_signing_request(p_actor_id uuid,p_request_id uuid) returns jsonb`: bentuk receipt yang sama; owner saja, pending belum expired, cancelled retry idempotent, keputusan yang sudah tercatat tidak dapat dibatalkan.
5. `consume_signing_operation_limit(p_action text,p_key_digest text,p_global_digest text) returns boolean`: service-only, atomik counters actor/global, memakai digest HMAC dari trusted server. lookup 20/user +100global per15m, send10/user +50global, cancel20/user +100global. Angka adalah backstop teknis development, bukan biaya atau kebijakan bisnis. Upload menggunakan limiter008 yang sudah ada.

Actor/code lookup diverifikasi server dan RPC; tidak ada generic SQL endpoint. Permission dan workflow langsung API/RPC tetap diuji walau UI menyembunyikan link. Semua fungsi mutasi role user dan email confirmed; anon dan authenticated tidak boleh menjalankannya langsung.

## DTO dan DAL

`src/server/signing/{types,queries}.ts` menyediakan:

- `getSigningUserCode(): {code,createdAt}`
- `lookupSigningRecipient(code): {id,code,displayName}`
- `getSigningDocuments(input?:unknown): {items:SigningDocument[],hasMore:boolean,cursor:string|null}`
- `getSigningDocument(id): SigningDocument|null` (metadata hanya jika RLS memberi akses ke versi)
- `getSigningRequests(input:{scope:'received'|'sent',cursor?:string}): {items:SigningRequest[],hasMore,cursor}`
- `getSigningRequest(id): {request:SigningRequest,document:SigningDocument|null}|null`
- `sendSigningRequest(input:{sourceVersionId,recipientCode,recipientId,sharingPolicyVersion,sharingConsent:true},key:string)`
- `cancelSigningRequest(requestId:string)`

`SigningDocument`: id, versionId, versionNo, title, categoryId, customDocumentType, documentDate, issuingInstitution, description, fileName, fileSizeBytes, sha256, createdAt, isOwner, request:SigningRequest|null.

`SigningRequest`: id, documentId, sourceVersionId, ownerName, recipientName, documentTitle:string|null, status (pending/expired/cancelled/rejected/consented/completed), sentAt, expiresAt, cancelledAt:string|null, isOwner:boolean, canReadFile:boolean. Null title/metadata pada recipient setelah grant berakhir tidak diganti dengan data privileged. Requests list memakai RLS dan dua query scoped; tidak memakai service SELECT untuk mengatasi RLS kosong.

Keduanya memakai auth terlebih dahulu, dev loopback guard, bounded cursor pagination20/max50, private no-store, DTO tanpa storage path/email/token. Error gunakan ApiError dari server/errors.ts agar apiRoute bisa memetakan secara aman. Error DB static dipetakan, tidak dilempar raw SQL/message/stack.

## API final R2

- GET `/api/v2/me/user-code`
- POST `/api/v2/recipients/lookup` JSON `{code}`
- GET/POST `/api/v2/signing-documents` (POST multipart metadata sama dengan upload sebelumnya, policyVersion upload baru +consent)
- GET `/api/v2/signing-documents/:documentId`
- GET `/api/v2/signing-documents/:documentId/file?versionId=UUID&download=1` (kedua parameter opsional; default versi 1/inline; tidak menerima arbitrary storage path)
- GET/POST `/api/v2/signing-requests` (GET scope received/sent; POST input send di atas)
- GET `/api/v2/signing-requests/:requestId`
- POST `/api/v2/signing-requests/:requestId/cancel` tanpa actor/body wewenang

Mutation memeriksa Origin, body strict bounded, sesi+verified+user. Idempotency-Key UUID wajib pada upload/send; UUID hasil diturunkan deterministik dengan fungsi existing derivedUploadId(owner,key,purpose) dan purpose signing-* agar tidak bertabrakan legacy. Config development tetap menolak mutation di luar loopback. API R3 approve/reject/QR tidak dibuat.

## Halaman dan UI

Additive pada route `/signing/documents`, `/signing/new`, `/signing/documents/:id`, `/requests/incoming`, `/requests/outgoing`, `/requests/:id`. Profil mendapat kartu kode akun sendiri. Sidebar memprioritaskan Persetujuan internal dan Permintaan; dokumen legacy tetap bisa diakses tanpa mengubah arti data. Tidak ada statistik palsu atau success receipt buatan.

Komponen client melakukan fetch ke API di atas, loading/error/empty nyata, form upload +checkbox storage baru, lookup exact +pilih recipient +checkbox sharing baru, sender cancel confirmation, receiver source preview/download jika canReadFile, state elapsed expiry dan akses diblokir yang jelas. Tidak ada tombol persetujuan aktif atau QR; jelaskan aksi keputusan menunggu tahap berikutnya. Light/Dark dan identitas visual lama tetap dipakai.

## Operasi dan aktivasi

Migration diuji pada cluster PostgreSQL native terisolasi; types regenerated setelah SQL final. Cloud DDL dilakukan operator, bukan API key. Source siap sebelum meminta operator menjalankan migration. Tidak ada record signing cloud baru atau fixture tambahan dibuat tanpa cakupan uji yang disetujui. R1 fixture legacy tidak diubah menjadi draft/consent signing.
