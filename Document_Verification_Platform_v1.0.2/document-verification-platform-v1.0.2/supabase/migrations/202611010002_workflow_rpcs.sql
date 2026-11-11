-- Document Verification Platform — workflow RPCs
-- Run after 202611010001_initial_schema.sql.
-- These functions are callable only by the trusted server-side service_role.
-- The Next.js server MUST derive owner/reviewer IDs from a verified session;
-- never accept those IDs directly from browser input.

begin;

alter table public.document_submissions
  add column if not exists submitter_display_name text
  check (submitter_display_name is null or char_length(submitter_display_name) <= 120);

-- Block ordinary update/delete of immutable review decisions and audit events.
create or replace function private.prevent_immutable_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'IMMUTABLE_RECORD';
end;
$$;

revoke all on function private.prevent_immutable_mutation() from public, anon, authenticated;

drop trigger if exists review_decisions_immutable on public.review_decisions;
create trigger review_decisions_immutable
before update or delete on public.review_decisions
for each row execute function private.prevent_immutable_mutation();

drop trigger if exists audit_logs_immutable on public.audit_logs;
create trigger audit_logs_immutable
before update or delete on public.audit_logs
for each row execute function private.prevent_immutable_mutation();

-- Create the first document and submission version.
-- The private file must already exist before this function is called.
create or replace function public.create_document_submission(
  p_owner_id uuid,
  p_document_id uuid,
  p_submission_id uuid,
  p_title text,
  p_category_id uuid,
  p_custom_document_type text,
  p_document_date date,
  p_issuing_institution text,
  p_description text,
  p_original_filename text,
  p_file_size_bytes bigint,
  p_sha256 text,
  p_storage_path text,
  p_policy_version text,
  p_consent boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_category_slug text;
  v_display_name text;
begin
  if p_owner_id is null or not exists (
    select 1 from auth.users where id = p_owner_id
  ) or not exists (
    select 1 from public.user_roles
    where user_id = p_owner_id and role = 'user'::public.app_role
  ) then
    raise exception 'INVALID_OWNER' using errcode = '42501';
  end if;

  if p_consent is distinct from true then
    raise exception 'POLICY_CONSENT_REQUIRED' using errcode = '22023';
  end if;

  if nullif(trim(p_title), '') is null
     or char_length(trim(p_title)) > 200
     or p_file_size_bytes is null
     or p_file_size_bytes <= 0
     or p_sha256 is null
     or p_sha256 !~ '^[a-f0-9]{64}$'
     or nullif(trim(p_original_filename), '') is null
     or nullif(trim(p_policy_version), '') is null then
    raise exception 'INVALID_SUBMISSION_INPUT' using errcode = '22023';
  end if;

  if p_storage_path is null
     or left(p_storage_path, char_length(p_owner_id::text) + 1) <> (p_owner_id::text || '/') then
    raise exception 'INVALID_STORAGE_PATH' using errcode = '22023';
  end if;

  select slug into v_category_slug
  from public.document_categories
  where id = p_category_id and is_active = true;

  if v_category_slug is null then
    raise exception 'INVALID_CATEGORY' using errcode = '22023';
  end if;

  if v_category_slug = 'lainnya'
     and nullif(trim(p_custom_document_type), '') is null then
    raise exception 'CUSTOM_DOCUMENT_TYPE_REQUIRED' using errcode = '22023';
  end if;

  if v_category_slug <> 'lainnya' and nullif(trim(p_custom_document_type), '') is not null then
    raise exception 'CUSTOM_DOCUMENT_TYPE_NOT_ALLOWED' using errcode = '22023';
  end if;

  if not exists (
    select 1 from storage.objects
    where bucket_id = 'document-submissions'
      and name = p_storage_path
  ) then
    raise exception 'PRIVATE_FILE_NOT_FOUND' using errcode = '22023';
  end if;

  select full_name into v_display_name
  from public.profiles
  where id = p_owner_id;

  insert into public.documents (
    id, owner_id, current_version_no, current_status
  ) values (
    p_document_id, p_owner_id, 1, 'pending_review'
  );

  insert into public.document_submissions (
    id, document_id, version_no, status, submitted_by, submitter_display_name,
    title, category_id, custom_document_type, document_date,
    issuing_institution, description, original_filename, mime_type,
    file_size_bytes, sha256, storage_bucket, storage_path,
    policy_version, consented_at, submitted_at
  ) values (
    p_submission_id, p_document_id, 1, 'pending_review', p_owner_id, v_display_name,
    trim(p_title), p_category_id, nullif(trim(p_custom_document_type), ''),
    p_document_date, nullif(trim(p_issuing_institution), ''),
    nullif(trim(p_description), ''), trim(p_original_filename), 'application/pdf',
    p_file_size_bytes, lower(p_sha256), 'document-submissions', p_storage_path,
    trim(p_policy_version), now(), now()
  );

  insert into public.audit_logs (
    actor_user_id, actor_role, action, resource_type, resource_id, outcome, metadata
  ) values (
    p_owner_id, 'user', 'document.submitted', 'document', p_document_id, 'success',
    jsonb_build_object('submission_id', p_submission_id, 'version_no', 1)
  );

  insert into public.notifications (user_id, type, title, body, target_path)
  values (
    p_owner_id,
    'submission_received',
    'Pengajuan dokumen diterima',
    'Dokumen Anda telah masuk ke antrean pemeriksaan administrator.',
    '/documents/' || p_document_id::text
  );

  return jsonb_build_object(
    'documentId', p_document_id,
    'submissionId', p_submission_id,
    'versionNo', 1,
    'status', 'pending_review'
  );
end;
$$;

-- Resubmission creates a new immutable version after a revision request.
create or replace function public.create_document_resubmission(
  p_owner_id uuid,
  p_document_id uuid,
  p_submission_id uuid,
  p_title text,
  p_category_id uuid,
  p_custom_document_type text,
  p_document_date date,
  p_issuing_institution text,
  p_description text,
  p_original_filename text,
  p_file_size_bytes bigint,
  p_sha256 text,
  p_storage_path text,
  p_policy_version text,
  p_consent boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actual_owner_id uuid;
  v_status public.document_status;
  v_next_version integer;
  v_category_slug text;
  v_display_name text;
begin
  if p_owner_id is null or not exists (
    select 1 from auth.users where id = p_owner_id
  ) or not exists (
    select 1 from public.user_roles
    where user_id = p_owner_id and role = 'user'::public.app_role
  ) then
    raise exception 'INVALID_OWNER' using errcode = '42501';
  end if;

  if p_consent is distinct from true then
    raise exception 'POLICY_CONSENT_REQUIRED' using errcode = '22023';
  end if;

  select owner_id, current_status, current_version_no + 1
    into v_actual_owner_id, v_status, v_next_version
  from public.documents
  where id = p_document_id
  for update;

  if v_actual_owner_id is null or v_actual_owner_id <> p_owner_id then
    raise exception 'DOCUMENT_NOT_FOUND' using errcode = 'P0002';
  end if;

  if v_status <> 'revision_requested'
     or not exists (
       select 1 from public.document_submissions
       where document_id = p_document_id
         and version_no = v_next_version - 1
         and status = 'revision_requested'
     ) then
    raise exception 'DOCUMENT_NOT_ELIGIBLE_FOR_RESUBMISSION' using errcode = 'P0001';
  end if;

  if nullif(trim(p_title), '') is null
     or char_length(trim(p_title)) > 200
     or p_file_size_bytes is null
     or p_file_size_bytes <= 0
     or p_sha256 is null
     or p_sha256 !~ '^[a-f0-9]{64}$'
     or nullif(trim(p_original_filename), '') is null
     or nullif(trim(p_policy_version), '') is null then
    raise exception 'INVALID_SUBMISSION_INPUT' using errcode = '22023';
  end if;

  if p_storage_path is null
     or left(p_storage_path, char_length(p_owner_id::text) + 1) <> (p_owner_id::text || '/') then
    raise exception 'INVALID_STORAGE_PATH' using errcode = '22023';
  end if;

  select slug into v_category_slug
  from public.document_categories
  where id = p_category_id and is_active = true;

  if v_category_slug is null then
    raise exception 'INVALID_CATEGORY' using errcode = '22023';
  end if;

  if v_category_slug = 'lainnya'
     and nullif(trim(p_custom_document_type), '') is null then
    raise exception 'CUSTOM_DOCUMENT_TYPE_REQUIRED' using errcode = '22023';
  end if;

  if v_category_slug <> 'lainnya' and nullif(trim(p_custom_document_type), '') is not null then
    raise exception 'CUSTOM_DOCUMENT_TYPE_NOT_ALLOWED' using errcode = '22023';
  end if;

  if not exists (
    select 1 from storage.objects
    where bucket_id = 'document-submissions'
      and name = p_storage_path
  ) then
    raise exception 'PRIVATE_FILE_NOT_FOUND' using errcode = '22023';
  end if;

  select full_name into v_display_name
  from public.profiles
  where id = p_owner_id;

  insert into public.document_submissions (
    id, document_id, version_no, status, submitted_by, submitter_display_name,
    title, category_id, custom_document_type, document_date,
    issuing_institution, description, original_filename, mime_type,
    file_size_bytes, sha256, storage_bucket, storage_path,
    policy_version, consented_at, submitted_at
  ) values (
    p_submission_id, p_document_id, v_next_version, 'pending_review',
    p_owner_id, v_display_name, trim(p_title), p_category_id,
    nullif(trim(p_custom_document_type), ''), p_document_date,
    nullif(trim(p_issuing_institution), ''), nullif(trim(p_description), ''),
    trim(p_original_filename), 'application/pdf', p_file_size_bytes,
    lower(p_sha256), 'document-submissions', p_storage_path,
    trim(p_policy_version), now(), now()
  );

  update public.documents
  set current_version_no = v_next_version,
      current_status = 'pending_review'
  where id = p_document_id;

  insert into public.audit_logs (
    actor_user_id, actor_role, action, resource_type, resource_id, outcome, metadata
  ) values (
    p_owner_id, 'user', 'document.resubmitted', 'document', p_document_id, 'success',
    jsonb_build_object('submission_id', p_submission_id, 'version_no', v_next_version)
  );

  insert into public.notifications (user_id, type, title, body, target_path)
  values (
    p_owner_id,
    'submission_resubmitted',
    'Dokumen berhasil diajukan ulang',
    'Versi perbaikan dokumen Anda telah masuk ke antrean pemeriksaan.',
    '/documents/' || p_document_id::text
  );

  return jsonb_build_object(
    'documentId', p_document_id,
    'submissionId', p_submission_id,
    'versionNo', v_next_version,
    'status', 'pending_review'
  );
end;
$$;

-- Atomically record one reviewer decision and, on approval, issue a credential.
create or replace function public.apply_review_decision(
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
declare
  v_document_id uuid;
  v_owner_id uuid;
  v_submission_status public.submission_status;
  v_version_no integer;
  v_current_version integer;
begin
  if p_reviewer_id is null or not exists (
    select 1 from public.user_roles
    where user_id = p_reviewer_id and role = 'reviewer'::public.app_role
  ) then
    raise exception 'REVIEWER_PERMISSION_REQUIRED' using errcode = '42501';
  end if;

  if p_decision is null then
    raise exception 'DECISION_REQUIRED' using errcode = '22023';
  end if;

  select s.document_id, s.status, s.version_no, d.owner_id, d.current_version_no
    into v_document_id, v_submission_status, v_version_no, v_owner_id, v_current_version
  from public.document_submissions s
  join public.documents d on d.id = s.document_id
  where s.id = p_submission_id
  for update of s, d;

  if v_document_id is null then
    raise exception 'SUBMISSION_NOT_FOUND' using errcode = 'P0002';
  end if;

  if v_owner_id = p_reviewer_id then
    raise exception 'REVIEWER_CANNOT_REVIEW_OWN_SUBMISSION' using errcode = '42501';
  end if;

  if v_submission_status <> 'pending_review' or v_version_no <> v_current_version then
    raise exception 'REVIEW_ALREADY_DECIDED_OR_STALE' using errcode = 'P0001';
  end if;

  if p_checklist is null
     or jsonb_typeof(p_checklist) is distinct from 'object'
     or jsonb_typeof(p_checklist -> 'completeness') is distinct from 'boolean'
     or jsonb_typeof(p_checklist -> 'readability') is distinct from 'boolean'
     or jsonb_typeof(p_checklist -> 'category_match') is distinct from 'boolean'
     or jsonb_typeof(p_checklist -> 'registration_eligibility') is distinct from 'boolean' then
    raise exception 'INVALID_REVIEW_CHECKLIST' using errcode = '22023';
  end if;

  if p_decision = 'approved' then
    if p_checklist ->> 'completeness' <> 'true'
       or p_checklist ->> 'readability' <> 'true'
       or p_checklist ->> 'category_match' <> 'true'
       or p_checklist ->> 'registration_eligibility' <> 'true' then
      raise exception 'APPROVAL_REQUIRES_ALL_CHECKS_TO_PASS' using errcode = '22023';
    end if;

    if p_credential_id is null
       or p_code_digest is null
       or p_code_digest !~ '^[a-f0-9]{64}$'
       or p_key_version is null
       or p_key_version < 1 then
      raise exception 'VERIFICATION_CREDENTIAL_REQUIRED' using errcode = '22023';
    end if;
  else
    if nullif(trim(p_note), '') is null then
      raise exception 'DECISION_NOTE_REQUIRED' using errcode = '22023';
    end if;

    if not (
      p_checklist ->> 'completeness' = 'false'
      or p_checklist ->> 'readability' = 'false'
      or p_checklist ->> 'category_match' = 'false'
      or p_checklist ->> 'registration_eligibility' = 'false'
    ) then
      raise exception 'NON_APPROVAL_REQUIRES_FAILED_CHECK' using errcode = '22023';
    end if;

    if p_credential_id is not null or p_code_digest is not null then
      raise exception 'CREDENTIAL_NOT_ALLOWED_FOR_NON_APPROVAL' using errcode = '22023';
    end if;
  end if;

  insert into public.review_decisions (
    submission_id, reviewer_id, decision, checklist, decision_note
  ) values (
    p_submission_id, p_reviewer_id, p_decision, p_checklist, nullif(trim(p_note), '')
  );

  update public.document_submissions
  set status = p_decision::text::public.submission_status
  where id = p_submission_id;

  update public.documents
  set current_status = p_decision::text::public.document_status,
      registered_at = case
        when p_decision = 'approved' then coalesce(registered_at, now())
        else registered_at
      end
  where id = v_document_id;

  if p_decision = 'approved' then
    insert into public.verification_credentials (
      id, document_id, code_digest, key_version, issued_at
    ) values (
      p_credential_id, v_document_id, lower(p_code_digest), p_key_version, now()
    );
  end if;

  insert into public.audit_logs (
    actor_user_id, actor_role, action, resource_type, resource_id, outcome, metadata
  ) values (
    p_reviewer_id, 'reviewer', 'review.' || p_decision::text,
    'document_submission', p_submission_id, 'success',
    jsonb_build_object(
      'document_id', v_document_id,
      'checklist', p_checklist,
      'note_present', nullif(trim(p_note), '') is not null
    )
  );

  insert into public.notifications (user_id, type, title, body, target_path)
  values (
    v_owner_id,
    'review_' || p_decision::text,
    case p_decision
      when 'approved' then 'Dokumen disetujui'
      when 'revision_requested' then 'Dokumen memerlukan revisi'
      else 'Dokumen tidak disetujui'
    end,
    case p_decision
      when 'approved' then 'Dokumen Anda lolos pemeriksaan administratif dan telah terdaftar.'
      when 'revision_requested' then 'Silakan periksa catatan reviewer dan ajukan versi perbaikan.'
      else 'Periksa alasan keputusan pada detail dokumen Anda.'
    end,
    '/documents/' || v_document_id::text
  );

  return jsonb_build_object(
    'documentId', v_document_id,
    'submissionId', p_submission_id,
    'decision', p_decision::text,
    'status', p_decision::text
  );
end;
$$;

-- These privileged workflow functions must never be callable from a browser.
revoke all on function public.create_document_submission(
  uuid, uuid, uuid, text, uuid, text, date, text, text, text, bigint, text, text, text, boolean
) from public, anon, authenticated;
grant execute on function public.create_document_submission(
  uuid, uuid, uuid, text, uuid, text, date, text, text, text, bigint, text, text, text, boolean
) to service_role;

revoke all on function public.create_document_resubmission(
  uuid, uuid, uuid, text, uuid, text, date, text, text, text, bigint, text, text, text, boolean
) from public, anon, authenticated;
grant execute on function public.create_document_resubmission(
  uuid, uuid, uuid, text, uuid, text, date, text, text, text, bigint, text, text, text, boolean
) to service_role;

revoke all on function public.apply_review_decision(
  uuid, uuid, public.review_decision_type, jsonb, text, uuid, text, smallint
) from public, anon, authenticated;
grant execute on function public.apply_review_decision(
  uuid, uuid, public.review_decision_type, jsonb, text, uuid, text, smallint
) to service_role;

commit;
