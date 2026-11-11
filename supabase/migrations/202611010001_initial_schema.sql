-- Document Verification Platform — initial schema
-- Review this migration in a local Supabase project before staging/production.
-- All timestamps are stored as timestamptz (UTC).

begin;

create schema if not exists private;

do $$ begin
  create type public.app_role as enum ('user', 'reviewer', 'platform_admin');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.document_status as enum (
    'pending_review', 'revision_requested', 'rejected', 'approved', 'revoked'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.submission_status as enum (
    'pending_review', 'revision_requested', 'rejected', 'approved'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.review_decision_type as enum (
    'approved', 'revision_requested', 'rejected'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.verification_method as enum ('qr', 'code', 'hash');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.verification_result as enum (
    'single_match', 'multiple_matches', 'no_match', 'revoked_match', 'invalid_file', 'error'
  );
exception when duplicate_object then null;
end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text check (full_name is null or char_length(full_name) <= 120),
  phone text check (phone is null or char_length(phone) <= 40),
  avatar_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_roles (
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  granted_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (user_id, role)
);

create table if not exists public.document_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 80),
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  is_active boolean not null default true,
  is_system boolean not null default false,
  display_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete restrict,
  current_version_no integer not null default 1 check (current_version_no > 0),
  current_status public.document_status not null default 'pending_review',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  registered_at timestamptz,
  revoked_at timestamptz,
  revoked_by uuid references auth.users(id) on delete set null,
  revocation_reason text,
  constraint documents_revocation_state_check check (
    (current_status = 'revoked'
      and revoked_at is not null
      and revoked_by is not null
      and nullif(trim(revocation_reason), '') is not null)
    or
    (current_status <> 'revoked' and revoked_at is null)
  )
);

create table if not exists public.document_submissions (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete restrict,
  version_no integer not null check (version_no > 0),
  status public.submission_status not null default 'pending_review',
  submitted_by uuid not null references auth.users(id) on delete restrict,

  title text not null check (char_length(trim(title)) between 1 and 200),
  category_id uuid not null references public.document_categories(id) on delete restrict,
  custom_document_type text check (
    custom_document_type is null or char_length(trim(custom_document_type)) <= 120
  ),
  document_date date,
  issuing_institution text check (
    issuing_institution is null or char_length(trim(issuing_institution)) <= 200
  ),
  description text check (description is null or char_length(description) <= 2000),

  original_filename text not null check (char_length(original_filename) between 1 and 255),
  mime_type text not null check (mime_type = 'application/pdf'),
  file_size_bytes bigint not null check (file_size_bytes > 0),
  sha256 char(64) not null check (sha256 ~ '^[a-f0-9]{64}$'),
  storage_bucket text not null default 'document-submissions',
  storage_path text not null unique,

  policy_version text not null,
  consented_at timestamptz not null,
  submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),

  constraint document_submission_version_unique unique (document_id, version_no),
  constraint document_submission_storage_unique unique (storage_bucket, storage_path)
);

create table if not exists public.review_decisions (
  submission_id uuid primary key references public.document_submissions(id) on delete restrict,
  reviewer_id uuid not null references auth.users(id) on delete restrict,
  decision public.review_decision_type not null,
  checklist jsonb not null,
  decision_note text,
  created_at timestamptz not null default now(),

  constraint review_checklist_object check (jsonb_typeof(checklist) = 'object'),
  constraint review_checklist_keys check (
    jsonb_typeof(checklist -> 'completeness') = 'boolean'
    and jsonb_typeof(checklist -> 'readability') = 'boolean'
    and jsonb_typeof(checklist -> 'category_match') = 'boolean'
    and jsonb_typeof(checklist -> 'registration_eligibility') = 'boolean'
  ),
  constraint review_approval_all_pass check (
    decision <> 'approved'
    or (
      checklist ->> 'completeness' = 'true'
      and checklist ->> 'readability' = 'true'
      and checklist ->> 'category_match' = 'true'
      and checklist ->> 'registration_eligibility' = 'true'
    )
  ),
  constraint review_nonapproval_has_note check (
    decision = 'approved' or nullif(trim(decision_note), '') is not null
  ),
  constraint review_nonapproval_has_failure check (
    decision = 'approved'
    or (
      checklist ->> 'completeness' = 'false'
      or checklist ->> 'readability' = 'false'
      or checklist ->> 'category_match' = 'false'
      or checklist ->> 'registration_eligibility' = 'false'
    )
  )
);

create table if not exists public.verification_credentials (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null unique references public.documents(id) on delete restrict,
  code_digest char(64) not null unique check (code_digest ~ '^[a-f0-9]{64}$'),
  key_version smallint not null default 1 check (key_version > 0),
  issued_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (char_length(type) between 1 and 80),
  title text not null check (char_length(title) between 1 and 160),
  body text not null check (char_length(body) <= 1000),
  target_path text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id bigint generated always as identity primary key,
  actor_user_id uuid,
  actor_role text,
  action text not null,
  resource_type text,
  resource_id uuid,
  outcome text not null default 'success',
  request_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.verification_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  method public.verification_method not null,
  result public.verification_result not null,
  matched_count integer not null default 0 check (matched_count >= 0),
  created_at timestamptz not null default now()
);

-- Indexes for common filters and RLS predicates.
create index if not exists documents_owner_status_updated_idx
  on public.documents (owner_id, current_status, updated_at desc);

create index if not exists submissions_document_version_idx
  on public.document_submissions (document_id, version_no desc);

create index if not exists submissions_status_date_idx
  on public.document_submissions (status, submitted_at asc);

create index if not exists submissions_hash_idx
  on public.document_submissions (sha256);

create index if not exists submissions_category_date_idx
  on public.document_submissions (category_id, submitted_at desc);

create index if not exists review_decisions_reviewer_date_idx
  on public.review_decisions (reviewer_id, created_at desc);

create index if not exists notifications_user_date_idx
  on public.notifications (user_id, created_at desc);

create index if not exists audit_logs_resource_date_idx
  on public.audit_logs (resource_type, resource_id, created_at desc);

create index if not exists verification_events_user_date_idx
  on public.verification_events (user_id, created_at desc);

-- Generic updated_at trigger.
create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function private.set_updated_at() from public, anon, authenticated;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function private.set_updated_at();

drop trigger if exists documents_set_updated_at on public.documents;
create trigger documents_set_updated_at
before update on public.documents
for each row execute function private.set_updated_at();

-- Default new accounts to the normal user role only.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (
    new.id,
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), '')
  )
  on conflict (id) do nothing;

  insert into public.user_roles (user_id, role)
  values (new.id, 'user'::public.app_role)
  on conflict (user_id, role) do nothing;

  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- RLS helper: role checks are evaluated by a tightly scoped security-definer function.
create or replace function private.has_role(required_role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = (select auth.uid())
      and ur.role = required_role
  );
$$;

revoke all on function private.has_role(public.app_role) from public;
grant usage on schema private to authenticated;
grant execute on function private.has_role(public.app_role) to authenticated;

-- Enable RLS.
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.document_categories enable row level security;
alter table public.documents enable row level security;
alter table public.document_submissions enable row level security;
alter table public.review_decisions enable row level security;
alter table public.verification_credentials enable row level security;
alter table public.notifications enable row level security;
alter table public.audit_logs enable row level security;
alter table public.verification_events enable row level security;

-- Profiles: owner only.
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
for select to authenticated
using (id = (select auth.uid()));

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
for update to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

-- Roles: users can see their own role rows; platform admins can inspect roles.
drop policy if exists user_roles_select_own_or_admin on public.user_roles;
create policy user_roles_select_own_or_admin on public.user_roles
for select to authenticated
using (
  user_id = (select auth.uid())
  or private.has_role('platform_admin'::public.app_role)
);

-- Categories: active categories are readable by authenticated users.
drop policy if exists categories_select_active on public.document_categories;
create policy categories_select_active on public.document_categories
for select to authenticated
using (is_active = true or private.has_role('platform_admin'::public.app_role));

-- Documents: owner or reviewer. Platform admin alone is not reviewer access.
drop policy if exists documents_select_owner on public.documents;
create policy documents_select_owner on public.documents
for select to authenticated
using (owner_id = (select auth.uid()));

drop policy if exists documents_select_reviewer on public.documents;
create policy documents_select_reviewer on public.documents
for select to authenticated
using (private.has_role('reviewer'::public.app_role));

-- Submissions: owner or reviewer.
drop policy if exists submissions_select_owner on public.document_submissions;
create policy submissions_select_owner on public.document_submissions
for select to authenticated
using (
  exists (
    select 1
    from public.documents d
    where d.id = document_id
      and d.owner_id = (select auth.uid())
  )
);

drop policy if exists submissions_select_reviewer on public.document_submissions;
create policy submissions_select_reviewer on public.document_submissions
for select to authenticated
using (private.has_role('reviewer'::public.app_role));

-- Review decisions: owner of the related document or reviewer.
drop policy if exists review_decisions_select_owner on public.review_decisions;
create policy review_decisions_select_owner on public.review_decisions
for select to authenticated
using (
  exists (
    select 1
    from public.document_submissions s
    join public.documents d on d.id = s.document_id
    where s.id = submission_id
      and d.owner_id = (select auth.uid())
  )
);

drop policy if exists review_decisions_select_reviewer on public.review_decisions;
create policy review_decisions_select_reviewer on public.review_decisions
for select to authenticated
using (private.has_role('reviewer'::public.app_role));

-- Notifications: own rows only.
drop policy if exists notifications_select_own on public.notifications;
create policy notifications_select_own on public.notifications
for select to authenticated
using (user_id = (select auth.uid()));

drop policy if exists notifications_update_own on public.notifications;
create policy notifications_update_own on public.notifications
for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

-- Verification events: own rows only.
drop policy if exists verification_events_select_own on public.verification_events;
create policy verification_events_select_own on public.verification_events
for select to authenticated
using (user_id = (select auth.uid()));

-- No client policies are created for verification_credentials or audit_logs.
-- They are accessed only through server-side authorized services.

-- Minimal grants. No direct client mutation of documents, submissions, decisions, roles or credentials.
grant select on public.profiles to authenticated;
grant update (full_name, phone, avatar_path) on public.profiles to authenticated;
grant select on public.user_roles to authenticated;
grant select on public.document_categories to authenticated;
grant select on public.documents to authenticated;
grant select on public.document_submissions to authenticated;
grant select on public.review_decisions to authenticated;
grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;
grant select on public.verification_events to authenticated;

-- Private document bucket. Do not make this bucket public.
insert into storage.buckets (id, name, public, allowed_mime_types)
values ('document-submissions', 'document-submissions', false, array['application/pdf'])
on conflict (id) do update
set public = false,
    allowed_mime_types = array['application/pdf'];

-- Initial classification values. This is not a closed acceptance whitelist.
insert into public.document_categories (name, slug, is_active, is_system, display_order)
values
  ('Pendidikan', 'pendidikan', true, true, 10),
  ('Pekerjaan', 'pekerjaan', true, true, 20),
  ('Organisasi', 'organisasi', true, true, 30),
  ('Administrasi', 'administrasi', true, true, 40),
  ('Keuangan', 'keuangan', true, true, 50),
  ('Kesehatan', 'kesehatan', true, true, 60),
  ('Hukum', 'hukum', true, true, 70),
  ('Pribadi', 'pribadi', true, true, 80),
  ('Lainnya', 'lainnya', true, true, 999)
on conflict (slug) do nothing;

commit;
