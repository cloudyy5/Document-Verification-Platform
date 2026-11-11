-- Read-only SQL Editor check after migration 010. Run with role postgres.
-- This checks presence/settings only, not participant authorization or PDF I/O.
select
  to_regclass('public.signing_decisions') as decisions_table,
  to_regclass('public.signing_receipts') as receipts_table,
  to_regclass('public.signing_artifacts') as artifacts_table,
  to_regprocedure('public.decide_signing_request(uuid,uuid,uuid,uuid,text,text,text,text,boolean,boolean,text)') as decision_rpc,
  to_regprocedure('public.claim_signing_render(uuid,text)') as claim_rpc,
  to_regprocedure('public.complete_signing_render(uuid,text,uuid,text,bigint,text,integer)') as complete_rpc,
  to_regprocedure('public.fail_signing_render(uuid,text,uuid,text)') as fail_rpc,
  to_regprocedure('public.consume_signing_r3_limit(text,text,text)') as limiter_rpc;

select id, public, file_size_limit, allowed_mime_types
from storage.buckets where id = 'signing-results';
