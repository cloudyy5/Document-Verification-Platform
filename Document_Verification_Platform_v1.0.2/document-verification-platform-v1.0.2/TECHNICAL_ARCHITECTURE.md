# TECHNICAL_ARCHITECTURE.md

## Document Verification Platform --- MVP Architecture

**Version:** 1.0\
**Status:** Recommended architecture; final owner approval required for
listed product decisions\
**Architecture style:** Modular monolith / Backend-for-Frontend\
**Target:** Responsive web application

------------------------------------------------------------------------

## 1. Architecture Goals

The MVP must:

1.  Provide a responsive User Workspace and Admin Workspace.
2.  Require an account for all document operations.
3.  Enforce document ownership on the server and database.
4.  Store submitted PDFs privately.
5.  Support a traceable administrative review process.
6.  Issue a verification code and QR only after approval.
7.  compare SHA-256 hashes only against approved documents owned by the
    active user.
8.  Preserve review and audit history.
9.  Keep the implementation simple enough for a small team and
    Codex-assisted development.

## 2. Recommended Technology Stack

  -----------------------------------------------------------------------
  Layer                   Recommendation          Responsibility
  ----------------------- ----------------------- -----------------------
  Web framework           Next.js App Router      Pages, layouts, server
                                                  rendering, Route
                                                  Handlers

  Language                TypeScript              Shared types and
                                                  compile-time checks

  Styling                 Tailwind CSS            Utility styling driven
                                                  by the approved design
                                                  tokens

  UI primitives           shadcn/ui, customized   Accessible primitives;
                                                  not a ready-made
                                                  dashboard theme

  Icons                   lucide-react            Consistent interface
                                                  icons

  Forms                   React Hook Form + Zod   Client form behavior
                                                  and schema validation

  Authentication          Supabase Auth           Registration, login,
                                                  password recovery,
                                                  sessions

  Database                Supabase PostgreSQL     Relational application
                                                  data

  File storage            Supabase Storage,       Submitted PDF objects
                          private bucket          

  Server data access      Supabase JS clients     User-scoped reads and
                                                  privileged server
                                                  operations

  PDF viewer              PDF.js / React-PDF      Controlled PDF preview
                          after compatibility     
                          validation              

  Hashing                 Node.js `node:crypto`   Server-side SHA-256 and
                                                  HMAC

  QR generation           `qrcode` package or     Generate QR image from
                          equivalent              the protected
                                                  verification route

  Unit/integration tests  Vitest                  Business logic and
                                                  service tests

  UI/E2E tests            Playwright              End-to-end workflows

  Database policy tests   pgTAP / Supabase CLI    RLS allow/deny tests

  Hosting                 Vercel                  Next.js application

  Managed backend         Supabase                Auth, PostgreSQL,
                                                  private storage
  -----------------------------------------------------------------------

The stack is a recommendation for the MVP, not a requirement to buy a
paid plan before local development. Confirm service limits, regional
availability, pricing, and data-processing terms before production.

## 3. Application Architecture

``` mermaid
flowchart TB
    U[User Workspace]
    A[Admin Workspace]
    N[Next.js App Router]
    DAL[Server Data Access Layer]
    AUTH[Supabase Auth]
    DB[(PostgreSQL)]
    STORE[(Private PDF Storage)]
    HASH[SHA-256 / HMAC Service]
    QR[QR Code Generator]
    AUDIT[Audit and Notification Services]

    U --> N
    A --> N
    N --> DAL
    DAL <--> AUTH
    DAL <--> DB
    DAL <--> STORE
    DAL --> HASH
    DAL --> QR
    DAL --> AUDIT
```

### Request flow

1.  Browser sends a request to a Next.js page, Server Action, or Route
    Handler.
2.  Server validates the authenticated session.
3.  Server checks role and resource ownership.
4.  Server validates input using Zod and server-side rules.
5.  Server performs the operation through a user-scoped Supabase client
    or a server-only privileged client.
6.  Database constraints and RLS provide an additional protection layer.
7.  The server returns a minimum necessary response.
8.  Sensitive actions are written to the audit log.

## 4. Application Structure

Recommended source structure:

``` text
src/
  app/
    (auth)/
      login/
      register/
      forgot-password/
      reset-password/
    (user)/
      dashboard/
      documents/
      documents/[documentId]/
      submit/
      verify/
      profile/
    (admin)/
      admin/
        overview/
        review-queue/
        review-queue/[submissionId]/
        review-history/
        users/
        settings/
    api/
      v1/
        ...
  components/
    ui/
    layout/
    user/
    admin/
    documents/
    verification/
  lib/
    auth/
    authorization/
    supabase/
    validation/
    documents/
    verification/
    audit/
    notifications/
    rate-limit/
  server/
    services/
    repositories/
    policies/
  types/
supabase/
  migrations/
  seed.sql
  tests/
```

Keep privileged Supabase clients and service code in server-only
modules. Add `import "server-only"` to modules that must never enter a
client bundle.

## 5. Authentication and Authorization

### Authentication

-   Use Supabase Auth rather than writing a custom password system.
-   Use the Next.js SSR integration and cookie-based sessions.
-   Use the PKCE flow where required by the current Supabase guidance.
-   Public registration creates only a normal `user` role.
-   Reviewer and platform-admin privileges are granted manually through
    a secure operator process.
-   Recommended: require verified email before the first document
    submission.
-   Recommended: require MFA for platform administrators before
    production.

### Authorization

Use three logical roles:

  ---------------------------------------------------------------------
  Role                               Permissions
  ---------------------------------- ----------------------------------
  `user`                             Submit and access only own
                                     documents; verify only own
                                     documents

  `reviewer`                         Access shared review queue;
                                     preview submissions; make review
                                     decisions

  `platform_admin`                   View operational administration
                                     and manage approved platform-level
                                     operations
  ---------------------------------------------------------------------

A single account may hold both `reviewer` and `platform_admin`. The
platform-admin role does not automatically grant access to private
document contents; document review permission remains separate.

For the initial MVP, all reviewers share one review queue. Per-reviewer
assignment is a later extension.

Every protected request must check authorization on the server. Hiding a
menu item is not an authorization mechanism.

## 6. Database and Storage Boundaries

-   PostgreSQL stores metadata, states, review decisions, verification
    credentials, notifications, and audit events.
-   Supabase Auth stores authentication identities.
-   Supabase Storage stores PDF bytes in a private bucket.
-   Store only an opaque storage path in application tables, not a
    public URL.
-   Original filename is metadata only; never use it as the storage
    object path.
-   All file operations are performed through authorized server code in
    the MVP.
-   A privileged storage key is server-only and must never be exposed to
    the browser.

## 7. File Processing

### Submission upload

1.  Authenticate the user.
2.  Validate metadata and consent.
3.  Enforce the configured size limit.
4.  Inspect extension, MIME claim, PDF signature, and parseability.
5.  Reject malformed or password-protected PDFs under the recommended
    MVP default.
6.  Run malware scanning before public production.
7.  Calculate SHA-256 from the exact file bytes on the server.
8.  Upload to the private bucket using a generated opaque path.
9.  Insert document and submission rows in a consistent
    transaction/workflow.
10. Set the initial status to `pending_review`.
11. Create audit and in-app notification records.
12. Return the submission reference and status.

If storage succeeds but the database transaction fails, run compensating
cleanup. If the database record is created but storage fails, roll back
or mark the upload as failed and ensure it never enters the review
queue.

### Hash comparison upload

-   Authenticate the user.
-   Accept a temporary PDF.
-   Validate it and calculate SHA-256 on the server.
-   Search only current approved document versions owned by that user.
-   Include previously approved but revoked documents in the result with
    a revoked label.
-   Do not register the temporary file.
-   Do not retain the temporary file after processing.
-   Do not log the raw PDF or the full hash input.

## 8. Verification Identity

Recommended implementation:

-   On approval, create one verification credential record per document.
-   Generate a random credential UUID.
-   Derive a stable verification code on the server using HMAC-SHA-256
    with `VERIFICATION_CODE_SECRET` and the credential UUID.
-   Store only a SHA-256 digest of the displayed code plus the key
    version.
-   Re-derive the code server-side when the owner views the approved
    document.
-   QR content is a URL to the authenticated internal verification route
    containing the code.
-   The QR and code are identifiers, not authentication credentials.
-   Every code/QR request still requires login and an owner check.

Suggested display format: `DVP-` followed by 32 hexadecimal characters.
The exact prefix can be branded later.

If the secret is rotated, maintain key-version support for existing
credentials. Do not invalidate all issued codes accidentally.

## 9. Review Transaction

A review decision must be atomic:

1.  Begin database transaction.
2.  Lock the target submission row.
3.  Verify current status is `pending_review`.
4.  Verify reviewer role.
5.  Validate all four checklist fields.
6.  Validate decision-specific note.
7.  Insert immutable review decision.
8.  Update submission status and document current status.
9.  If approved, create verification credential exactly once.
10. Insert audit and in-app notification events.
11. Commit.

If another reviewer has already decided, return
`409 REVIEW_ALREADY_DECIDED`; do not overwrite the decision.

## 10. Deployment Topology

Recommended MVP topology:

-   Vercel: Next.js application.
-   Supabase: Auth, PostgreSQL, private Storage.
-   GitHub: source control and CI.
-   Domain: custom HTTPS domain selected by the product owner.
-   Email provider: selected before enabling production email
    notifications.
-   Malware scanning service: selected before public production launch.

Keep the application and Supabase project in compatible nearby regions
where possible. Confirm data residency and provider terms before
production.

## 11. Operational Principles

-   Use migrations for all schema changes.
-   Never edit production schema manually without recording a migration.
-   Keep separate development, staging, and production environments.
-   Use synthetic documents and accounts in development.
-   Back up the database and test restoration.
-   Monitor upload failures, review decision errors, authentication
    errors, and verification failures.
-   Do not enable shared caching for authenticated pages or responses
    containing user session cookies.
-   Use `Cache-Control: private, no-store` for sensitive document
    responses.

## 12. Official Technical References

-   Next.js App Router: https://nextjs.org/docs/app
-   Next.js Route Handlers:
    https://nextjs.org/docs/app/getting-started/route-handlers
-   Next.js Authentication Guide:
    https://nextjs.org/docs/app/guides/authentication
-   Supabase Server-Side Auth:
    https://supabase.com/docs/guides/auth/server-side
-   Supabase PostgreSQL RLS:
    https://supabase.com/docs/guides/database/postgres/row-level-security
-   Supabase Storage Access Control:
    https://supabase.com/docs/guides/storage/security/access-control
-   Supabase Private Buckets:
    https://supabase.com/docs/guides/storage/buckets/fundamentals

## 13. Transactional Database Functions

The supplied second migration provides: - `create_document_submission` -
`create_document_resubmission` - `apply_review_decision`

Use these authenticated RPCs for atomic database state changes.
Uploading a file to Storage and creating its database record cannot be
one distributed transaction; implement a compensating cleanup step if
the database RPC fails after the private object upload.

The review decision RPC locks the submission/document rows, checks
reviewer role and current state, validates the four checklist values,
inserts an immutable decision, updates status, creates the verification
credential on approval, and records audit/notification rows in one
database transaction.


### Trusted-server invocation rule

The workflow RPC functions are granted to `service_role` only. Next.js Route Handlers must first validate the Supabase session, derive the owner/reviewer ID from that session, check the required role, and only then invoke the RPC using the server-only privileged client. Never accept an owner/reviewer ID from browser input. The SQL functions independently validate that the supplied identity exists and has the required role.
