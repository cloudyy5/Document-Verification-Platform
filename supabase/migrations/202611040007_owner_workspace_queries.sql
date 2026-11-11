-- Phase 3: owner-only User Workspace reads. No reviewer/admin capabilities added.
begin;

create view public.workspace_documents
with (security_invoker = true, security_barrier = true) as
select d.id, d.owner_id, d.current_version_no, d.current_status,
  d.created_at, d.updated_at, d.registered_at, d.revoked_at, d.revocation_reason,
  s.id as submission_id, s.title, s.category_id, s.submitted_at,
  c.name as category_name, c.slug as category_slug
from public.documents d
join public.document_submissions s
  on s.document_id = d.id and s.version_no = d.current_version_no
left join public.document_categories c on c.id = s.category_id
where d.owner_id = (select auth.uid());

revoke all privileges on public.workspace_documents
from public, anon, authenticated, service_role;
grant select on public.workspace_documents to authenticated;

create function public.get_own_workspace_counts()
returns jsonb language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'total', count(*),
    'pendingReview', count(*) filter (where current_status = 'pending_review'),
    'revisionRequested', count(*) filter (where current_status = 'revision_requested'),
    'approved', count(*) filter (where current_status = 'approved'),
    'rejected', count(*) filter (where current_status = 'rejected'),
    'revoked', count(*) filter (where current_status = 'revoked')
  )
  from public.documents where owner_id = (select auth.uid());
$$;

revoke all privileges on function public.get_own_workspace_counts()
from public, anon, authenticated, service_role;
grant execute on function public.get_own_workspace_counts() to authenticated;

commit;
