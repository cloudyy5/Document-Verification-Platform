# SECURITY_ARCHITECTURE.md

## Document Verification Platform --- Security and Privacy Controls

**Version:** 1.0\
**Scope:** MVP and production-readiness requirements

------------------------------------------------------------------------

## 1. Security Objectives

-   Prevent one user from reading or verifying another user's documents.
-   Prevent unauthorized review or administrative actions.
-   Keep submitted PDFs private.
-   Protect credentials and verification identifiers.
-   Preserve trustworthy review history.
-   Reduce the risk of malicious or malformed PDF uploads.
-   Avoid claims that administrative approval proves legal authenticity.

## 2. Threat Model

  -----------------------------------------------------------------------
  Threat                              Required control
  ----------------------------------- -----------------------------------
  Insecure direct object reference    Server-side owner checks for every
  (IDOR)                              document/submission ID

  Role escalation                     Roles stored separately; no client
                                      role mutation

  Public PDF leakage                  Private bucket; authorized
                                      streaming endpoint

  Leaked service key                  Server-only secrets; secret
                                      scanning; no client bundle

  Malicious PDF                       Size/type/signature/parse
                                      validation; malware scanning before
                                      production

  MIME/extension spoofing             Inspect file bytes and parse the
                                      PDF

  Brute-force code guessing           High-entropy code, rate limiting,
                                      generic errors

  QR misuse                           QR requires login and owner check

  Hash privacy leakage                Search only current user's approved
                                      records; no cross-account response

  Concurrent reviewer decisions       Transactional row lock and state
                                      check

  Audit tampering                     Append-only review/audit records
                                      and restricted DB privileges

  Session leakage through caching     No shared cache for authenticated
                                      session responses

  Sensitive data in logs              Redaction and minimum metadata
                                      logging
  -----------------------------------------------------------------------

## 3. Authentication

-   Use Supabase Auth with server-side cookie sessions.
-   Require email verification before document submission (recommended
    MVP default; owner confirmation pending).
-   Use secure password recovery.
-   Do not implement custom password storage.
-   Require MFA for platform administrators before production
    (recommended).
-   Rotate/revoke sessions after password reset or suspicious account
    activity according to provider capabilities.

## 4. Authorization

Use layered controls:

1.  Server session validation.
2.  Role check.
3.  Resource ownership check.
4.  Database RLS.
5.  Storage privacy.
6.  Audit event for sensitive operations.

### Owner rules

-   User can read only `documents.owner_id = auth.uid()`.
-   User can read only submissions attached to an owned document.
-   User can read only review decisions attached to an owned document.
-   User can access verification identity only for an owned document.
-   Hash comparison query always includes the current owner ID.

### Admin rules

-   `reviewer` can access the shared review queue and private preview.
-   `platform_admin` does not automatically gain document content
    access.
-   A user may hold both roles.
-   No public endpoint can assign roles.
-   Role assignment is performed by a trusted operator.

## 5. Database RLS

-   Enable RLS on every application table exposed to the Supabase API.
-   Create explicit policies per operation.
-   Grant only the minimum SQL privileges.
-   Index columns used by RLS predicates, especially `owner_id`,
    `user_id`, and relationship keys.
-   Test both allowed and denied operations with separate test users.
-   Do not assume that hiding a route or button protects data.

Supabase secret/service keys bypass RLS. They must remain in server-only
modules and be used only after explicit server authorization.

## 6. File Storage

-   Bucket name: `document-submissions`.
-   Bucket visibility: private.
-   Storage path uses generated IDs, not the original filename.
-   Do not store public URLs in the database.
-   All file reads pass through an authenticated server route.
-   Reviewer download is disabled by default; preview only.
-   Set `Cache-Control: private, no-store` on private file responses.
-   Use short-lived signed URLs only if direct streaming is technically
    unsuitable; treat them as bearer links until expiry.
-   Do not expose service keys or signed URLs in analytics/logs.

## 7. PDF Upload Validation

Recommended MVP controls: 1. Enforce `MAX_PDF_SIZE_BYTES` on the server.
2. Allow only PDF content. 3. Check extension, MIME claim, and `%PDF-`
signature. 4. Parse the PDF and reject malformed files. 5. Reject
password-protected PDFs under the proposed MVP default. 6. Scan uploads
for malware before they enter the production review queue. 7. Store
files in private storage. 8. Generate opaque storage paths. 9. Never
execute embedded scripts or attachments. 10. Clean up partial uploads
and failed processing objects.

The maximum file size and encrypted-PDF policy remain owner decisions.
Proposed starting size: 20 MiB.

## 8. Hash Integrity

-   Calculate SHA-256 from raw file bytes on the server using Node.js
    crypto.
-   Never trust a hash supplied by the browser.
-   Recalculate hash for every new submitted file version.
-   Hash comparison searches only current approved versions owned by the
    active user.
-   Include a previously approved but revoked document in matches and
    display `revoked`.
-   Temporary comparison files are not registered and are discarded
    immediately after processing.
-   A hash match proves byte identity only; it does not establish issuer
    authenticity, content truth, or legal validity.

## 9. Verification Code and QR

-   Generate code only after approval.
-   Use high-entropy server-side generation.
-   Store a digest, not a raw code.
-   Derive/display code only through an owner-authorized server route.
-   QR contains the internal verification URL and code.
-   Require login and owner check for QR resolution.
-   Use generic no-match messages to avoid account enumeration.
-   Apply rate limits and log verification outcomes without logging raw
    codes.

## 10. Review Security

-   Reviewer must complete all four checklist items.
-   Approval requires all four items to pass.
-   Revision/rejection requires a note and at least one failed item.
-   Decisions are atomic and immutable.
-   Reviewer cannot modify the uploaded file.
-   A stale submission cannot be decided after another reviewer has
    changed its state.
-   Preview access and final decisions are auditable.

## 11. Browser and Application Security

-   HTTPS only in production.
-   Secure, HttpOnly, SameSite cookies as supported by the auth
    integration.
-   Content Security Policy.
-   `X-Content-Type-Options: nosniff`.
-   Frame restrictions for non-viewer pages.
-   CSRF protection appropriate to cookie-based mutation endpoints.
-   Input validation on both client and server.
-   Output encoding and safe rendering of user-provided document
    titles/metadata.
-   Avoid dangerous HTML injection.
-   Keep dependencies updated and run dependency/security scans.
-   Do not cache authenticated HTML or private file responses in a
    shared CDN cache.

## 12. Audit and Logging

Audit: - submission created; - upload validation failed; - private
preview accessed; - review decision; - revision resubmitted; -
verification method and result; - revocation if enabled; - privileged
role changes.

Do not log: - PDF contents; - passwords; - session tokens; - secret
keys; - raw verification codes; - unnecessary personal data.

## 13. Privacy and Retention

Before public launch, approve: - privacy policy; -
acceptable-use/content policy; - document retention duration; - account
deletion and document deletion behavior; - backup retention; - data
export process; - handling of documents containing sensitive personal
information; - support/reporting channel.

Do not invent a retention period. Until approved, production launch must
remain blocked for legal/privacy review.

## 14. Production Security Gate

The platform must not be publicly launched until: - RLS tests pass; -
owner-isolation tests pass; - privileged keys are verified absent from
client bundles; - private storage access is tested; - upload validation
and malware scanning are in place; - admin MFA is enabled; - rate
limiting is configured; - backups and restore are tested; - privacy,
content, and retention policies are approved.


## 15. Privileged Workflow RPCs

The initial workflow RPCs are executable by `service_role` only. A Next.js Route Handler must:
1. validate the user session;
2. derive the user ID from the verified session;
3. verify role/ownership;
4. pass that derived identity to the RPC;
5. never accept identity or role from browser-supplied fields.

The service key remains server-only. The RPC's own role/owner checks provide an additional guard, but they do not replace the Route Handler authorization check.
