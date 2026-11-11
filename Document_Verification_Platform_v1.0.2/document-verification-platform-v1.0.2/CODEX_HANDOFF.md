# CODEX_HANDOFF.md

## Handoff Paket Desain dan Perencanaan

**Project:** Document Verification Platform\
**Version:** 0.9\
**Purpose:** Give Codex a clear, controlled implementation brief after
design approval.

------------------------------------------------------------------------

## 1. Before Coding

Read these documents first:

1.  `PROJECT_BRIEF.md`
2.  `PRODUCT_REQUIREMENTS.md`
3.  `DOCUMENT_REVIEW_POLICY.md`
4.  `UPLOAD_FORM_SPEC.md`
5.  `SITEMAP.md`
6.  `USER_FLOW.md`
7.  `DESIGN_REFERENCE.md`
8.  `DESIGN_SYSTEM.md`
9.  `DESIGN_TOKENS.css`
10. `ADMIN_DASHBOARD_SPEC.md`
11. `UI_SCREEN_SPEC.md`
12. `MOBILE_LAYOUT_SPEC.md`

If two documents conflict: - Product access/security rules take
precedence over mockup appearance. - `UPLOAD_FORM_SPEC.md` is
authoritative for submission fields. - `DOCUMENT_REVIEW_POLICY.md` is
authoritative for reviewer decisions. - `DESIGN_SYSTEM.md` and
`DESIGN_TOKENS.css` are authoritative for visual tokens. - Mockup images
are illustrative visual references only.

Do not silently decide unresolved product or technical questions.

## 2. Visual Reference Assets

The `design-assets/` folder contains reference images: -
`01-user-dashboard-overview.png` - `02-user-my-documents.png` -
`03-user-submit-document-reference.png` -
`04-user-verify-document.png` - `05-admin-overview.png` -
`06-admin-workspace-screens.png` -
`07-user-detail-profile-verification-screens.png`

Use them to understand visual hierarchy, spacing, composition, and
component placement. Do not copy text or illustrative data blindly. Do
not treat a screenshot as a source of product truth where it conflicts
with written specifications.

## 3. Design Implementation Rules

-   Use the silver/white workspace and graphite sidebar identity.
-   Primary actions use the blue semantic token.
-   Support Light, Dark, and System theme preference.
-   Use Geist Sans for interface typography and Geist Mono for
    IDs/hash/code, with the fallbacks defined in the design system.
-   Use semantic CSS tokens; do not hardcode unrelated hex colors in
    individual components.
-   Use Lucide icons consistently.
-   Use responsive layouts rather than scaling the desktop screenshot
    down.
-   Keep User Workspace and Admin Workspace visually related but
    functionally distinct.
-   Avoid generic AI-dashboard patterns, excessive cards, decorative
    gradients, and meaningless charts.
-   Build reusable components and document variants.

## 4. Suggested Implementation Phases

### Phase 0 --- Technical Decisions

Before implementation, confirm: - frontend/backend framework and
hosting; - database; - authentication/session strategy; - private file
storage provider; - maximum PDF size; - PDF
encryption/password-protection policy; - reviewer/admin roles and
assignment scope; - email/notification provider; - retention and
deletion policy; - deployment environment.

The technology stack in earlier planning documents is a recommendation,
not an approved final choice.

### Phase 1 --- Foundation

-   Create application shell and route protection.
-   Implement design tokens and Light/Dark/System theme.
-   Build shared components.
-   Implement authentication and role/permission checks.
-   Create database migrations and seed data for development.

### Phase 2 --- User Workspace

-   Dashboard Overview.
-   My Documents.
-   Submit Document.
-   Document Detail.
-   Verify Document.
-   Profile & Settings.

### Phase 3 --- Administrative Review

-   Admin Overview.
-   Review Queue.
-   Review Detail with private PDF preview.
-   Four-part checklist.
-   Approve / Request Revision / Reject workflow.
-   Review History and audit events.

### Phase 4 --- Optional Administration

Only after product permissions and policies are approved: - User
Management. - System Settings. - Category management. - Reviewer
assignment and role administration.

### Phase 5 --- Hardening and QA

-   Access-control tests.
-   File validation and malware scanning strategy.
-   Hash matching tests.
-   QR/code tests.
-   Audit log tests.
-   Light/Dark theme review.
-   Responsive testing.
-   Accessibility review.
-   Backup, retention, and recovery tests.
-   Production deployment review.

## 5. Security Requirements --- Never Infer from UI

-   Enforce ownership and role checks on the backend for every protected
    request.
-   Do not rely on hidden buttons or frontend route guards alone.
-   Store submitted PDFs in private storage.
-   Validate uploaded file content on the server; do not trust filename
    or browser MIME type alone.
-   Calculate SHA-256 on the server.
-   Hash comparison must be limited to approved documents owned by the
    authenticated user.
-   A PDF used for hash comparison is not automatically registered.
-   QR routes must require authentication and enforce owner access.
-   Do not issue active verification code or QR before approval.
-   Record reviewer ID, timestamp, checklist, decision, and decision
    note.
-   Do not expose secrets or storage credentials in frontend code.
-   Apply rate limits to login, code lookup, QR resolution, and upload
    endpoints.
-   Treat a hash match as byte identity, not proof of legal
    authenticity.

## 6. Data and Demo Content

-   Use synthetic seed data only in development.
-   Mark all demo records as sample data.
-   Never use actual personal documents in screenshots or seed fixtures.
-   Production dashboards must query real authorized data.
-   Do not hardcode the illustrative numbers shown in mockups.

## 7. Definition of Done

A screen is not complete just because it resembles the screenshot. It
must: - render with real application data; - enforce permissions; -
handle loading, empty, error, and success states; - validate forms on
client and server; - work with keyboard and assistive technologies; - be
responsive; - support both themes; - pass relevant automated and manual
tests; - follow the approved product policy.

## 8. Important Scope Boundary

The mockups for User Management and System Settings are design
references. They do not automatically authorize implementation of
privileged account actions or sensitive platform configuration. Obtain
explicit product decisions before activating those controls.

## 9. Mobile Implementation

Use `MOBILE_LAYOUT_SPEC.md` for mobile navigation, card/list conversion,
single-column forms, review-detail stacking, and touch-target rules. Do
not simply scale desktop layouts down. Capture responsive screenshots
after implementation and compare them against the design system and
mobile acceptance criteria.

## 10. Transactional Database Operations

Use the workflow RPCs supplied in: -
`supabase/migrations/202611010001_initial_schema.sql` -
`supabase/migrations/202611010002_workflow_rpcs.sql`

The initial upload flow is a storage/database saga: upload to the
private bucket using a generated owner-scoped path, then call the
authenticated `create_document_submission` RPC. If the RPC fails, delete
the uploaded object and log cleanup failure. Do not report success
before both storage and database operations succeed.

Review decisions must use `apply_review_decision` so checklist
validation, state change, credential creation, audit, and notification
happen atomically.

QR URLs must contain only the opaque credential UUID, not the
verification code. Both QR and code verification require login and owner
checks.


The workflow RPC functions are service-role-only. The server must validate the user session and role first, derive the identity from the session, then call the RPC using the server-only privileged client. Never expose the privileged key or call these RPCs directly from browser code.
