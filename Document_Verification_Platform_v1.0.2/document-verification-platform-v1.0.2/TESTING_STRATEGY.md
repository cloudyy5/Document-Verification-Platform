# TESTING_STRATEGY.md

## Document Verification Platform --- Quality Assurance Plan

**Version:** 1.0

------------------------------------------------------------------------

## 1. Testing Layers

  -----------------------------------------------------------------------
  Layer                   Tool recommendation     Focus
  ----------------------- ----------------------- -----------------------
  Unit                    Vitest                  Validation, state
                                                  transitions, hash/code
                                                  utilities

  Component               React Testing Library   Forms, tables, status
                                                  components

  API integration         Vitest + test Supabase  Authorization,
                          project                 submission, review,
                                                  verification

  Database                Supabase CLI + pgTAP    RLS and constraints

  End-to-end              Playwright              Complete user and
                                                  reviewer journeys

  Security                Manual checklist +      IDOR, secrets, file
                          automated scans         handling, rate limits

  Responsive              Playwright device       Desktop, tablet, mobile
                          projects + manual       
                          review                  

  Accessibility           axe-core + keyboard     WCAG-oriented checks
                          testing                 
  -----------------------------------------------------------------------

## 2. Authentication Tests

-   Registration creates a normal `user` role only.
-   Unverified account cannot submit if email verification is enabled.
-   Login errors do not reveal whether an email exists.
-   Logout invalidates the session.
-   Password reset flow works.
-   User cannot grant themselves reviewer/admin roles.
-   Platform admin MFA is enforced before production if enabled.

## 3. Submission Tests

Positive: - Valid PDF and required metadata create a document and
version 1. - `Lainnya` requires custom document type. - Optional
date/institution/description may be blank. - Consent timestamp and
policy version are stored. - Owner ID comes from the authenticated
session. - Initial status is `pending_review`.

Negative: - Non-PDF extension. - PDF extension with non-PDF bytes. -
Incorrect MIME claim. - Malformed PDF. - Empty file. - Zero-byte file. -
File larger than configured limit. - Password-protected PDF under the
recommended policy. - Missing required title/category/file/consent. -
`Lainnya` without custom type. - Client-supplied owner ID is
ignored/rejected. - Duplicate request with same idempotency key does not
create duplicate submission.

## 4. Review Tests

-   Reviewer can list pending queue.
-   Normal user cannot access queue or preview.
-   Platform admin without reviewer role cannot preview documents.
-   Reviewer can read metadata and preview privately.
-   Approval requires all four checklist values true.
-   Revision requires at least one failed item and a note.
-   Rejection requires at least one failed item and a policy-based
    reason.
-   Only one decision can be committed per submission.
-   A second concurrent decision returns conflict.
-   Decision, checklist, reviewer ID, timestamp, and note are preserved.
-   Approval creates exactly one verification credential.
-   Revision resubmission creates a new version and preserves old
    version.
-   Rejected version remains terminal under the recommended default.

## 5. Ownership and RLS Tests

Create at least two separate test users, User A and User B.

  Test                                             Expected
  ------------------------------------------------ ---------------------------
  User A reads own document                        Allowed
  User A reads User B document                     Denied / 404
  User A reads User B submission                   Denied / 404
  User A reads User B PDF                          Denied
  User A requests User B verification code         Generic no-match
  User A scans User B QR                           Denied / generic no-match
  User A hash-searches User B document             No result
  Reviewer reads pending submission                Allowed
  Normal user reads review queue                   Denied
  Platform admin without reviewer role opens PDF   Denied
  User changes role through profile update         Denied

Test policies for SELECT, INSERT, UPDATE, DELETE and both `anon` and
`authenticated` database roles where applicable.

## 6. Verification Tests

### Code

-   Valid owner code returns the correct document.
-   Invalid code returns generic no-match.
-   Another user's code returns generic no-match.
-   Revoked document returns revoked state.
-   Pending/revision/rejected documents have no code.

### QR

-   QR resolves only after login.
-   Login return path is same-origin validated.
-   Owner check still occurs after login.
-   Revoked QR shows revoked state.
-   QR image cannot bypass the verification endpoint's authorization.

### Hash

-   Byte-identical PDF returns match.
-   One-byte change returns no match.
-   PDF metadata rewrite returns no match if bytes differ.
-   Multiple matching owner records return all matches.
-   Revoked approved record appears with revoked label.
-   Pending/revision/rejected records are excluded.
-   Another user's record is excluded.
-   Temporary file is not registered and is cleaned up.
-   Hash is computed server-side, not accepted from client.

## 7. Audit and Notification Tests

-   Submission creation creates an audit event.
-   Review decision creates an immutable event.
-   Preview access is recorded if required by policy.
-   Verification method/result is recorded without raw code or PDF.
-   User receives the correct in-app notification.
-   Notification failure does not roll back an already committed review
    decision.
-   Audit rows cannot be edited/deleted through normal application
    access.

## 8. UI and Responsive Tests

-   Light and Dark themes are readable.
-   Primary buttons have clear contrast.
-   Status uses text and color.
-   Empty/loading/error/success states exist.
-   User pages show only owner data.
-   Admin pages show only permitted data.
-   Desktop tables are readable.
-   Mobile tables become cards or accessible horizontal scroll.
-   Forms remain one column on phones.
-   PDF viewer supports zoom/page navigation.
-   Keyboard navigation and visible focus work.
-   Touch targets are large enough for mobile.

## 9. Release Gates

Do not release to production until: - all critical unit/integration
tests pass; - all RLS allow/deny tests pass; - owner-isolation tests
pass; - review concurrency tests pass; - file upload and malware
scanning are enabled; - no privileged key is present in client
bundles; - production backups and restore test are complete; - privacy
and retention policies are approved; - staging UAT is signed off.

## 10. Suggested CI Sequence

``` bash
npm ci
npm run lint
npm run typecheck
npm run test
npm run test:e2e
npm run build
supabase db lint
supabase test db
```

Use the exact scripts defined in the repository `package.json`; Codex
must create them and keep this document synchronized.
