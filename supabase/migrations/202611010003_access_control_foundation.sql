-- Document Verification Platform — Phase 1 access-control foundation.
-- Preserve the two supplied migrations as historical input. Apply this
-- migration in the same fresh local/development migration run before use.
-- Policy proposals remain disabled until the owner explicitly approves them.

begin;

revoke all privileges on schema private
from public, anon, authenticated, service_role;

-- Supabase may assign broad default privileges to newly created tables.
-- GRANTing narrower privileges never removes a pre-existing table-level grant.
revoke all privileges on table
  public.profiles,
  public.user_roles,
  public.document_categories,
  public.documents,
  public.document_submissions,
  public.review_decisions,
  public.verification_credentials,
  public.notifications,
  public.audit_logs,
  public.verification_events
from public, anon, authenticated, service_role;

revoke all privileges on sequence public.audit_logs_id_seq
from public, anon, authenticated, service_role;

grant select on table
  public.profiles,
  public.user_roles,
  public.document_categories,
  public.documents,
  public.document_submissions,
  public.review_decisions,
  public.notifications,
  public.verification_events
to authenticated;

grant update (full_name, phone, avatar_path) on public.profiles to authenticated;
grant update (read_at) on public.notifications to authenticated;

-- No API role receives TRUNCATE: it bypasses row-level security and row triggers.
grant select, insert, update, delete on table
  public.profiles,
  public.document_categories,
  public.notifications,
  public.verification_events
to service_role;

-- Role assignment is an audited SQL-operator action, not an API capability.
-- Trigger/RPC definer functions retain their own table privileges.
grant select on public.user_roles to service_role;

grant select, insert on table
  public.documents,
  public.document_submissions,
  public.review_decisions,
  public.verification_credentials,
  public.audit_logs
to service_role;

grant update (
  current_version_no, current_status, registered_at,
  revoked_at, revoked_by, revocation_reason
) on public.documents to service_role;
grant update (status) on public.document_submissions to service_role;
grant usage, select on sequence public.audit_logs_id_seq to service_role;

-- R-16 user-management permissions are still unapproved. Holding platform_admin
-- alone does not expose other accounts' role memberships through the client.
-- Trusted SQL operators and the server-only service client retain inspection.
drop policy user_roles_select_own_or_admin on public.user_roles;
create policy user_roles_select_own on public.user_roles
for select to authenticated
using (user_id = (select auth.uid()));

-- An operator can approve the shared-queue proposal later using a direct SQL
-- transaction. This private table is not exposed through the public API schema.
create table private.access_control_settings (
  singleton boolean primary key default true check (singleton = true),
  shared_review_queue_enabled boolean not null default false
);

insert into private.access_control_settings (singleton, shared_review_queue_enabled)
values (true, false);

alter table private.access_control_settings enable row level security;
revoke all privileges on private.access_control_settings
from public, anon, authenticated, service_role;

-- Do not activate the proposed category list merely by applying a migration.
alter table public.document_categories alter column is_active set default false;
update public.document_categories
set is_active = false
where slug in (
  'pendidikan', 'pekerjaan', 'organisasi', 'administrasi', 'keuangan',
  'kesehatan', 'hukum', 'pribadi', 'lainnya'
);

-- Policy helpers run with an empty search_path and return only a boolean.
create function private.shared_review_queue_is_enabled()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select shared_review_queue_enabled
    from private.access_control_settings
    where singleton = true
  ), false);
$$;

create function private.can_read_review_document(p_document_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.shared_review_queue_is_enabled()
    and private.has_role('reviewer'::public.app_role)
    and exists (
      select 1
      from public.documents d
      where d.id = p_document_id
        and d.current_status = 'pending_review'::public.document_status
    );
$$;

drop policy documents_select_reviewer on public.documents;
create policy documents_select_reviewer on public.documents
for select to authenticated
using (private.can_read_review_document(id));

drop policy submissions_select_reviewer on public.document_submissions;
create policy submissions_select_reviewer on public.document_submissions
for select to authenticated
using (
  private.can_read_review_document(document_id)
  and status = 'pending_review'::public.submission_status
  and exists (
    select 1 from public.documents d
    where d.id = document_id
      and d.current_version_no = version_no
  )
);

-- A reviewer may read their own prior decisions. Shared access to other
-- reviewers' history remains disabled until its policy is approved.
drop policy review_decisions_select_reviewer on public.review_decisions;
create policy review_decisions_select_reviewer on public.review_decisions
for select to authenticated
using (
  reviewer_id = (select auth.uid())
  and private.has_role('reviewer'::public.app_role)
);

-- A permissive policy for another bucket must not accidentally expose PDFs.
-- Restrictive policies combine with all permissive policies using AND.
-- Do not change the global Storage grants or access to unrelated buckets.
create policy document_submissions_server_only on storage.objects
as restrictive for all to anon, authenticated
using (bucket_id <> 'document-submissions')
with check (bucket_id <> 'document-submissions');

create policy document_submissions_bucket_server_only on storage.buckets
as restrictive for all to anon, authenticated
using (id <> 'document-submissions')
with check (id <> 'document-submissions');

update storage.buckets
set public = false, allowed_mime_types = array['application/pdf']
where id = 'document-submissions';

-- CHECK constraints must reject SQL NULL. In the supplied draft a missing
-- JSON key produced NULL, which PostgreSQL considers a passing CHECK result.
alter table public.review_decisions drop constraint review_checklist_keys;
alter table public.review_decisions add constraint review_checklist_keys check (
  (
    checklist ?& array[
      'completeness', 'readability', 'category_match', 'registration_eligibility'
    ]
    and checklist - array[
      'completeness', 'readability', 'category_match', 'registration_eligibility'
    ]::text[] = '{}'::jsonb
    and jsonb_typeof(checklist -> 'completeness') = 'boolean'
    and jsonb_typeof(checklist -> 'readability') = 'boolean'
    and jsonb_typeof(checklist -> 'category_match') = 'boolean'
    and jsonb_typeof(checklist -> 'registration_eligibility') = 'boolean'
  ) is true
);

-- A submission cannot claim another owner's identity, even in trusted writes.
alter table public.documents
  add constraint documents_id_owner_unique unique (id, owner_id);
alter table public.document_submissions
  add constraint submissions_document_owner_fk
  foreign key (document_id, submitted_by)
  references public.documents (id, owner_id)
  on update restrict on delete restrict;

-- The initial workflow inserts the document before its first submission.
-- Deferring this circular relationship until COMMIT preserves that transaction.
alter table public.documents
  add constraint documents_current_submission_fk
  foreign key (id, current_version_no)
  references public.document_submissions (document_id, version_no)
  deferrable initially deferred;

alter table public.document_submissions
  add constraint submissions_private_bucket_check
  check (storage_bucket = 'document-submissions'),
  add constraint submissions_owner_storage_path_check check (
    left(storage_path, char_length(submitted_by::text) + 1)
      = submitted_by::text || '/'
    and char_length(storage_path) > char_length(submitted_by::text) + 1
    and right(storage_path, 1) <> '/'
    and storage_path not like '%//%'
    and storage_path !~ '(^|/)[.]{1,2}(/|$)'
    and strpos(storage_path, chr(92)) = 0
  ),
  add constraint submissions_policy_version_check
  check (nullif(trim(policy_version), '') is not null);

alter table public.documents
  add constraint documents_registration_state_check check (
    (current_status in ('approved', 'revoked')) = (registered_at is not null)
  ),
  add constraint documents_nonrevoked_metadata_check check (
    current_status = 'revoked'
    or (revoked_by is null and revocation_reason is null)
  );

create function private.enforce_submission_immutability()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'IMMUTABLE_RECORD';
  end if;

  if (to_jsonb(new) - 'status') is distinct from (to_jsonb(old) - 'status') then
    raise exception 'IMMUTABLE_RECORD';
  end if;

  if new.status is distinct from old.status and (
    old.status <> 'pending_review'::public.submission_status
    or new.status not in ('approved', 'revision_requested', 'rejected')
  ) then
    raise exception 'IMMUTABLE_RECORD';
  end if;

  return new;
end;
$$;

create trigger submissions_immutable_metadata
before update or delete on public.document_submissions
for each row execute function private.enforce_submission_immutability();

create function private.require_approved_credential_document()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_document_id uuid;
begin
  select d.id into v_document_id
  from public.documents d
  join public.document_submissions s
    on s.document_id = d.id and s.version_no = d.current_version_no
  where d.id = new.document_id
    and d.current_status = 'approved'::public.document_status
    and d.registered_at is not null
    and s.status = 'approved'::public.submission_status
  for share of d, s;

  if v_document_id is null then
    raise exception 'APPROVED_DOCUMENT_REQUIRED';
  end if;

  return new;
end;
$$;

create trigger credentials_require_approved_document
before insert on public.verification_credentials
for each row execute function private.require_approved_credential_document();

-- service_role bypasses RLS. Enforce the pending reviewer-scope decision at
-- the RPC boundary as well, rather than relying only on SELECT policies.
alter function public.apply_review_decision(
  uuid, uuid, public.review_decision_type, jsonb, text, uuid, text, smallint
) set schema private;

create function public.apply_review_decision(
  p_reviewer_id uuid,
  p_submission_id uuid,
  p_decision public.review_decision_type,
  p_checklist jsonb,
  p_note text,
  p_credential_id uuid default null,
  p_code_digest text default null,
  p_key_version smallint default 1
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.shared_review_queue_is_enabled() then
    raise exception 'REVIEW_SCOPE_NOT_APPROVED' using errcode = '42501';
  end if;

  return private.apply_review_decision(
    p_reviewer_id, p_submission_id, p_decision, p_checklist,
    p_note, p_credential_id, p_code_digest, p_key_version
  );
end;
$$;

-- Replace inherited/default ACLs on every application function explicitly.
revoke all privileges on function private.set_updated_at()
from public, anon, authenticated, service_role;
revoke all privileges on function private.prevent_immutable_mutation()
from public, anon, authenticated, service_role;
revoke all privileges on function public.handle_new_user()
from public, anon, authenticated, service_role;
revoke all privileges on function private.has_role(public.app_role)
from public, anon, authenticated, service_role;
revoke all privileges on function private.shared_review_queue_is_enabled()
from public, anon, authenticated, service_role;
revoke all privileges on function private.can_read_review_document(uuid)
from public, anon, authenticated, service_role;
revoke all privileges on function private.enforce_submission_immutability()
from public, anon, authenticated, service_role;
revoke all privileges on function private.require_approved_credential_document()
from public, anon, authenticated, service_role;
revoke all privileges on function private.apply_review_decision(
  uuid, uuid, public.review_decision_type, jsonb, text, uuid, text, smallint
) from public, anon, authenticated, service_role;
revoke all privileges on function public.create_document_submission(
  uuid, uuid, uuid, text, uuid, text, date, text, text, text, bigint, text, text, text, boolean
) from public, anon, authenticated, service_role;
revoke all privileges on function public.create_document_resubmission(
  uuid, uuid, uuid, text, uuid, text, date, text, text, text, bigint, text, text, text, boolean
) from public, anon, authenticated, service_role;
revoke all privileges on function public.apply_review_decision(
  uuid, uuid, public.review_decision_type, jsonb, text, uuid, text, smallint
) from public, anon, authenticated, service_role;

grant usage on schema private to authenticated, service_role;
grant execute on function private.has_role(public.app_role) to authenticated;
grant execute on function private.can_read_review_document(uuid) to authenticated;
grant execute on function public.create_document_submission(
  uuid, uuid, uuid, text, uuid, text, date, text, text, text, bigint, text, text, text, boolean
) to service_role;
grant execute on function public.create_document_resubmission(
  uuid, uuid, uuid, text, uuid, text, date, text, text, text, bigint, text, text, text, boolean
) to service_role;
grant execute on function public.apply_review_decision(
  uuid, uuid, public.review_decision_type, jsonb, text, uuid, text, smallint
) to service_role;

commit;
