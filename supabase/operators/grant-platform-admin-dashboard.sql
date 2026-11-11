-- Optional initial admin setup, SQL Editor role postgres / supabase_admin ONLY.
-- Replace both placeholders with existing Auth UUIDs. Operator ID must identify
-- the person performing this action; self-bootstrap is allowed. No secret keys.
-- Do not run until you intend to grant the target platform_admin access.
begin;
do $$
declare
 target_input text := 'PASTE_TARGET_USER_UUID';
 operator_input text := 'PASTE_OPERATOR_USER_UUID';
 uuid_pattern constant text := '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';
 target_id uuid; operator_id uuid; inserted integer;
begin
 if session_user in ('anon','authenticated','service_role') or current_user not in ('postgres','supabase_admin') then
  raise exception 'TRUSTED_DATABASE_OPERATOR_REQUIRED' using errcode='42501';
 end if;
 if target_input !~ uuid_pattern then raise exception 'VALID_TARGET_USER_ID_REQUIRED' using errcode='22023'; end if;
 if operator_input !~ uuid_pattern then raise exception 'VALID_OPERATOR_USER_ID_REQUIRED' using errcode='22023'; end if;
 target_id:=target_input::uuid;operator_id:=operator_input::uuid;
 perform 1 from auth.users where id=target_id for key share;
 if not found then raise exception 'TARGET_USER_NOT_FOUND' using errcode='P0002'; end if;
 perform 1 from auth.users where id=operator_id for key share;
 if not found then raise exception 'OPERATOR_USER_NOT_FOUND' using errcode='P0002'; end if;
 insert into public.user_roles(user_id,role,granted_by) values(target_id,'platform_admin',operator_id)
  on conflict(user_id,role) do nothing;
 get diagnostics inserted=row_count;
 if inserted=1 then
  insert into public.audit_logs(actor_user_id,actor_role,action,resource_type,resource_id,outcome,metadata)
   values(operator_id,'trusted_operator','role.granted','user',target_id,'success',
    jsonb_build_object('role','platform_admin','changed',true));
  raise notice 'ROLE_GRANTED';
 else raise notice 'ROLE_ALREADY_PRESENT'; end if;
end; $$;
commit;
