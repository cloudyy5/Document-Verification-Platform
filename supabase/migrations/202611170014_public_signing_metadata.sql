-- S-19: explicit owner approval for public QR metadata, including old receipts.
-- Exactly status, approval time, signer display name and document title.
-- No participant/PDF/Storage/table grants change; no historical row is updated.
begin;

create function public.get_signing_public_metadata(p_receipt_id text) returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object(
  'status','approved','approvedAt',e.decided_at,
  'signerName',e.signer_name,'documentTitle',e.document_title
 )
 from public.signing_receipts e
 join public.signing_decisions d on d.id=e.decision_id and d.request_id=e.request_id
  and d.action='approve' and d.consent=true and d.actor_id=e.recipient_id
  and d.source_version_id=e.source_version_id and d.decided_at=e.decided_at
 join public.signing_requests r on r.id=e.request_id and r.owner_id=e.owner_id
  and r.recipient_id=e.recipient_id and r.source_version_id=e.source_version_id
  and r.status in('consented','completed')
 where p_receipt_id ~ '^[A-Za-z0-9_-]{43}$' and e.id=p_receipt_id;
$$;
revoke all on function public.get_signing_public_metadata(text) from public,anon,authenticated,service_role;
grant execute on function public.get_signing_public_metadata(text) to service_role;
comment on function public.get_signing_public_metadata(text) is
 'S-19 approved 2026-11-17: public QR projection for historical/new committed approvals. Exactly four fields; no files, hashes, user codes, emails or internal participant IDs. Service-only; application exposes only this DTO.';

create table private.public_signing_metadata_limits (
 scope text not null check(scope in('receipt','global')),
 key_digest text not null check(key_digest ~ '^[a-f0-9]{64}$'),
 hits integer not null check(hits>0),
 window_started_at timestamptz not null,
 primary key(scope,key_digest)
);
alter table private.public_signing_metadata_limits enable row level security;
revoke all on private.public_signing_metadata_limits from public,anon,authenticated,service_role;

-- Persistent technical bounds: 60 reads / receipt / 5 minutes; 1000 globally.
-- HMAC digests only: no raw URL tokens, IP addresses or personal data.
create function public.consume_public_signing_metadata_limit(p_key_digest text,p_global_digest text) returns boolean
language plpgsql security definer set search_path='' as $$
declare now_at timestamptz:=clock_timestamp(); n integer; s text; k text; cap integer;
begin
 if p_key_digest is null or p_key_digest !~ '^[a-f0-9]{64}$'
  or p_global_digest is null or p_global_digest !~ '^[a-f0-9]{64}$'
 then raise exception 'INVALID_PUBLIC_METADATA_LIMIT' using errcode='22023'; end if;
 delete from private.public_signing_metadata_limits where window_started_at<now_at-interval '1 day';
 -- Stable global-before-receipt ordering avoids reverse lock acquisition.
 for s,k,cap in select scope_name,digest,maximum from (values(1,'global',p_global_digest,1000),(2,'receipt',p_key_digest,60)) v(ordinal,scope_name,digest,maximum) order by ordinal loop
  insert into private.public_signing_metadata_limits as limits(scope,key_digest,hits,window_started_at)
   values(s,k,1,now_at)
  on conflict(scope,key_digest) do update set
   hits=case when limits.window_started_at<=now_at-interval '5 minutes' then 1 else least(limits.hits+1,cap+1) end,
   window_started_at=case when limits.window_started_at<=now_at-interval '5 minutes' then now_at else limits.window_started_at end
  returning hits into n;
  -- Stop at the global cap before creating keys for more untrusted tokens.
  if n>cap then return false; end if;
 end loop;
 return true;
end; $$;
revoke all on function public.consume_public_signing_metadata_limit(text,text) from public,anon,authenticated,service_role;
grant execute on function public.consume_public_signing_metadata_limit(text,text) to service_role;
notify pgrst,'reload schema';
commit;
