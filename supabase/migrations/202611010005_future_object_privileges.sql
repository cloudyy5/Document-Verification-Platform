-- Document Verification Platform — explicit grants for future application objects.
-- These defaults belong only to the role running this migration. They do not
-- alter existing object grants or defaults owned by Supabase system roles.
-- Future migrations must declare their intended API privileges explicitly.

begin;

-- Per-schema defaults add to global defaults and cannot subtract from them.
-- In particular PostgreSQL grants PUBLIC EXECUTE on functions globally unless
-- the creator's global function default is explicitly changed.
alter default privileges revoke all privileges on tables
from public, anon, authenticated, service_role;
alter default privileges revoke all privileges on sequences
from public, anon, authenticated, service_role;
alter default privileges revoke all privileges on functions
from public, anon, authenticated, service_role;

-- Remove the schema-specific grants often provisioned by Supabase as well.
alter default privileges in schema public revoke all privileges on tables
from public, anon, authenticated, service_role;
alter default privileges in schema public revoke all privileges on sequences
from public, anon, authenticated, service_role;
alter default privileges in schema public revoke all privileges on functions
from public, anon, authenticated, service_role;

commit;
