# Server boundary

Phase 3 owner-scoped queries live in `workspace/`; document uploads and private
file serving live in `documents/`. Authentication remains in `src/lib/auth`.
Document operations validate the session, owner, policy and Origin on the server.
Review mutations and verification credentials/engine remain later phases.
Privileged Supabase access lives in `src/lib/supabase/privileged.ts` and is
guarded by `server-only`. Validate session, role, scope, and ownership before
adding any callers. Never import it into a Client Component or barrel shared
with browser code.
