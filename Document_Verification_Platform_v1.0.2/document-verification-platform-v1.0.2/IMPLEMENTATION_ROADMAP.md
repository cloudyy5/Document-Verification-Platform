# IMPLEMENTATION_ROADMAP.md

## Document Verification Platform --- Codex Development Plan

**Version:** 1.0\
**Approach:** Small, reviewable phases; do not generate the entire
product in one prompt.

------------------------------------------------------------------------

## Phase 0 --- Repository and Technical Foundation

Deliverables: - Next.js App Router project. - TypeScript strict mode. -
Tailwind CSS and approved design tokens. - Supabase client setup. -
ESLint and formatting. - Vitest, Playwright, and basic CI. - Environment
validation. - Shared application shell.

Acceptance: - Application runs locally. - Light/Dark theme works. - No
secrets are exposed in client bundle. - No product feature is mocked as
if it were connected to a real backend.

## Phase 1 --- Database and Access Control

Deliverables: - Initial SQL migration. - Profile and role setup. -
Document and submission tables. - Review and verification tables. - RLS
policies. - Seed categories. - RLS tests.

Acceptance: - User A cannot access User B's data. - User cannot assign
themselves reviewer/admin. - Reviewer can access only permitted review
data. - Privileged roles are tested.

## Phase 2 --- Authentication

Deliverables: - Register. - Login. - Logout. - Email verification. -
Password reset. - Role-aware redirects. - Protected layouts and routes.

Acceptance: - Every protected page checks session server-side. -
Unverified user cannot submit if that rule is approved. - User role is
assigned by the system, not form input.

## Phase 3 --- User Workspace

Order: 1. Dashboard Overview. 2. My Documents. 3. Submit Document. 4.
Document Detail. 5. Verify Document. 6. Profile & Settings.

Acceptance: - Use actual API/database data. - Follow high-fidelity
visual references and `DESIGN_SYSTEM.md`. - Match
`MOBILE_LAYOUT_SPEC.md`. - Include loading, empty, error, and success
states. - Enforce owner-only access.

## Phase 4 --- Administrative Review

Order: 1. Admin Overview. 2. Review Queue. 3. Review Detail. 4. Review
History.

Acceptance: - Four mandatory checklist criteria. - Approve, revision,
reject. - Atomic decision transaction. - Immutable decision history. -
Private PDF preview. - In-app notifications.

## Phase 5 --- Verification Engine

Order: 1. Verification code generation. 2. QR generation. 3. Owner-only
code verification. 4. Authenticated QR route. 5. Temporary PDF upload.
6. Server-side SHA-256 comparison. 7. Multiple match and revoked states.

Acceptance: - No public or cross-account lookup. - Hash only matches
byte-identical files. - Temporary comparison file is discarded. -
Verification events are audited.

## Phase 6 --- Administration Extensions

Only after policy approval: - User Management. - Role assignment. -
System Settings. - Revocation UI. - Category management UI. - Email
notification provider. - Reviewer assignment.

## Phase 7 --- Hardening and Release

Deliverables: - Security review. - RLS tests. - Upload scanning. - Rate
limiting. - Responsive and accessibility QA. - Backups and recovery. -
Staging UAT. - Production deployment.

Acceptance: - All production release gates in `TESTING_STRATEGY.md` and
`DEPLOYMENT_RUNBOOK.md` pass.

------------------------------------------------------------------------

## Codex Working Rules

-   Work on one phase at a time.
-   Before each phase, inspect the repository and relevant docs.
-   Do not overwrite working code without explaining the change.
-   Do not fabricate data or backend success.
-   Do not implement privileged UI controls before permission policy is
    approved.
-   Write tests with each feature.
-   Update documentation whenever implementation differs from a spec.
-   Report files changed, commands run, tests passed/failed, and
    unresolved decisions after each phase.
