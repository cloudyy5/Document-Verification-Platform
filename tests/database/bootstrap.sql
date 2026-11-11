-- Test-only Supabase metadata fixtures for a fresh, isolated native PostgreSQL.
-- This file is NOT an application migration and must never run on Supabase.
-- It does not emulate GoTrue, JWT signature checks, PostgREST, or Storage HTTP.

create role anon nologin noinherit;
create role authenticated nologin noinherit;
create role service_role nologin noinherit bypassrls;

create schema auth;
create schema storage;
create schema extensions;

create table auth.users (
  id uuid primary key default gen_random_uuid(),
  instance_id uuid,
  email text,
  encrypted_password text,
  aud text,
  role text,
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  raw_app_meta_data jsonb not null default '{}'::jsonb,
  email_confirmed_at timestamptz,
  banned_until timestamptz,
  deleted_at timestamptz,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create function auth.uid()
returns uuid
language sql
stable
set search_path = ''
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'
  )::uuid;
$$;

create function auth.jwt()
returns jsonb
language sql
stable
set search_path = ''
as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb;
$$;

create function auth.role()
returns text
language sql
stable
set search_path = ''
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role'
  );
$$;

grant usage on schema auth, storage, public, extensions to anon, authenticated, service_role;
revoke all on all tables in schema auth from public, anon, authenticated, service_role;
grant execute on function auth.uid(), auth.jwt(), auth.role() to anon, authenticated, service_role;

create table storage.buckets (
  id text primary key,
  name text not null unique,
  public boolean not null default false,
  file_size_limit bigint,
  allowed_mime_types text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text not null references storage.buckets(id),
  name text not null,
  owner_id text,
  metadata jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (bucket_id, name)
);

alter table storage.buckets enable row level security;
alter table storage.objects enable row level security;
grant all on all tables in schema storage to anon, authenticated, service_role;

-- Reproduce the permissive default ACLs present on older Supabase projects.
-- A migration that merely adds minimal grants but forgets REVOKE must fail
-- the tests, especially column-only UPDATE and RLS-bypassing TRUNCATE checks.
-- Source: supabase/postgres initial-schema.sql and Supabase RLS documentation.
alter default privileges in schema public
  grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public
  grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public
  grant all on sequences to anon, authenticated, service_role;
