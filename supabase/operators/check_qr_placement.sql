-- Read-only presence check after migration 011, SQL Editor role postgres.
select to_regclass('public.signing_receipt_layouts') as placement_table,
 to_regprocedure('public.approve_signing_request_with_placement(uuid,uuid,uuid,uuid,text,text,boolean,boolean,text,jsonb)') as placement_approval_rpc,
 position('per-page-draggable-web-evidence-v2' in pg_get_functiondef('public.complete_signing_render(uuid,text,uuid,text,bigint,text,integer)'::regprocedure))>0 as finalizer_supports_movable_qr;
