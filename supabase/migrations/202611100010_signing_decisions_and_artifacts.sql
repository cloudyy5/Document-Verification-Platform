-- R3: explicit authenticated decisions (no password reauthentication), immutable
-- approval receipts and recoverable rendering. Only trusted server RPCs mutate.
begin;

-- Derived PDFs have a separate bounded private bucket; input remains 10 MiB.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
  values('signing-results','signing-results',false,20971520,array['application/pdf']) on conflict(id) do nothing;
do $$ begin
  if not exists(select 1 from storage.buckets where id='signing-results' and public=false
    and file_size_limit=20971520 and allowed_mime_types=array['application/pdf']) then
    raise exception 'SIGNING_RESULT_BUCKET_CONFIGURATION_REQUIRED';
  end if;
end; $$;

alter table public.signing_requests add constraint signing_requests_decision_binding
  unique (id, source_version_id, recipient_id);
alter table public.signing_requests add constraint signing_requests_receipt_binding
  unique (id, source_version_id, owner_id, recipient_id);

create table public.signing_decisions (
  id uuid primary key,
  request_id uuid not null unique,
  source_version_id uuid not null,
  actor_id uuid not null references auth.users(id) on delete restrict,
  action text not null check (action in ('approve','reject')),
  reason text,
  policy_version text not null check (policy_version = 'internal-action-development-2026-11-05'),
  consent boolean not null,
  authentication_method text not null default 'session_explicit_confirmation-v1'
    check (authentication_method = 'session_explicit_confirmation-v1'),
  decided_at timestamptz not null,
  foreign key (request_id,source_version_id,actor_id)
    references public.signing_requests(id,source_version_id,recipient_id) on delete restrict,
  unique(id,request_id,source_version_id,actor_id,action),
  check ((action='approve' and consent and reason is null) or
    (action='reject' and not consent and reason=trim(reason) and char_length(reason) between 1 and 1000 and reason is not null))
);
create table public.signing_receipts (
  id text primary key check (id ~ '^[A-Za-z0-9_-]{43}$'),
  decision_id uuid not null unique,
  request_id uuid not null unique,
  source_version_id uuid not null,
  owner_id uuid not null,
  recipient_id uuid not null,
  decision_action text not null default 'approve' check (decision_action='approve'),
  signer_name text not null check (char_length(signer_name) between 1 and 120),
  signer_code text not null check (signer_code ~ '^DVP-[A-F0-9]{20}$'),
  owner_name text not null check (char_length(owner_name) between 1 and 120),
  document_title text not null check (char_length(document_title) between 1 and 200),
  source_sha256 text not null check (source_sha256 ~ '^[a-f0-9]{64}$'),
  policy_version text not null check (policy_version='internal-action-development-2026-11-05'),
  layout_version text not null default 'all-pages-bottom-left-and-evidence-v1'
    check (layout_version='all-pages-bottom-left-and-evidence-v1'),
  decided_at timestamptz not null,
  foreign key(decision_id,request_id,source_version_id,recipient_id,decision_action)
    references public.signing_decisions(id,request_id,source_version_id,actor_id,action) on delete restrict,
  foreign key(request_id,source_version_id,owner_id,recipient_id)
    references public.signing_requests(id,source_version_id,owner_id,recipient_id) on delete restrict
);
create table public.signing_artifacts (
  receipt_id text primary key references public.signing_receipts(id) on delete restrict,
  state text not null default 'pending' check (state in ('pending','processing','failed','ready')),
  storage_path text unique,
  file_size_bytes bigint,
  artifact_sha256 text,
  page_count integer,
  failure_code text check (failure_code is null or failure_code in ('RENDER_FAILED','RENDER_LIMIT','SOURCE_UNAVAILABLE','STORAGE_UNAVAILABLE')),
  ready_at timestamptz,
  updated_at timestamptz not null default clock_timestamp(),
  check ((state='ready' and storage_path is not null and file_size_bytes is not null and file_size_bytes between 1 and 20971520
    and artifact_sha256 ~ '^[a-f0-9]{64}$' and artifact_sha256 is not null
    and page_count > 1 and page_count is not null and ready_at is not null and failure_code is null)
    or (state<>'ready' and storage_path is null and file_size_bytes is null and artifact_sha256 is null
      and page_count is null and ready_at is null)),
  check ((state='failed' and failure_code is not null) or (state<>'failed' and failure_code is null))
);
create table private.signing_render_jobs (
  receipt_id text primary key references public.signing_receipts(id) on delete restrict,
  claim_token uuid,
  lease_until timestamptz,
  attempts integer not null default 0 check (attempts>=0),
  check ((claim_token is null) = (lease_until is null))
);
alter table public.signing_decisions enable row level security;
alter table public.signing_receipts enable row level security;
alter table public.signing_artifacts enable row level security;
alter table private.signing_render_jobs enable row level security;
revoke all on public.signing_decisions,public.signing_receipts,public.signing_artifacts,
  private.signing_render_jobs from public,anon,authenticated,service_role;
grant select on public.signing_decisions,public.signing_receipts,public.signing_artifacts to authenticated,service_role;
create policy signing_decisions_participant on public.signing_decisions for select to authenticated using (
  exists (select 1 from public.signing_requests r where r.id=request_id and
    (r.owner_id=(select auth.uid()) or r.recipient_id=(select auth.uid())))
);
create policy signing_receipts_participant on public.signing_receipts for select to authenticated
  using (owner_id=(select auth.uid()) or recipient_id=(select auth.uid()));
create policy signing_artifacts_participant on public.signing_artifacts for select to authenticated
  using (exists(select 1 from public.signing_receipts r where r.id=receipt_id));
create trigger signing_decisions_immutable before update or delete on public.signing_decisions
  for each row execute function private.prevent_immutable_mutation();
create trigger signing_receipts_immutable before update or delete on public.signing_receipts
  for each row execute function private.prevent_immutable_mutation();
create function private.guard_signing_artifact() returns trigger language plpgsql set search_path='' as $$
begin
  if tg_op='DELETE' or old.state='ready' or new.receipt_id<>old.receipt_id then raise exception 'IMMUTABLE_RECORD'; end if;
  return new;
end; $$;
revoke all on function private.guard_signing_artifact() from public,anon,authenticated,service_role;
create trigger signing_artifacts_guard before update or delete on public.signing_artifacts
  for each row execute function private.guard_signing_artifact();
alter table private.signing_audit_events drop constraint signing_audit_events_action_check;
alter table private.signing_audit_events add constraint signing_audit_events_action_check
  check (action in ('draft_created','request_sent','request_cancelled','approved','rejected','render_started','render_failed','render_ready'));
alter table private.signing_audit_events add column confirmation_digest text
  check (confirmation_digest is null or confirmation_digest ~ '^[a-f0-9]{64}$');

create function private.signing_decision_receipt(p_request_id uuid) returns jsonb
language sql stable security definer set search_path='' as $$
  select jsonb_build_object('decisionId',d.id,'requestId',d.request_id,'sourceVersionId',d.source_version_id,
    'action',d.action,'reason',d.reason,'decidedAt',d.decided_at,'receiptId',r.id)
  from public.signing_decisions d left join public.signing_receipts r on r.decision_id=d.id
  where d.request_id=p_request_id;
$$;
revoke all on function private.signing_decision_receipt(uuid) from public,anon,authenticated,service_role;

create function public.decide_signing_request(p_actor_id uuid,p_request_id uuid,p_decision_id uuid,
  p_source_version_id uuid,p_source_sha256 text,p_action text,p_reason text,p_policy_version text,
  p_consent boolean,p_confirmed boolean,p_confirmation_digest text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.signing_requests%rowtype; v public.signing_document_versions%rowtype;
  d public.signing_decisions%rowtype; t timestamptz; opaque text; signer text; signer_code text;
begin
  if not private.is_signing_user(p_actor_id) then raise exception 'SIGNING_ACTOR_REQUIRED' using errcode='42501'; end if;
  if p_request_id is null or p_decision_id is null or p_source_version_id is null
    or p_action is null or p_action not in ('approve','reject') or p_confirmed is distinct from true
    or p_policy_version is distinct from 'internal-action-development-2026-11-05'
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

create function public.claim_signing_render(p_actor_id uuid,p_receipt_id text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r public.signing_receipts%rowtype; a public.signing_artifacts%rowtype; j private.signing_render_jobs%rowtype; token uuid;
begin
  if not private.is_signing_user(p_actor_id) then raise exception 'SIGNING_ACTOR_REQUIRED' using errcode='42501'; end if;
  select * into r from public.signing_receipts where id=p_receipt_id and p_actor_id in (owner_id,recipient_id);
  if not found then raise exception 'SIGNING_NOT_FOUND' using errcode='P0002'; end if;
  select * into a from public.signing_artifacts where receipt_id=r.id for update;
  select * into j from private.signing_render_jobs where receipt_id=r.id for update;
  if a.state='ready' then return jsonb_build_object('state','ready'); end if;
  if a.state='processing' and j.lease_until>clock_timestamp() then return jsonb_build_object('state','processing'); end if;
  token:=pg_catalog.gen_random_uuid();
  update private.signing_render_jobs set claim_token=token,lease_until=clock_timestamp()+interval '5 minutes',attempts=attempts+1 where receipt_id=r.id;
  update public.signing_artifacts set state='processing',failure_code=null,updated_at=clock_timestamp() where receipt_id=r.id;
  insert into private.signing_audit_events(actor_id,action,document_id,version_id,request_id)
    select p_actor_id,'render_started',document_id,source_version_id,id from public.signing_requests where id=r.request_id;
  return jsonb_build_object('state','processing','claimToken',token);
end; $$;

create function public.complete_signing_render(p_actor_id uuid,p_receipt_id text,p_claim_token uuid,
  p_storage_path text,p_file_size_bytes bigint,p_artifact_sha256 text,p_page_count integer) returns boolean
language plpgsql security definer set search_path='' as $$
declare r public.signing_receipts%rowtype; a public.signing_artifacts%rowtype; j private.signing_render_jobs%rowtype;
begin
  if not private.is_signing_user(p_actor_id) then raise exception 'SIGNING_ACTOR_REQUIRED' using errcode='42501'; end if;
  select * into r from public.signing_receipts where id=p_receipt_id and p_actor_id in (owner_id,recipient_id);
  if not found then raise exception 'SIGNING_NOT_FOUND' using errcode='P0002'; end if;
  if p_claim_token is null or p_storage_path is distinct from r.owner_id::text||'/signing-results/'||r.id||'/'||p_claim_token::text||'.pdf'
    or p_file_size_bytes is null or p_file_size_bytes not between 1 and 20971520
    or p_artifact_sha256 is null or p_artifact_sha256 !~ '^[a-f0-9]{64}$' or p_page_count is null or p_page_count<2
  then raise exception 'INVALID_SIGNING_INPUT' using errcode='22023'; end if;
  select * into a from public.signing_artifacts where receipt_id=r.id for update;
  if a.state='ready' then
    if a.storage_path=p_storage_path and a.artifact_sha256=p_artifact_sha256 and a.file_size_bytes=p_file_size_bytes and a.page_count=p_page_count then return true; end if;
    raise exception 'SIGNING_IDEMPOTENCY_CONFLICT';
  end if;
  select * into j from private.signing_render_jobs where receipt_id=r.id for update;
  if a.state<>'processing' or j.claim_token is distinct from p_claim_token or j.lease_until<=clock_timestamp() then raise exception 'SIGNING_RENDER_CLAIM_EXPIRED'; end if;
  if not exists(select 1 from storage.objects where bucket_id='signing-results' and name=p_storage_path) then
    raise exception 'INVALID_SIGNING_INPUT' using errcode='22023'; end if;
  update public.signing_artifacts set state='ready',storage_path=p_storage_path,file_size_bytes=p_file_size_bytes,
    artifact_sha256=p_artifact_sha256,page_count=p_page_count,ready_at=clock_timestamp(),updated_at=clock_timestamp() where receipt_id=r.id;
  update private.signing_render_jobs set claim_token=null,lease_until=null where receipt_id=r.id;
  update public.signing_requests set status='completed' where id=r.request_id and status='consented';
  insert into private.signing_audit_events(actor_id,action,document_id,version_id,request_id)
    select p_actor_id,'render_ready',document_id,source_version_id,id from public.signing_requests where id=r.request_id;
  return true;
end; $$;

create function public.fail_signing_render(p_actor_id uuid,p_receipt_id text,p_claim_token uuid,p_failure_code text) returns boolean
language plpgsql security definer set search_path='' as $$
declare r public.signing_receipts%rowtype; a public.signing_artifacts%rowtype;
begin
  if not private.is_signing_user(p_actor_id) then raise exception 'SIGNING_ACTOR_REQUIRED' using errcode='42501'; end if;
  select * into r from public.signing_receipts where id=p_receipt_id and p_actor_id in(owner_id,recipient_id);
  if not found then raise exception 'SIGNING_NOT_FOUND' using errcode='P0002'; end if;
  if p_failure_code is null or p_failure_code not in ('RENDER_FAILED','RENDER_LIMIT','SOURCE_UNAVAILABLE','STORAGE_UNAVAILABLE') then
    raise exception 'INVALID_SIGNING_INPUT' using errcode='22023'; end if;
  select * into a from public.signing_artifacts where receipt_id=r.id for update;
  if a.state='ready' then return false; end if;
  perform 1 from private.signing_render_jobs where receipt_id=r.id and claim_token=p_claim_token for update;
  if not found then return false; end if;
  update public.signing_artifacts set state='failed',failure_code=p_failure_code,updated_at=clock_timestamp() where receipt_id=r.id;
  update private.signing_render_jobs set claim_token=null,lease_until=null where receipt_id=r.id;
  insert into private.signing_audit_events(actor_id,action,document_id,version_id,request_id)
    select p_actor_id,'render_failed',document_id,source_version_id,id from public.signing_requests where id=r.request_id;
  return true;
end; $$;

create function public.consume_signing_r3_limit(p_action text,p_key_digest text,p_global_digest text) returns boolean
language plpgsql security definer set search_path='' as $$
declare t timestamptz; hits integer; started timestamptz; item record; cap integer;
begin
  if p_action is null or p_action not in('decision','render') or p_key_digest is null or p_key_digest !~ '^[a-f0-9]{64}$'
    or p_global_digest is null or p_global_digest !~ '^[a-f0-9]{64}$' then raise exception 'INVALID_SIGNING_INPUT' using errcode='22023'; end if;
  perform pg_catalog.pg_advisory_xact_lock(1146507344,5010);
  t:=clock_timestamp();
  for item in select * from (values('signing_r3_'||p_action,p_key_digest,10),('signing_r3_'||p_action||'_global',p_global_digest,50)) as x(action,digest,max_hits) loop
    select l.hits,l.window_started_at into hits,started from private.auth_rate_limits l where l.action=item.action and l.key_digest=item.digest;
    if started is not null and started>t-interval '15 minutes' and hits>=item.max_hits then return false; end if;
  end loop;
  delete from private.auth_rate_limits where action in('signing_r3_decision','signing_r3_render','signing_r3_decision_global','signing_r3_render_global') and window_started_at<t-interval '1 day';
  for item in select * from (values('signing_r3_'||p_action,p_key_digest),('signing_r3_'||p_action||'_global',p_global_digest)) as x(action,digest) loop
    insert into private.auth_rate_limits(action,key_digest,hits,window_started_at) values(item.action,item.digest,1,t)
    on conflict(action,key_digest) do update set hits=case when private.auth_rate_limits.window_started_at<=t-interval '15 minutes' then 1 else private.auth_rate_limits.hits+1 end,
      window_started_at=case when private.auth_rate_limits.window_started_at<=t-interval '15 minutes' then t else private.auth_rate_limits.window_started_at end;
  end loop;
  return true;
end; $$;

revoke all on function public.decide_signing_request(uuid,uuid,uuid,uuid,text,text,text,text,boolean,boolean,text),
  public.claim_signing_render(uuid,text),public.complete_signing_render(uuid,text,uuid,text,bigint,text,integer),
  public.fail_signing_render(uuid,text,uuid,text),public.consume_signing_r3_limit(text,text,text)
  from public,anon,authenticated,service_role;
grant execute on function public.decide_signing_request(uuid,uuid,uuid,uuid,text,text,text,text,boolean,boolean,text),
  public.claim_signing_render(uuid,text),public.complete_signing_render(uuid,text,uuid,text,bigint,text,integer),
  public.fail_signing_render(uuid,text,uuid,text),public.consume_signing_r3_limit(text,text,text) to service_role;
commit;
