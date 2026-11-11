-- R2 internal approval prototype. This does not issue signatures or QR codes.
-- Actor IDs are accepted ONLY from the trusted server through service-only RPCs.
-- Legacy administrative verification tables and grants are unchanged.
begin;

create extension if not exists pgcrypto with schema extensions;

create table public.signing_user_identifiers (
  -- Trusted Auth deletion of an unused account may remove its identifier.
  -- Documents/requests/audit separately restrict deletion once history exists.
  user_id uuid primary key references auth.users(id) on delete cascade,
  code text not null unique check (code ~ '^DVP-[A-F0-9]{20}$'),
  created_at timestamptz not null default clock_timestamp()
);
create table public.signing_documents (
  id uuid primary key,
  owner_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default clock_timestamp(),
  unique (id, owner_id)
);
create table public.signing_document_versions (
  id uuid primary key,
  document_id uuid not null,
  owner_id uuid not null,
  version_no integer not null check (version_no > 0),
  title text not null check (title = trim(title) and char_length(title) between 1 and 200),
  category_id uuid not null references public.document_categories(id) on delete restrict,
  custom_document_type text check (custom_document_type is null or
    (custom_document_type = trim(custom_document_type) and char_length(custom_document_type) between 1 and 120)),
  document_date date check (document_date is null or document_date between date '0001-01-01' and date '9999-12-31'),
  issuing_institution text check (issuing_institution is null or
    (issuing_institution = trim(issuing_institution) and char_length(issuing_institution) between 1 and 200)),
  description text check (description is null or
    (description = trim(description) and char_length(description) between 1 and 2000)),
  original_filename text not null check (
    original_filename = trim(original_filename) and char_length(original_filename) between 1 and 255
    and original_filename !~ '[[:cntrl:]/\\]' and original_filename ~* '\.pdf$'),
  file_size_bytes bigint not null check (file_size_bytes between 1 and 10485760),
  source_sha256 text not null check (source_sha256 ~ '^[a-f0-9]{64}$'),
  storage_path text not null unique check (
    storage_path = owner_id::text || '/signing/' || document_id::text || '/' || id::text || '.pdf'),
  upload_policy_version text not null check (upload_policy_version = 'internal-upload-development-2026-11-05'),
  consented_at timestamptz not null,
  created_at timestamptz not null default clock_timestamp(),
  foreign key (document_id, owner_id) references public.signing_documents(id, owner_id) on delete restrict,
  unique (document_id, version_no),
  unique (id, document_id, owner_id),
  check (consented_at = created_at)
);
create table public.signing_requests (
  id uuid primary key,
  document_id uuid not null unique,
  source_version_id uuid not null,
  owner_id uuid not null references auth.users(id) on delete restrict,
  recipient_id uuid not null references auth.users(id) on delete restrict,
  owner_display_name text not null check (char_length(owner_display_name) between 1 and 120),
  recipient_display_name text not null check (char_length(recipient_display_name) between 1 and 120),
  status text not null check (status in ('pending', 'cancelled', 'rejected', 'consented', 'completed')),
  sent_at timestamptz not null,
  expires_at timestamptz not null,
  cancelled_at timestamptz,
  sharing_policy_version text not null check (sharing_policy_version = 'internal-sharing-development-2026-11-05'),
  sharing_consented_at timestamptz not null,
  foreign key (source_version_id, document_id, owner_id)
    references public.signing_document_versions(id, document_id, owner_id) on delete restrict,
  check (owner_id <> recipient_id),
  -- Exactly 168 hours, independent of the database session timezone/DST.
  check (expires_at = sent_at + interval '168 hours'),
  check (sharing_consented_at = sent_at),
  check ((status = 'cancelled' and cancelled_at is not null and cancelled_at >= sent_at and cancelled_at < expires_at)
    or (status <> 'cancelled' and cancelled_at is null))
);
create table private.signing_audit_events (
  id bigint generated always as identity primary key,
  actor_id uuid not null references auth.users(id) on delete restrict,
  action text not null check (action in ('draft_created', 'request_sent', 'request_cancelled')),
  document_id uuid not null references public.signing_documents(id) on delete restrict,
  version_id uuid not null references public.signing_document_versions(id) on delete restrict,
  request_id uuid references public.signing_requests(id) on delete restrict,
  created_at timestamptz not null default clock_timestamp(),
  check ((action = 'draft_created' and request_id is null) or (action <> 'draft_created' and request_id is not null))
);
create index signing_documents_owner_date_idx on public.signing_documents(owner_id, created_at desc, id desc);
create index signing_versions_owner_date_idx on public.signing_document_versions(owner_id, created_at desc, id desc);
create index signing_requests_owner_date_idx on public.signing_requests(owner_id, sent_at desc, id desc);
create index signing_requests_recipient_date_idx on public.signing_requests(recipient_id, sent_at desc, id desc);
create index signing_audit_document_idx on private.signing_audit_events(document_id, created_at);

alter table public.signing_user_identifiers enable row level security;
alter table public.signing_documents enable row level security;
alter table public.signing_document_versions enable row level security;
alter table public.signing_requests enable row level security;
alter table private.signing_audit_events enable row level security;
revoke all privileges on public.signing_user_identifiers, public.signing_documents,
  public.signing_document_versions, public.signing_requests, private.signing_audit_events
  from public, anon, authenticated, service_role;
revoke all privileges on sequence private.signing_audit_events_id_seq from public, anon, authenticated, service_role;
grant select on public.signing_user_identifiers, public.signing_documents,
  public.signing_document_versions, public.signing_requests to authenticated, service_role;

-- An account code is an opaque identifier, not a bearer credential. Provision
-- it even for unverified accounts; eligibility is checked separately below.
create function private.provision_signing_identifier()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_code text;
begin
  loop
    v_code := 'DVP-' || upper(encode(extensions.gen_random_bytes(10), 'hex'));
    begin
      insert into public.signing_user_identifiers(user_id, code) values (new.id, v_code);
      exit;
    exception when unique_violation then
      if exists (select 1 from public.signing_user_identifiers where user_id = new.id) then exit; end if;
    end;
  end loop;
  return new;
end;
$$;
revoke all on function private.provision_signing_identifier() from public, anon, authenticated, service_role;
create trigger on_auth_user_created_signing_identifier after insert on auth.users
for each row execute function private.provision_signing_identifier();
do $$
declare v_user record; v_code text;
begin
  for v_user in select id from auth.users order by id loop
    loop
      v_code := 'DVP-' || upper(encode(extensions.gen_random_bytes(10), 'hex'));
      begin
        insert into public.signing_user_identifiers(user_id, code) values (v_user.id, v_code);
        exit;
      exception when unique_violation then
        if exists (select 1 from public.signing_user_identifiers where user_id = v_user.id) then exit; end if;
      end;
    end loop;
  end loop;
end;
$$;

create trigger signing_identifiers_immutable before update on public.signing_user_identifiers
for each row execute function private.prevent_immutable_mutation();
create trigger signing_documents_immutable before update or delete on public.signing_documents
for each row execute function private.prevent_immutable_mutation();
create trigger signing_versions_immutable before update or delete on public.signing_document_versions
for each row execute function private.prevent_immutable_mutation();
create trigger signing_audit_immutable before update or delete on private.signing_audit_events
for each row execute function private.prevent_immutable_mutation();

create function private.guard_signing_request_history()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' then raise exception 'IMMUTABLE_RECORD'; end if;
  if (to_jsonb(new) - array['status','cancelled_at']) is distinct from
    (to_jsonb(old) - array['status','cancelled_at']) then raise exception 'IMMUTABLE_RECORD'; end if;
  if new.status = old.status and new.cancelled_at is not distinct from old.cancelled_at then return new; end if;
  if old.status = 'pending' and new.status in ('cancelled','rejected','consented') then return new; end if;
  if old.status = 'consented' and new.status = 'completed' then return new; end if;
  raise exception 'SIGNING_REQUEST_NOT_ELIGIBLE';
end;
$$;
revoke all on function private.guard_signing_request_history() from public, anon, authenticated, service_role;
create trigger signing_requests_history_guard before update or delete on public.signing_requests
for each row execute function private.guard_signing_request_history();

create function private.is_signing_user(p_user_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select p_user_id is not null and exists (
    select 1 from auth.users u where u.id = p_user_id and u.email_confirmed_at is not null
      and exists (select 1 from public.user_roles r where r.user_id = u.id and r.role = 'user'::public.app_role)
  );
$$;
revoke all on function private.is_signing_user(uuid) from public, anon, authenticated, service_role;

-- Security-definer predicates bypass recursive table policies but never use
-- caller-supplied actor IDs; authorization derives from auth.uid() only.
create function private.can_read_signing_version(p_version_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.signing_document_versions v where v.id = p_version_id and (
      v.owner_id = (select auth.uid()) or exists (
        select 1 from public.signing_requests r where r.source_version_id = v.id
          and r.recipient_id = (select auth.uid()) and (
            (r.status = 'pending' and r.expires_at > statement_timestamp())
            or r.status in ('consented', 'completed')
          )
      )
    )
  );
$$;
revoke all on function private.can_read_signing_version(uuid) from public, anon, authenticated, service_role;
grant usage on schema private to authenticated;
grant execute on function private.can_read_signing_version(uuid) to authenticated;

create policy signing_identifiers_select_own on public.signing_user_identifiers
for select to authenticated using (user_id = (select auth.uid()));
create policy signing_documents_select_participant on public.signing_documents
for select to authenticated using (owner_id = (select auth.uid()) or exists (
  select 1 from public.signing_document_versions v where v.document_id = signing_documents.id
    and private.can_read_signing_version(v.id)
));
create policy signing_versions_select_participant on public.signing_document_versions
for select to authenticated using (private.can_read_signing_version(id));
create policy signing_requests_select_participant on public.signing_requests
for select to authenticated using (owner_id = (select auth.uid()) or recipient_id = (select auth.uid()));

create function public.lookup_signing_recipient(p_actor_id uuid, p_code text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_result jsonb;
begin
  if not private.is_signing_user(p_actor_id) then raise exception 'SIGNING_ACTOR_REQUIRED' using errcode = '42501'; end if;
  if p_code is null or p_code !~ '^DVP-[A-F0-9]{20}$' then raise exception 'INVALID_SIGNING_INPUT' using errcode = '22023'; end if;
  select jsonb_build_object('id', i.user_id, 'code', i.code,
    'displayName', coalesce(nullif(trim(p.full_name), ''), 'Pengguna')) into v_result
  from public.signing_user_identifiers i join public.profiles p on p.id = i.user_id
  where i.code = p_code and i.user_id <> p_actor_id and private.is_signing_user(i.user_id);
  if v_result is null then raise exception 'SIGNING_RECIPIENT_UNAVAILABLE'; end if;
  return v_result;
end;
$$;

create function public.create_signing_draft(
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
    or p_upload_policy_version is distinct from 'internal-upload-development-2026-11-05'
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

create function private.signing_request_receipt(p_request_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('requestId', id, 'documentId', document_id, 'sourceVersionId', source_version_id,
    'status', status, 'sentAt', sent_at, 'expiresAt', expires_at, 'cancelledAt', cancelled_at)
  from public.signing_requests where id = p_request_id;
$$;
revoke all on function private.signing_request_receipt(uuid) from public, anon, authenticated, service_role;

create function public.send_signing_request(p_actor_id uuid, p_request_id uuid, p_source_version_id uuid,
  p_recipient_code text, p_recipient_id uuid, p_sharing_policy_version text, p_sharing_consent boolean)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_version public.signing_document_versions%rowtype; v_request public.signing_requests%rowtype;
  v_owner_name text; v_recipient_name text; v_now timestamptz;
begin
  if not private.is_signing_user(p_actor_id) then raise exception 'SIGNING_ACTOR_REQUIRED' using errcode = '42501'; end if;
  if p_request_id is null or p_source_version_id is null or p_recipient_id is null
    or p_recipient_code is null or p_recipient_code !~ '^DVP-[A-F0-9]{20}$'
    or p_sharing_policy_version is distinct from 'internal-sharing-development-2026-11-05'
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

create function public.cancel_signing_request(p_actor_id uuid, p_request_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_request public.signing_requests%rowtype; v_now timestamptz;
begin
  if not private.is_signing_user(p_actor_id) then raise exception 'SIGNING_ACTOR_REQUIRED' using errcode = '42501'; end if;
  if p_request_id is null then raise exception 'INVALID_SIGNING_INPUT' using errcode = '22023'; end if;
  select * into v_request from public.signing_requests where id = p_request_id and owner_id = p_actor_id;
  if not found then raise exception 'SIGNING_NOT_FOUND' using errcode = 'P0002'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('signing-document:' || v_request.document_id::text, 0));
  select * into v_request from public.signing_requests where id = p_request_id and owner_id = p_actor_id for update;
  if v_request.status = 'cancelled' then return private.signing_request_receipt(p_request_id); end if;
  if v_request.status <> 'pending' then raise exception 'SIGNING_REQUEST_NOT_ELIGIBLE'; end if;
  v_now := clock_timestamp();
  if v_request.expires_at <= v_now then raise exception 'SIGNING_REQUEST_EXPIRED'; end if;
  update public.signing_requests set status = 'cancelled', cancelled_at = v_now where id = p_request_id;
  insert into private.signing_audit_events(actor_id, action, document_id, version_id, request_id)
  values (p_actor_id, 'request_cancelled', v_request.document_id, v_request.source_version_id, p_request_id);
  insert into public.notifications(user_id, type, title, body, target_path)
  values (v_request.recipient_id, 'signing_request_cancelled', 'Permintaan dibatalkan',
    'Pemilik telah membatalkan permintaan persetujuan. Akses penerima ke dokumen telah berakhir.', '/requests/' || p_request_id::text);
  return private.signing_request_receipt(p_request_id);
end;
$$;

create function public.consume_signing_operation_limit(p_action text, p_key_digest text, p_global_digest text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_limit integer; v_global_limit integer; v_now timestamptz;
  v_user_hits integer; v_user_started timestamptz; v_global_hits integer; v_global_started timestamptz;
begin
  if p_action is null or p_action not in ('lookup','send','cancel')
    or p_key_digest is null or p_key_digest !~ '^[a-f0-9]{64}$'
    or p_global_digest is null or p_global_digest !~ '^[a-f0-9]{64}$' then
    raise exception 'INVALID_SIGNING_INPUT' using errcode = '22023';
  end if;
  v_limit := case p_action when 'send' then 10 else 20 end;
  v_global_limit := case p_action when 'send' then 50 else 100 end;
  perform pg_catalog.pg_advisory_xact_lock(1146507344, 5009);
  v_now := clock_timestamp();
  delete from private.auth_rate_limits where action in ('signing_lookup','signing_lookup_global',
    'signing_send','signing_send_global','signing_cancel','signing_cancel_global') and window_started_at < v_now - interval '1 day';
  select hits, window_started_at into v_global_hits, v_global_started from private.auth_rate_limits
    where action = 'signing_' || p_action || '_global' and key_digest = p_global_digest;
  if v_global_started is null or v_global_started <= v_now - interval '15 minutes' then
    v_global_hits := 0; v_global_started := v_now;
  end if;
  if v_global_hits >= v_global_limit then return false; end if;
  select hits, window_started_at into v_user_hits, v_user_started from private.auth_rate_limits
    where action = 'signing_' || p_action and key_digest = p_key_digest;
  if v_user_started is null or v_user_started <= v_now - interval '15 minutes' then
    v_user_hits := 0; v_user_started := v_now;
  end if;
  if v_user_hits >= v_limit then return false; end if;
  insert into private.auth_rate_limits(action, key_digest, hits, window_started_at)
  values ('signing_' || p_action || '_global', p_global_digest, v_global_hits + 1, v_global_started)
  on conflict (action, key_digest) do update set hits = excluded.hits, window_started_at = excluded.window_started_at;
  insert into private.auth_rate_limits(action, key_digest, hits, window_started_at)
  values ('signing_' || p_action, p_key_digest, v_user_hits + 1, v_user_started)
  on conflict (action, key_digest) do update set hits = excluded.hits, window_started_at = excluded.window_started_at;
  return true;
end;
$$;

revoke all on function public.lookup_signing_recipient(uuid,text),
  public.create_signing_draft(uuid,uuid,uuid,text,uuid,text,date,text,text,text,bigint,text,text,text,boolean),
  public.send_signing_request(uuid,uuid,uuid,text,uuid,text,boolean),
  public.cancel_signing_request(uuid,uuid), public.consume_signing_operation_limit(text,text,text)
from public, anon, authenticated, service_role;
grant execute on function public.lookup_signing_recipient(uuid,text),
  public.create_signing_draft(uuid,uuid,uuid,text,uuid,text,date,text,text,text,bigint,text,text,text,boolean),
  public.send_signing_request(uuid,uuid,uuid,text,uuid,text,boolean),
  public.cancel_signing_request(uuid,uuid), public.consume_signing_operation_limit(text,text,text)
to service_role;

commit;
