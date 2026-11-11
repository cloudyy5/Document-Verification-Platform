-- Phase 2 authentication security. No raw emails, passwords, tokens, or IPs.
-- Technical security defaults: login 10/15m, signup 5/hour, recovery/resend
-- 3/15m, password reset 5/15m; global counters prevent identity rotation spam.
begin;

create table private.auth_rate_limits (
  action text not null,
  key_digest text not null check (key_digest ~ '^[a-f0-9]{64}$'),
  hits integer not null check (hits > 0),
  window_started_at timestamptz not null,
  primary key (action, key_digest)
);
alter table private.auth_rate_limits enable row level security;
revoke all on private.auth_rate_limits from public, anon, authenticated, service_role;

create function public.consume_auth_rate_limit(p_action text, p_key_digest text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  v_limit integer;
  v_window interval;
  v_hits integer;
  v_now timestamptz := clock_timestamp();
begin
  select case p_action
    when 'login' then 10 when 'register' then 5
    when 'recovery' then 3 when 'resend' then 3 when 'reset' then 5
    when 'login_global' then 200 when 'register_global' then 100
    when 'recovery_global' then 50 when 'resend_global' then 50 when 'reset_global' then 100
    else null end into v_limit;
  if v_limit is null or p_key_digest is null or p_key_digest !~ '^[a-f0-9]{64}$' then
    raise exception 'INVALID_RATE_LIMIT_INPUT' using errcode = '22023';
  end if;
  v_window := case when p_action in ('register', 'register_global') then interval '1 hour' else interval '15 minutes' end;
  delete from private.auth_rate_limits where window_started_at < v_now - interval '1 day';
  insert into private.auth_rate_limits as r(action, key_digest, hits, window_started_at)
  values (p_action, p_key_digest, 1, v_now)
  on conflict (action, key_digest) do update set
    hits = case when r.window_started_at <= v_now - v_window then 1 else least(r.hits + 1, v_limit + 1) end,
    window_started_at = case when r.window_started_at <= v_now - v_window then v_now else r.window_started_at end
  returning hits into v_hits;
  return v_hits <= v_limit;
end;
$$;
revoke all on function public.consume_auth_rate_limit(text, text) from public, anon, authenticated, service_role;
grant execute on function public.consume_auth_rate_limit(text, text) to service_role;

create table private.auth_recovery_grants (
  token_digest text primary key check (token_digest ~ '^[a-f0-9]{64}$'),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null,
  expires_at timestamptz not null,
  used_at timestamptz
);
create index on private.auth_recovery_grants(user_id);
alter table private.auth_recovery_grants enable row level security;
revoke all on private.auth_recovery_grants from public, anon, authenticated, service_role;

create function public.issue_auth_recovery_grant(p_token_digest text, p_user_id uuid, p_session_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_token_digest is null or p_token_digest !~ '^[a-f0-9]{64}$' or p_user_id is null or p_session_id is null then
    raise exception 'INVALID_RECOVERY_GRANT' using errcode = '22023';
  end if;
  delete from private.auth_recovery_grants where user_id = p_user_id or expires_at <= now();
  insert into private.auth_recovery_grants(token_digest, user_id, session_id, expires_at)
  values (p_token_digest, p_user_id, p_session_id, now() + interval '10 minutes');
end;
$$;
create function public.is_auth_recovery_grant_valid(p_token_digest text, p_user_id uuid, p_session_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from private.auth_recovery_grants where token_digest = p_token_digest
    and user_id = p_user_id and session_id = p_session_id and used_at is null and expires_at > now());
$$;
create function public.consume_auth_recovery_grant(p_token_digest text, p_user_id uuid, p_session_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  update private.auth_recovery_grants set used_at = now()
  where token_digest = p_token_digest and user_id = p_user_id and session_id = p_session_id
    and used_at is null and expires_at > now();
  return found;
end;
$$;
revoke all on function public.issue_auth_recovery_grant(text, uuid, uuid),
  public.is_auth_recovery_grant_valid(text, uuid, uuid), public.consume_auth_recovery_grant(text, uuid, uuid)
from public, anon, authenticated, service_role;
grant execute on function public.issue_auth_recovery_grant(text, uuid, uuid),
  public.is_auth_recovery_grant_valid(text, uuid, uuid), public.consume_auth_recovery_grant(text, uuid, uuid)
to service_role;

-- R-04 explicitly approved: email must be verified before any submission.
create function private.require_submission_verified_email()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not exists(select 1 from auth.users where id = new.submitted_by and email_confirmed_at is not null) then
    raise exception 'EMAIL_VERIFICATION_REQUIRED' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function private.require_submission_verified_email() from public, anon, authenticated, service_role;
create trigger submissions_require_verified_email before insert on public.document_submissions
for each row execute function private.require_submission_verified_email();

commit;
