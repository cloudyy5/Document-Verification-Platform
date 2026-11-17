-- Read-only diagnostic. Run in SQL Editor on the application project.
-- No document/account rows, DDL, counters or mutations are accessed.
select
 exists (
  select 1 from information_schema.columns
  where table_schema='public' and table_name='signing_receipt_layouts'
   and column_name='source_page_count'
 ) as migration_013_source_page_count,
 to_regprocedure('public.approve_signing_request_with_selected_pages(uuid,uuid,uuid,uuid,text,text,boolean,boolean,text,jsonb,integer)') is not null
  as migration_013_approval_rpc,
 to_regprocedure('public.get_signing_public_metadata(text)') is not null
  as migration_014_public_metadata_rpc,
 to_regprocedure('public.consume_public_signing_metadata_limit(text,text)') is not null
  as migration_014_limiter_rpc;
