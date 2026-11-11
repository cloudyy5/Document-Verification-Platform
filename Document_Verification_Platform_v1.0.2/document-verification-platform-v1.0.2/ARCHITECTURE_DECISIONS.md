# ARCHITECTURE_DECISIONS.md

## Architecture Decision Records (ADR)

------------------------------------------------------------------------

## ADR-001 --- Next.js App Router

**Status:** Recommended\
**Decision:** Use Next.js App Router with TypeScript.

**Reason:** It provides page routing, server components, and Route
Handlers in one application, which suits a modular monolith MVP.

**Consequence:** Keep sensitive data access and authorization in
server-only modules. Treat Route Handlers and Server Actions as
public-facing endpoints that require authorization checks.

## ADR-002 --- Supabase Managed Backend

**Status:** Recommended\
**Decision:** Use Supabase Auth, PostgreSQL, and private Storage.

**Reason:** The platform needs authentication, relational data, RLS, and
private file storage without operating separate services initially.

**Consequence:** Service/secret keys bypass RLS and must remain
server-only. Test RLS policies explicitly.

## ADR-003 --- Private Document Storage

**Status:** Required\
**Decision:** Store PDFs in a private bucket and access them through an
authorized server endpoint.

**Reason:** Documents may contain personal or sensitive information.

**Consequence:** No public bucket and no public file URLs.

## ADR-004 --- Owner-Only Verification

**Status:** Confirmed product rule\
**Decision:** QR, code, and hash verification are authenticated and
scoped to the current user's own documents.

**Reason:** This is the access model selected by the product owner.

**Consequence:** A QR or code is an identifier, not a permission bypass.

## ADR-005 --- Immutable Submission Versions

**Status:** Recommended\
**Decision:** Each resubmission after a revision request creates a new
version row.

**Reason:** Review history must remain traceable.

**Consequence:** Earlier file, metadata, and review decisions are not
overwritten.

## ADR-006 --- Shared Reviewer Queue

**Status:** Recommended; owner approval pending\
**Decision:** All reviewer-role accounts share one pending queue in the
MVP.

**Reason:** Avoids assignment workflow complexity.

**Consequence:** Reviewer assignment can be added later without changing
the basic submission/version model.

## ADR-007 --- Verification Code Derivation

**Status:** Recommended\
**Decision:** Derive a stable code from a credential UUID using a
server-held HMAC secret; store a digest for lookup.

**Reason:** The owner can retrieve the same code without storing the raw
code in plaintext.

**Consequence:** Keep key-version support and backups for the HMAC
secret. Secret loss/rotation requires a credential migration plan.
