-- Public service policies, 17 November 2026. Existing history is not rewritten.
begin;
alter table public.signing_document_versions drop constraint signing_document_versions_upload_policy_version_check;
alter table public.signing_document_versions add constraint signing_document_versions_upload_policy_version_check check(upload_policy_version in('internal-upload-development-2026-11-05','internal-upload-2026-11-17'));
alter table public.signing_requests drop constraint signing_requests_sharing_policy_version_check;
alter table public.signing_requests add constraint signing_requests_sharing_policy_version_check check(sharing_policy_version in('internal-sharing-development-2026-11-05','internal-sharing-2026-11-17'));
alter table public.signing_decisions drop constraint signing_decisions_policy_version_check;
alter table public.signing_decisions add constraint signing_decisions_policy_version_check check(policy_version in('internal-action-development-2026-11-05','internal-action-2026-11-17'));
alter table public.signing_receipts drop constraint signing_receipts_policy_version_check;
alter table public.signing_receipts add constraint signing_receipts_policy_version_check check(policy_version in('internal-action-development-2026-11-05','internal-action-2026-11-17'));

create or replace function public.create_signing_draft(
  p_actor_id uuid, p_document_id uuid, p_version_id uuid, p_title text, p_category_id uuid,
  p_custom_document_type text, p_document_date date, p_issuing_institution text, p_description text,
  p_original_filename text, p_file_size_bytes bigint, p_source_sha256 text, p_storage_path text,
  p_upload_policy_version text, p_upload_consent boolean
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_slug text; v_existing public.signing_document_versions%rowtype; v_now timestamptz;
begin
  if not private.is_signing_user(p_actor_id) then raise exception 'SIGNING_ACTOR_REQUIRED' using errcode = '42501'; end if;
  if p_document_id is null or p_version_id is null or p_document_id = p_version_id
    or p_title is null or char_length(trim(p_title)) not between 1 and 200
    or (p_custom_document_type is not null and char_length(trim(p_custom_document_type)) > 120)
    or (p_issuing_institution is not null and char_length(trim(p_issuing_institution)) > 200)
    or (p_description is not null and char_length(trim(p_description)) > 2000)
    or (p_document_date is not null and (p_document_date < date '0001-01-01' or p_document_date > date '9999-12-31'))
    or p_original_filename is null or char_length(trim(p_original_filename)) not between 1 and 255
    or p_original_filename ~ '[[:cntrl:]/\\]' or p_original_filename !~* '\.pdf$'
    or p_file_size_bytes is null or p_file_size_bytes not between 1 and 10485760
    or p_source_sha256 is null or p_source_sha256 !~ '^[a-f0-9]{64}$'
    or p_storage_path is distinct from (p_actor_id::text || '/signing/' || p_document_id::text || '/' || p_version_id::text || '.pdf')
    or (p_upload_policy_version is null or p_upload_policy_version not in ('internal-upload-development-2026-11-05','internal-upload-2026-11-17'))
    or p_upload_consent is distinct from true then
    raise exception 'INVALID_SIGNING_INPUT' using errcode = '22023';
  end if;
  -- Serialize a document's creation and sending. The second lock prevents a
  -- version ID being raced across unrelated document IDs without raw SQL leaks.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('signing-document:' || p_document_id::text, 0));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('signing-version:' || p_version_id::text, 0));
  select * into v_existing from public.signing_document_versions where id = p_version_id or document_id = p_document_id;
  if found then
    if v_existing.id = p_version_id and v_existing.document_id = p_document_id and v_existing.owner_id = p_actor_id
      and v_existing.title = trim(p_title) and v_existing.category_id = p_category_id
      and v_existing.custom_document_type is not distinct from nullif(trim(p_custom_document_type), '')
      and v_existing.document_date is not distinct from p_document_date
      and v_existing.issuing_institution is not distinct from nullif(trim(p_issuing_institution), '')
      and v_existing.description is not distinct from nullif(trim(p_description), '')
      and v_existing.original_filename = trim(p_original_filename) and v_existing.file_size_bytes = p_file_size_bytes
      and v_existing.source_sha256 = p_source_sha256 and v_existing.storage_path = p_storage_path
      and v_existing.upload_policy_version = p_upload_policy_version then
      return jsonb_build_object('documentId', v_existing.document_id, 'versionId', v_existing.id,
        'versionNo', v_existing.version_no, 'status', 'draft', 'createdAt', v_existing.created_at);
    end if;
    raise exception 'SIGNING_IDEMPOTENCY_CONFLICT';
  end if;
  if exists (select 1 from public.signing_documents where id = p_document_id) then raise exception 'SIGNING_IDEMPOTENCY_CONFLICT'; end if;
  select slug into v_slug from public.document_categories where id = p_category_id and is_active;
  if v_slug is null or (v_slug = 'lainnya' and nullif(trim(p_custom_document_type), '') is null)
    or (v_slug <> 'lainnya' and nullif(trim(p_custom_document_type), '') is not null) then
    raise exception 'INVALID_SIGNING_INPUT' using errcode = '22023';
  end if;
  if not exists (select 1 from storage.objects where bucket_id = 'document-submissions' and name = p_storage_path) then
    raise exception 'INVALID_SIGNING_INPUT' using errcode = '22023';
  end if;
  v_now := clock_timestamp();
  insert into public.signing_documents(id, owner_id, created_at) values (p_document_id, p_actor_id, v_now);
  insert into public.signing_document_versions(id, document_id, owner_id, version_no, title, category_id,
    custom_document_type, document_date, issuing_institution, description, original_filename,
    file_size_bytes, source_sha256, storage_path, upload_policy_version, consented_at, created_at)
  values (p_version_id, p_document_id, p_actor_id, 1, trim(p_title), p_category_id,
    nullif(trim(p_custom_document_type), ''), p_document_date, nullif(trim(p_issuing_institution), ''),
    nullif(trim(p_description), ''), trim(p_original_filename), p_file_size_bytes, p_source_sha256,
    p_storage_path, p_upload_policy_version, v_now, v_now);
  insert into private.signing_audit_events(actor_id, action, document_id, version_id)
  values (p_actor_id, 'draft_created', p_document_id, p_version_id);
  return jsonb_build_object('documentId', p_document_id, 'versionId', p_version_id,
    'versionNo', 1, 'status', 'draft', 'createdAt', v_now);
end;
$$;

create or replace function public.send_signing_request(p_actor_id uuid, p_request_id uuid, p_source_version_id uuid,
  p_recipient_code text, p_recipient_id uuid, p_sharing_policy_version text, p_sharing_consent boolean)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_version public.signing_document_versions%rowtype; v_request public.signing_requests%rowtype;
  v_owner_name text; v_recipient_name text; v_now timestamptz;
begin
  if not private.is_signing_user(p_actor_id) then raise exception 'SIGNING_ACTOR_REQUIRED' using errcode = '42501'; end if;
  if p_request_id is null or p_source_version_id is null or p_recipient_id is null
    or p_recipient_code is null or p_recipient_code !~ '^DVP-[A-F0-9]{20}$'
    or (p_sharing_policy_version is null or p_sharing_policy_version not in ('internal-sharing-development-2026-11-05','internal-sharing-2026-11-17'))
    or p_sharing_consent is distinct from true then raise exception 'INVALID_SIGNING_INPUT' using errcode = '22023'; end if;
  select * into v_version from public.signing_document_versions where id = p_source_version_id and owner_id = p_actor_id;
  if not found then raise exception 'SIGNING_NOT_FOUND' using errcode = 'P0002'; end if;
  -- Every mutation of one document takes this same lock before row locks.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('signing-document:' || v_version.document_id::text, 0));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('signing-request:' || p_request_id::text, 0));
  perform 1 from public.signing_documents where id = v_version.document_id for update;
  select * into v_request from public.signing_requests where id = p_request_id;
  if found then
    if v_request.owner_id = p_actor_id and v_request.source_version_id = p_source_version_id
      and v_request.recipient_id = p_recipient_id and v_request.sharing_policy_version = p_sharing_policy_version
      and exists (select 1 from public.signing_user_identifiers where user_id = p_recipient_id and code = p_recipient_code) then
      return private.signing_request_receipt(p_request_id);
    end if;
    raise exception 'SIGNING_IDEMPOTENCY_CONFLICT';
  end if;
  if exists (select 1 from public.signing_requests where document_id = v_version.document_id) then
    raise exception 'SIGNING_DOCUMENT_NOT_ELIGIBLE';
  end if;
  if p_recipient_id = p_actor_id or not private.is_signing_user(p_recipient_id)
    or not exists (select 1 from public.signing_user_identifiers where user_id = p_recipient_id and code = p_recipient_code) then
    raise exception 'SIGNING_RECIPIENT_UNAVAILABLE';
  end if;
  select coalesce(nullif(trim(full_name), ''), 'Pengguna') into v_owner_name from public.profiles where id = p_actor_id;
  select coalesce(nullif(trim(full_name), ''), 'Pengguna') into v_recipient_name from public.profiles where id = p_recipient_id;
  v_now := clock_timestamp();
  insert into public.signing_requests(id, document_id, source_version_id, owner_id, recipient_id,
    owner_display_name, recipient_display_name, status, sent_at, expires_at, sharing_policy_version, sharing_consented_at)
  values (p_request_id, v_version.document_id, p_source_version_id, p_actor_id, p_recipient_id,
    v_owner_name, v_recipient_name, 'pending', v_now, v_now + interval '168 hours', p_sharing_policy_version, v_now);
  insert into private.signing_audit_events(actor_id, action, document_id, version_id, request_id)
  values (p_actor_id, 'request_sent', v_version.document_id, p_source_version_id, p_request_id);
  insert into public.notifications(user_id, type, title, body, target_path)
  values (p_recipient_id, 'signing_request_received', 'Permintaan persetujuan baru',
    'Anda menerima permintaan persetujuan dokumen internal. Buka permintaan untuk melihat akses yang tersedia.', '/requests/' || p_request_id::text);
  return private.signing_request_receipt(p_request_id);
end;
$$;

create or replace function public.decide_signing_request(p_actor_id uuid,p_request_id uuid,p_decision_id uuid,
  p_source_version_id uuid,p_source_sha256 text,p_action text,p_reason text,p_policy_version text,
  p_consent boolean,p_confirmed boolean,p_confirmation_digest text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.signing_requests%rowtype; v public.signing_document_versions%rowtype;
  d public.signing_decisions%rowtype; t timestamptz; opaque text; signer text; signer_code text;
begin
  if not private.is_signing_user(p_actor_id) then raise exception 'SIGNING_ACTOR_REQUIRED' using errcode='42501'; end if;
  if p_request_id is null or p_decision_id is null or p_source_version_id is null
    or p_action is null or p_action not in ('approve','reject') or p_confirmed is distinct from true
    or (p_policy_version is null or p_policy_version not in ('internal-action-development-2026-11-05','internal-action-2026-11-17'))
    or p_source_sha256 is null or p_source_sha256 !~ '^[a-f0-9]{64}$'
    or p_confirmation_digest is null or p_confirmation_digest !~ '^[a-f0-9]{64}$'
    or (p_action='approve' and (p_consent is distinct from true or p_reason is not null))
    or (p_action='reject' and (p_consent is distinct from false or p_reason is null or char_length(trim(p_reason)) not between 1 and 1000))
  then raise exception 'INVALID_SIGNING_INPUT' using errcode='22023'; end if;
  select * into r from public.signing_requests where id=p_request_id and recipient_id=p_actor_id;
  if not found then raise exception 'SIGNING_NOT_FOUND' using errcode='P0002'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('signing-document:'||r.document_id::text,0));
  select * into r from public.signing_requests where id=p_request_id and recipient_id=p_actor_id for update;
  select * into v from public.signing_document_versions where id=r.source_version_id;
  if p_source_version_id<>r.source_version_id or p_source_sha256<>v.source_sha256 then raise exception 'SIGNING_VERSION_CONFLICT'; end if;
  select * into d from public.signing_decisions where request_id=r.id;
  if found then
    if d.id=p_decision_id and d.actor_id=p_actor_id and d.action=p_action
      and d.reason is not distinct from nullif(trim(p_reason),'') and d.policy_version=p_policy_version and d.consent=p_consent
    then return private.signing_decision_receipt(r.id); end if;
    raise exception 'SIGNING_IDEMPOTENCY_CONFLICT';
  end if;
  t:=clock_timestamp();
  if r.status<>'pending' then raise exception 'SIGNING_REQUEST_NOT_ELIGIBLE'; end if;
  if r.expires_at<=t then raise exception 'SIGNING_REQUEST_EXPIRED'; end if;
  insert into public.signing_decisions(id,request_id,source_version_id,actor_id,action,reason,policy_version,consent,decided_at)
    values(p_decision_id,r.id,v.id,p_actor_id,p_action,nullif(trim(p_reason),''),p_policy_version,p_consent,t);
  if p_action='approve' then
    select coalesce(nullif(trim(full_name),''),'Pengguna') into signer from public.profiles where id=p_actor_id;
    select code into signer_code from public.signing_user_identifiers where user_id=p_actor_id;
    opaque:=rtrim(translate(encode(extensions.gen_random_bytes(32),'base64'),'+/','-_'),'=');
    insert into public.signing_receipts(id,decision_id,request_id,source_version_id,owner_id,recipient_id,
      signer_name,signer_code,owner_name,document_title,source_sha256,policy_version,decided_at)
      values(opaque,p_decision_id,r.id,v.id,r.owner_id,r.recipient_id,signer,signer_code,
        r.owner_display_name,v.title,v.source_sha256,p_policy_version,t);
    insert into public.signing_artifacts(receipt_id) values(opaque);
    insert into private.signing_render_jobs(receipt_id) values(opaque);
  end if;
  update public.signing_requests set status=case when p_action='approve' then 'consented' else 'rejected' end where id=r.id;
  insert into private.signing_audit_events(actor_id,action,document_id,version_id,request_id,confirmation_digest)
    values(p_actor_id,case when p_action='approve' then 'approved' else 'rejected' end,r.document_id,v.id,r.id,p_confirmation_digest);
  insert into public.notifications(user_id,type,title,body,target_path) values(r.owner_id,
    'signing_decision_recorded','Tanggapan permintaan tercatat',
    'Penerima telah menanggapi permintaan persetujuan internal. Buka riwayat privat untuk melihat hasil.', '/requests/'||r.id::text);
  return private.signing_decision_receipt(r.id);
end; $$;

create or replace function public.approve_signing_request_with_selected_pages(p_actor_id uuid,p_request_id uuid,p_decision_id uuid,
 p_source_version_id uuid,p_source_sha256 text,p_policy_version text,p_consent boolean,p_confirmed boolean,
 p_confirmation_digest text,p_placement_plan jsonb,p_source_page_count integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.signing_requests%rowtype; v public.signing_document_versions%rowtype;
 d public.signing_decisions%rowtype; t timestamptz; opaque text; signer text; account_code text;
begin
 if not private.is_signing_user(p_actor_id) then raise exception 'SIGNING_ACTOR_REQUIRED' using errcode='42501'; end if;
 if p_request_id is null or p_decision_id is null or p_source_version_id is null or p_confirmed is distinct from true
  or p_consent is distinct from true or (p_policy_version is null or p_policy_version not in ('internal-action-development-2026-11-05','internal-action-2026-11-17'))
  or p_source_sha256 is null or p_source_sha256 !~ '^[a-f0-9]{64}$' or p_confirmation_digest is null or p_confirmation_digest !~ '^[a-f0-9]{64}$'
  or not private.valid_selected_signing_placement_plan(p_placement_plan,p_source_page_count)
 then raise exception 'INVALID_SIGNING_INPUT' using errcode='22023'; end if;
 select * into r from public.signing_requests where id=p_request_id and recipient_id=p_actor_id;
 if not found then raise exception 'SIGNING_NOT_FOUND' using errcode='P0002'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('signing-document:'||r.document_id::text,0));
 select * into r from public.signing_requests where id=p_request_id and recipient_id=p_actor_id for update;
 select * into v from public.signing_document_versions where id=r.source_version_id;
 if p_source_version_id<>r.source_version_id or p_source_sha256<>v.source_sha256 then raise exception 'SIGNING_VERSION_CONFLICT'; end if;
 select * into d from public.signing_decisions where request_id=r.id;
 if found then
  if d.id=p_decision_id and d.actor_id=p_actor_id and d.action='approve' and d.policy_version=p_policy_version
   and exists(select 1 from public.signing_receipts receipt join public.signing_receipt_layouts layout on layout.receipt_id=receipt.id
    where receipt.decision_id=d.id and layout.layout_version='selected-pages-draggable-web-evidence-v3' and layout.placement_plan=p_placement_plan and layout.source_page_count=p_source_page_count)
  then return private.signing_decision_receipt(r.id); end if;
  raise exception 'SIGNING_IDEMPOTENCY_CONFLICT';
 end if;
 t:=clock_timestamp();
 if r.status<>'pending' then raise exception 'SIGNING_REQUEST_NOT_ELIGIBLE'; end if;
 if r.expires_at<=t then raise exception 'SIGNING_REQUEST_EXPIRED'; end if;
 insert into public.signing_decisions(id,request_id,source_version_id,actor_id,action,reason,policy_version,consent,decided_at)
  values(p_decision_id,r.id,v.id,p_actor_id,'approve',null,p_policy_version,true,t);
 select coalesce(nullif(trim(full_name),''),'Pengguna') into signer from public.profiles where id=p_actor_id;
 select code into account_code from public.signing_user_identifiers where user_id=p_actor_id;
 opaque:=rtrim(translate(encode(extensions.gen_random_bytes(32),'base64'),'+/','-_'),'=');
 insert into public.signing_receipts(id,decision_id,request_id,source_version_id,owner_id,recipient_id,
  signer_name,signer_code,owner_name,document_title,source_sha256,policy_version,layout_version,decided_at)
  values(opaque,p_decision_id,r.id,v.id,r.owner_id,r.recipient_id,signer,account_code,r.owner_display_name,v.title,v.source_sha256,p_policy_version,'selected-pages-draggable-web-evidence-v3',t);
 insert into public.signing_receipt_layouts(receipt_id,layout_version,source_page_count,placement_plan,plan_sha256)
  values(opaque,'selected-pages-draggable-web-evidence-v3',p_source_page_count,p_placement_plan,encode(extensions.digest(p_placement_plan::text,'sha256'),'hex'));
 insert into public.signing_artifacts(receipt_id) values(opaque);
 insert into private.signing_render_jobs(receipt_id) values(opaque);
 update public.signing_requests set status='consented' where id=r.id;
 insert into private.signing_audit_events(actor_id,action,document_id,version_id,request_id,confirmation_digest)
  values(p_actor_id,'approved',r.document_id,v.id,r.id,p_confirmation_digest);
 insert into public.notifications(user_id,type,title,body,target_path) values(r.owner_id,'signing_decision_recorded','Tanggapan permintaan tercatat',
  'Penerima telah menanggapi permintaan persetujuan internal. Buka riwayat privat untuk melihat hasil.','/requests/'||r.id::text);
 return private.signing_decision_receipt(r.id);
end; $$;

create or replace function public.approve_signing_request_with_placement(p_actor_id uuid,p_request_id uuid,p_decision_id uuid,
 p_source_version_id uuid,p_source_sha256 text,p_policy_version text,p_consent boolean,p_confirmed boolean,
 p_confirmation_digest text,p_placement_plan jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.signing_requests%rowtype; v public.signing_document_versions%rowtype;
 d public.signing_decisions%rowtype; t timestamptz; opaque text; signer text; account_code text;
begin
 if not private.is_signing_user(p_actor_id) then raise exception 'SIGNING_ACTOR_REQUIRED' using errcode='42501'; end if;
 if p_request_id is null or p_decision_id is null or p_source_version_id is null or p_confirmed is distinct from true
  or p_consent is distinct from true or (p_policy_version is null or p_policy_version not in ('internal-action-development-2026-11-05','internal-action-2026-11-17'))
  or p_source_sha256 is null or p_source_sha256 !~ '^[a-f0-9]{64}$' or p_confirmation_digest is null or p_confirmation_digest !~ '^[a-f0-9]{64}$'
  or not private.valid_signing_placement_plan(p_placement_plan)
 then raise exception 'INVALID_SIGNING_INPUT' using errcode='22023'; end if;
 select * into r from public.signing_requests where id=p_request_id and recipient_id=p_actor_id;
 if not found then raise exception 'SIGNING_NOT_FOUND' using errcode='P0002'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('signing-document:'||r.document_id::text,0));
 select * into r from public.signing_requests where id=p_request_id and recipient_id=p_actor_id for update;
 select * into v from public.signing_document_versions where id=r.source_version_id;
 if p_source_version_id<>r.source_version_id or p_source_sha256<>v.source_sha256 then raise exception 'SIGNING_VERSION_CONFLICT'; end if;
 select * into d from public.signing_decisions where request_id=r.id;
 if found then
  if d.id=p_decision_id and d.actor_id=p_actor_id and d.action='approve' and d.policy_version=p_policy_version
   and exists(select 1 from public.signing_receipts receipt join public.signing_receipt_layouts layout on layout.receipt_id=receipt.id
    where receipt.decision_id=d.id and layout.layout_version='per-page-draggable-web-evidence-v2' and layout.placement_plan=p_placement_plan)
  then return private.signing_decision_receipt(r.id); end if;
  raise exception 'SIGNING_IDEMPOTENCY_CONFLICT';
 end if;
 t:=clock_timestamp();
 if r.status<>'pending' then raise exception 'SIGNING_REQUEST_NOT_ELIGIBLE'; end if;
 if r.expires_at<=t then raise exception 'SIGNING_REQUEST_EXPIRED'; end if;
 insert into public.signing_decisions(id,request_id,source_version_id,actor_id,action,reason,policy_version,consent,decided_at)
  values(p_decision_id,r.id,v.id,p_actor_id,'approve',null,p_policy_version,true,t);
 select coalesce(nullif(trim(full_name),''),'Pengguna') into signer from public.profiles where id=p_actor_id;
 select code into account_code from public.signing_user_identifiers where user_id=p_actor_id;
 opaque:=rtrim(translate(encode(extensions.gen_random_bytes(32),'base64'),'+/','-_'),'=');
 insert into public.signing_receipts(id,decision_id,request_id,source_version_id,owner_id,recipient_id,
  signer_name,signer_code,owner_name,document_title,source_sha256,policy_version,layout_version,decided_at)
  values(opaque,p_decision_id,r.id,v.id,r.owner_id,r.recipient_id,signer,account_code,r.owner_display_name,v.title,v.source_sha256,p_policy_version,'per-page-draggable-web-evidence-v2',t);
 insert into public.signing_receipt_layouts(receipt_id,placement_plan,plan_sha256)
  values(opaque,p_placement_plan,encode(extensions.digest(p_placement_plan::text,'sha256'),'hex'));
 insert into public.signing_artifacts(receipt_id) values(opaque);
 insert into private.signing_render_jobs(receipt_id) values(opaque);
 update public.signing_requests set status='consented' where id=r.id;
 insert into private.signing_audit_events(actor_id,action,document_id,version_id,request_id,confirmation_digest)
  values(p_actor_id,'approved',r.document_id,v.id,r.id,p_confirmation_digest);
 insert into public.notifications(user_id,type,title,body,target_path) values(r.owner_id,'signing_decision_recorded','Tanggapan permintaan tercatat',
  'Penerima telah menanggapi permintaan persetujuan internal. Buka riwayat privat untuk melihat hasil.','/requests/'||r.id::text);
 return private.signing_decision_receipt(r.id);
end; $$;
create function public.get_document_service_policy() returns jsonb
language sql immutable security definer set search_path='' as $$
 select jsonb_build_object('version','public-service-2026-11-17',
 'uploadPolicy','internal-upload-2026-11-17','sharingPolicy','internal-sharing-2026-11-17',
 'actionPolicy','internal-action-2026-11-17','scanRequired',true,'retention','operator-request-no-auto-delete');
$$;
revoke all on function public.get_document_service_policy() from public,anon,authenticated,service_role;
grant execute on function public.get_document_service_policy() to service_role;
notify pgrst,'reload schema';
commit;
