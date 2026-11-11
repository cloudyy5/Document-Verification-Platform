-- Read-only installation check, SQL Editor role postgres; does not return data.
select to_regprocedure('public.get_operations_snapshot()') as snapshot_rpc,
 has_function_privilege('authenticated','public.get_operations_snapshot()','EXECUTE') as authenticated_can_call,
 has_function_privilege('anon','public.get_operations_snapshot()','EXECUTE') as anon_can_call,
 (select prosecdef and provolatile='s' from pg_proc where oid='public.get_operations_snapshot()'::regprocedure) as stable_security_definer;
