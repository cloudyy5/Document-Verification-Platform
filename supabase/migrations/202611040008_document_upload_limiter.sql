-- Phase 3 development upload backstop. Digests are derived by the trusted server.
-- At most 10 accepted attempts per user and 50 globally in each 15-minute window.
begin;

create function public.consume_document_upload_limit(p_key_digest text, p_global_digest text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  v_now timestamptz;
  v_user_hits integer;
  v_user_started timestamptz;
  v_global_hits integer;
  v_global_started timestamptz;
begin
  if p_key_digest is null or p_key_digest !~ '^[a-f0-9]{64}$'
    or p_global_digest is null or p_global_digest !~ '^[a-f0-9]{64}$' then
    raise exception 'INVALID_UPLOAD_LIMIT_INPUT' using errcode = '22023';
  end if;

  -- One transaction lock serializes the combined two-counter decision. No
  -- caller-controlled advisory key can partition or bypass the global cap.
  perform pg_catalog.pg_advisory_xact_lock(1146507344, 3008);
  v_now := clock_timestamp();
  delete from private.auth_rate_limits
  where action in ('upload', 'upload_global')
    and window_started_at < v_now - interval '1 day';

  select hits, window_started_at into v_global_hits, v_global_started
  from private.auth_rate_limits where action = 'upload_global' and key_digest = p_global_digest;
  if v_global_started is null or v_global_started <= v_now - interval '15 minutes' then
    v_global_hits := 0;
    v_global_started := v_now;
  end if;
  -- Check before inserting a new per-user key, preventing unbounded key fanout
  -- when a client rotates identities after the global budget is exhausted.
  if v_global_hits >= 50 then return false; end if;

  select hits, window_started_at into v_user_hits, v_user_started
  from private.auth_rate_limits where action = 'upload' and key_digest = p_key_digest;
  if v_user_started is null or v_user_started <= v_now - interval '15 minutes' then
    v_user_hits := 0;
    v_user_started := v_now;
  end if;
  if v_user_hits >= 10 then return false; end if;

  insert into private.auth_rate_limits(action, key_digest, hits, window_started_at)
  values ('upload_global', p_global_digest, v_global_hits + 1, v_global_started)
  on conflict (action, key_digest) do update
    set hits = excluded.hits, window_started_at = excluded.window_started_at;
  insert into private.auth_rate_limits(action, key_digest, hits, window_started_at)
  values ('upload', p_key_digest, v_user_hits + 1, v_user_started)
  on conflict (action, key_digest) do update
    set hits = excluded.hits, window_started_at = excluded.window_started_at;
  return true;
end;
$$;

revoke all privileges on function public.consume_document_upload_limit(text, text)
from public, anon, authenticated, service_role;
grant execute on function public.consume_document_upload_limit(text, text) to service_role;

commit;
