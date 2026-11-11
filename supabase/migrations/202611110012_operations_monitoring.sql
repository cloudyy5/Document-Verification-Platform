-- R4 / S-11: read-only aggregate monitoring for verified platform admins.
-- No table policies, participant grants, immutable history or PDF access change.
begin;
create index signing_activity_window_idx on private.signing_audit_events(created_at,actor_id)
 where action in ('draft_created','request_sent','approved','rejected');
create index signing_pending_expiry_idx on public.signing_requests(expires_at) where status='pending';
create index signing_attention_updated_idx on public.signing_artifacts(updated_at desc,receipt_id)
 where state in ('failed','processing');

create function public.get_operations_snapshot() returns jsonb
language plpgsql stable security definer set search_path='' set timezone='UTC' as $$
-- Capture one database clock after entry into this statement's MVCC snapshot.
declare actor uuid := auth.uid(); as_of timestamptz := clock_timestamp();
begin
 if actor is null or auth.role() is distinct from 'authenticated' then
  raise exception 'OPERATIONS_ACTOR_REQUIRED' using errcode='42501';
 end if;
 if not exists (
  select 1 from auth.users u where u.id=actor and u.email_confirmed_at is not null
   and u.deleted_at is null and (u.banned_until is null or u.banned_until<=as_of)
   and exists(select 1 from public.user_roles r where r.user_id=u.id and r.role='platform_admin'::public.app_role)
 ) then raise exception 'OPERATIONS_NOT_ALLOWED' using errcode='42501'; end if;
 return (
  with issues as materialized (
   select a.receipt_id, encode(extensions.digest(a.receipt_id,'sha256'),'hex') as reference,
    case when a.state='failed' then 'failed' else 'timed_out' end as state,
    case when a.state='failed' then a.failure_code else 'PROCESSING_TIMEOUT' end as code,
    a.updated_at,coalesce(j.attempts,0) as attempts
   from public.signing_artifacts a
   left join private.signing_render_jobs j on j.receipt_id=a.receipt_id
   where a.state='failed' or (a.state='processing' and (j.lease_until is null or j.lease_until<=as_of))
  ), issue_count as (select count(*) as total from issues)
  select jsonb_build_object(
   'version','operations-v1','asOf',as_of,'periodStart',as_of-interval '720 hours',
   'scope','signing-v1','activeBasis','document-events',
   'metrics',jsonb_build_object(
    'registeredUsers',(select count(*) from auth.users),
    'activeDocumentUsers30d',(select count(distinct actor_id) from private.signing_audit_events
     where created_at>=as_of-interval '720 hours' and created_at<=as_of
      and action in ('draft_created','request_sent','approved','rejected')),
    'uploadedDocuments',(select count(*) from public.signing_documents d
     where exists(select 1 from public.signing_document_versions v where v.document_id=d.id)),
    'sourceVersions',(select count(*) from public.signing_document_versions),
    'completedDocuments',(select count(distinct r.document_id) from public.signing_requests r
     join public.signing_receipts e on e.request_id=r.id
     join public.signing_artifacts a on a.receipt_id=e.id and a.state='ready'
     join public.signing_decisions d on d.id=e.decision_id and d.action='approve'
     where r.status='completed'),
    'pendingRequests',(select count(*) from public.signing_requests where status='pending' and expires_at>as_of),
    'attentionResults',(select total from issue_count),
    'awaitingResults',(select count(*) from public.signing_requests r
     join public.signing_receipts e on e.request_id=r.id
     join public.signing_artifacts a on a.receipt_id=e.id
     where r.status='consented' and a.state<>'ready'),
    'processingResults',(select count(*) from public.signing_artifacts a
     join private.signing_render_jobs j on j.receipt_id=a.receipt_id
     where a.state='processing' and j.lease_until>as_of),
    'legacyDocuments',(select count(*) from public.documents)
   ),
   'attention',jsonb_build_object(
    'items',coalesce((select jsonb_agg(jsonb_build_object(
     'reference',i.reference,'state',i.state,'code',i.code,'updatedAt',i.updated_at,'attempts',i.attempts
    ) order by i.updated_at desc,i.receipt_id) from (
     select * from issues order by updated_at desc,receipt_id limit 20
    ) i),'[]'::jsonb),
    'total',(select total from issue_count),'limit',20,'hasMore',(select total>20 from issue_count)
   )
  )
 );
end; $$;
revoke all on function public.get_operations_snapshot() from public,anon,authenticated,service_role;
grant execute on function public.get_operations_snapshot() to authenticated,service_role;
comment on function public.get_operations_snapshot() is
 'S-11 read-only snapshot; actor comes only from JWT, role is rechecked in user_roles. Service/anon/null actors denied; no content identifiers or personal data returned.';
notify pgrst,'reload schema';
commit;
