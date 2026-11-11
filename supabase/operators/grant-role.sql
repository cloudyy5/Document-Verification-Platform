-- Document Verification Platform — trusted SQL operator role grant.
-- Run manually with psql as the postgres or supabase_admin database role.
-- Do not run through the browser, PostgREST, or a service-role API client.
--
-- Required psql variables:
--   target_user_id: an existing auth.users UUID receiving the role.
--   granted_role: reviewer or platform_admin; normal user is assigned at signup.
--   operator_user_id: the existing auth.users UUID of the person performing
--     this operation. The trusted operator must supply their actual identity.
--
-- Example using a locally configured libpq service, without credentials in argv:
-- psql "service=dvp-development" -v target_user_id=<target-uuid> \
--   -v granted_role=reviewer -v operator_user_id=<operator-uuid> \
--   -f supabase/operators/grant-role.sql
--
-- SQL connection privileges authorize this operation. The operator UUID is an
-- audit attribution supplied by that trusted operator, not proof of a web
-- session. It need not already hold platform_admin, permitting initial setup.
-- A duplicate grant leaves the existing row intact and creates no extra event.

\set ON_ERROR_STOP on

-- Use empty defaults only so missing inputs reach sanitized SQL validation.
-- ON_ERROR_STOP makes every rejected input/authorization exit unsuccessfully.
\if :{?target_user_id}
\else
  \set target_user_id ''
\endif
\if :{?granted_role}
\else
  \set granted_role ''
\endif
\if :{?operator_user_id}
\else
  \set operator_user_id ''
\endif

begin;
set local search_path = '';

-- :'name' is psql's SQL-literal quoting; never substitute these inputs as SQL.
-- \gset consumes the result without echoing input values to the terminal.
select
  pg_catalog.set_config('dvp.role_operator.target_user_id', :'target_user_id', true) as dvp_target,
  pg_catalog.set_config('dvp.role_operator.granted_role', :'granted_role', true) as dvp_role,
  pg_catalog.set_config('dvp.role_operator.operator_user_id', :'operator_user_id', true) as dvp_operator
\gset

do $$
declare
  v_target_input text := pg_catalog.current_setting('dvp.role_operator.target_user_id');
  v_role_input text := pg_catalog.current_setting('dvp.role_operator.granted_role');
  v_operator_input text := pg_catalog.current_setting('dvp.role_operator.operator_user_id');
  v_uuid_pattern constant text := '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';
  v_target_id uuid;
  v_operator_id uuid;
  v_role public.app_role;
  v_inserted integer;
begin
  if session_user in ('anon', 'authenticated', 'service_role')
     or current_user not in ('postgres', 'supabase_admin') then
    raise exception 'TRUSTED_DATABASE_OPERATOR_REQUIRED' using errcode = '42501';
  end if;

  if v_target_input !~ v_uuid_pattern then
    raise exception 'VALID_TARGET_USER_ID_REQUIRED' using errcode = '22023';
  end if;
  if v_operator_input !~ v_uuid_pattern then
    raise exception 'VALID_OPERATOR_USER_ID_REQUIRED' using errcode = '22023';
  end if;
  if v_role_input not in ('reviewer', 'platform_admin') then
    raise exception 'ROLE_NOT_OPERATOR_ASSIGNABLE' using errcode = '22023';
  end if;

  v_target_id := v_target_input::uuid;
  v_operator_id := v_operator_input::uuid;
  v_role := v_role_input::public.app_role;

  perform 1 from auth.users where id = v_target_id for key share;
  if not found then
    raise exception 'TARGET_USER_NOT_FOUND' using errcode = 'P0002';
  end if;

  perform 1 from auth.users where id = v_operator_id for key share;
  if not found then
    raise exception 'OPERATOR_USER_NOT_FOUND' using errcode = 'P0002';
  end if;

  insert into public.user_roles (user_id, role, granted_by)
  values (v_target_id, v_role, v_operator_id)
  on conflict (user_id, role) do nothing;
  get diagnostics v_inserted = row_count;

  if v_inserted = 1 then
    insert into public.audit_logs (
      actor_user_id, actor_role, action, resource_type,
      resource_id, outcome, metadata
    ) values (
      v_operator_id, 'trusted_operator', 'role.granted', 'user',
      v_target_id, 'success',
      pg_catalog.jsonb_build_object('role', v_role::text, 'changed', true)
    );
    raise notice 'ROLE_GRANTED';
  else
    raise notice 'ROLE_ALREADY_PRESENT';
  end if;
end;
$$;

commit;
