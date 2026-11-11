-- R3b: recipient-selected positions on every original page; web-only evidence.
-- Historical receipt/layout/artifact rows remain immutable and unchanged.
begin;
alter table public.signing_receipts drop constraint signing_receipts_layout_version_check;
alter table public.signing_receipts add constraint signing_receipts_layout_version_check
 check(layout_version in('all-pages-bottom-left-and-evidence-v1','per-page-draggable-web-evidence-v2'));
alter table public.signing_receipts add constraint signing_receipts_layout_binding unique(id,layout_version);

create function private.valid_signing_placement_plan(p_plan jsonb) returns boolean
language plpgsql immutable set search_path='' as $$
declare item jsonb; n bigint; k text;
begin
 if jsonb_typeof(p_plan) is distinct from 'array' then return false; end if;
 if jsonb_array_length(p_plan) not between 1 and 2000 or octet_length(p_plan::text)>524288 then return false; end if;
 for item,n in select value,ordinality from jsonb_array_elements(p_plan) with ordinality loop
  if jsonb_typeof(item) is distinct from 'object' then return false; end if;
  if (select count(*) from jsonb_object_keys(item))<>7 then return false; end if;
  foreach k in array array['page','x','y','widthPt','heightPt','rotation','userUnit'] loop
   if jsonb_typeof(item->k) is distinct from 'number' then return false; end if;
  end loop;
  if (item->>'page')::numeric<>n or (item->>'widthPt')::numeric not between 90 and 14400
   or (item->>'heightPt')::numeric not between 90 and 14400 or (item->>'userUnit')::numeric not between .01 and 100
   or (item->>'rotation')::numeric not in(0,90,180,270) or (item->>'x')::numeric<0 or (item->>'y')::numeric<0
   or (item->>'x')::numeric+90/(item->>'widthPt')::numeric>1.000000001
   or (item->>'y')::numeric+90/(item->>'heightPt')::numeric>1.000000001 then return false; end if;
 end loop;
 return true;
end; $$;
revoke all on function private.valid_signing_placement_plan(jsonb) from public,anon,authenticated,service_role;

create table public.signing_receipt_layouts (
 receipt_id text primary key,
 layout_version text not null default 'per-page-draggable-web-evidence-v2' check(layout_version='per-page-draggable-web-evidence-v2'),
 placement_plan jsonb not null check(private.valid_signing_placement_plan(placement_plan)),
 plan_sha256 text not null check(plan_sha256=encode(extensions.digest(placement_plan::text,'sha256'),'hex')),
 foreign key(receipt_id,layout_version) references public.signing_receipts(id,layout_version) on delete restrict
);
alter table public.signing_receipt_layouts enable row level security;
revoke all on public.signing_receipt_layouts from public,anon,authenticated,service_role;
grant select on public.signing_receipt_layouts to authenticated,service_role;
create policy signing_receipt_layouts_participant on public.signing_receipt_layouts for select to authenticated
 using(exists(select 1 from public.signing_receipts r where r.id=receipt_id));
create trigger signing_receipt_layouts_immutable before update or delete on public.signing_receipt_layouts
 for each row execute function private.prevent_immutable_mutation();

-- V2 can have one source/result page. Legacy finalization still requires >=2.
alter table public.signing_artifacts drop constraint signing_artifacts_check;
alter table public.signing_artifacts add constraint signing_artifacts_ready_metadata_check check (
 (state='ready' and storage_path is not null and file_size_bytes is not null and file_size_bytes between 1 and 20971520
 and artifact_sha256 ~ '^[a-f0-9]{64}$' and artifact_sha256 is not null and page_count>0 and page_count is not null and ready_at is not null and failure_code is null)
 or (state<>'ready' and storage_path is null and file_size_bytes is null and artifact_sha256 is null and page_count is null and ready_at is null)
);

create function public.approve_signing_request_with_placement(p_actor_id uuid,p_request_id uuid,p_decision_id uuid,
 p_source_version_id uuid,p_source_sha256 text,p_policy_version text,p_consent boolean,p_confirmed boolean,
 p_confirmation_digest text,p_placement_plan jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.signing_requests%rowtype; v public.signing_document_versions%rowtype;
 d public.signing_decisions%rowtype; t timestamptz; opaque text; signer text; account_code text;
begin
 if not private.is_signing_user(p_actor_id) then raise exception 'SIGNING_ACTOR_REQUIRED' using errcode='42501'; end if;
 if p_request_id is null or p_decision_id is null or p_source_version_id is null or p_confirmed is distinct from true
  or p_consent is distinct from true or p_policy_version is distinct from 'internal-action-development-2026-11-05'
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
  if d.id=p_decision_id and d.actor_id=p_actor_id and d.action='approve'
   and exists(select 1 from public.signing_receipts receipt join public.signing_receipt_layouts layout on layout.receipt_id=receipt.id
    where receipt.decision_id=d.id and layout.placement_plan=p_placement_plan)
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
revoke all on function public.approve_signing_request_with_placement(uuid,uuid,uuid,uuid,text,text,boolean,boolean,text,jsonb) from public,anon,authenticated;
grant execute on function public.approve_signing_request_with_placement(uuid,uuid,uuid,uuid,text,text,boolean,boolean,text,jsonb) to service_role;

create or replace function public.complete_signing_render(p_actor_id uuid,p_receipt_id text,p_claim_token uuid,
 p_storage_path text,p_file_size_bytes bigint,p_artifact_sha256 text,p_page_count integer) returns boolean
language plpgsql security definer set search_path='' as $$
declare r public.signing_receipts%rowtype; a public.signing_artifacts%rowtype; j private.signing_render_jobs%rowtype; expected_pages integer;
begin
 if not private.is_signing_user(p_actor_id) then raise exception 'SIGNING_ACTOR_REQUIRED' using errcode='42501'; end if;
 select * into r from public.signing_receipts where id=p_receipt_id and p_actor_id in(owner_id,recipient_id);
 if not found then raise exception 'SIGNING_NOT_FOUND' using errcode='P0002'; end if;
 if r.layout_version='per-page-draggable-web-evidence-v2' then
  select jsonb_array_length(placement_plan) into expected_pages from public.signing_receipt_layouts where receipt_id=r.id;
  if expected_pages is null or p_page_count is distinct from expected_pages then raise exception 'INVALID_SIGNING_INPUT' using errcode='22023'; end if;
 elsif p_page_count is null or p_page_count<2 then raise exception 'INVALID_SIGNING_INPUT' using errcode='22023'; end if;
 if p_claim_token is null or p_storage_path is distinct from r.owner_id::text||'/signing-results/'||r.id||'/'||p_claim_token::text||'.pdf'
  or p_file_size_bytes is null or p_file_size_bytes not between 1 and 20971520 or p_artifact_sha256 is null or p_artifact_sha256 !~ '^[a-f0-9]{64}$'
 then raise exception 'INVALID_SIGNING_INPUT' using errcode='22023'; end if;
 select * into a from public.signing_artifacts where receipt_id=r.id for update;
 if a.state='ready' then
  if a.storage_path=p_storage_path and a.artifact_sha256=p_artifact_sha256 and a.file_size_bytes=p_file_size_bytes and a.page_count=p_page_count then return true; end if;
  raise exception 'SIGNING_IDEMPOTENCY_CONFLICT';
 end if;
 select * into j from private.signing_render_jobs where receipt_id=r.id for update;
 if a.state<>'processing' or j.claim_token is distinct from p_claim_token or j.lease_until<=clock_timestamp() then raise exception 'SIGNING_RENDER_CLAIM_EXPIRED'; end if;
 if not exists(select 1 from storage.objects where bucket_id='signing-results' and name=p_storage_path) then raise exception 'INVALID_SIGNING_INPUT' using errcode='22023'; end if;
 update public.signing_artifacts set state='ready',storage_path=p_storage_path,file_size_bytes=p_file_size_bytes,artifact_sha256=p_artifact_sha256,
  page_count=p_page_count,ready_at=clock_timestamp(),updated_at=clock_timestamp() where receipt_id=r.id;
 update private.signing_render_jobs set claim_token=null,lease_until=null where receipt_id=r.id;
 update public.signing_requests set status='completed' where id=r.request_id and status='consented';
 insert into private.signing_audit_events(actor_id,action,document_id,version_id,request_id)
  select p_actor_id,'render_ready',document_id,source_version_id,id from public.signing_requests where id=r.request_id;
 return true;
end; $$;
revoke all on function public.complete_signing_render(uuid,text,uuid,text,bigint,text,integer) from public,anon,authenticated;
grant execute on function public.complete_signing_render(uuid,text,uuid,text,bigint,text,integer) to service_role;
notify pgrst,'reload schema';
commit;
