# BUSINESS_LOGIC_AND_STATE_MACHINE.md

## Document Verification Platform --- Business Rules

**Version:** 1.0

------------------------------------------------------------------------

## 1. Submission Lifecycle

``` mermaid
stateDiagram-v2
    [*] --> pending_review: User submits PDF
    pending_review --> approved: All 4 checks pass
    pending_review --> revision_requested: Fixable issue + note
    pending_review --> rejected: Policy/ineligibility issue + reason
    revision_requested --> pending_review: User submits new version
    approved --> revoked: Authorized platform action + reason
    rejected --> [*]: Terminal submission
    revoked --> [*]: Terminal registered document
```

### Status meaning

  Status                 Meaning
  ---------------------- -----------------------------------------------
  `pending_review`       Waiting for administrative review
  `revision_requested`   User must correct the submission
  `approved`             Passed administrative review and registered
  `rejected`             Not accepted for registration
  `revoked`              Previously approved record has been withdrawn

`revoked` applies to the logical document record. The historical
submission remains approved as a historical review result.

## 2. Versioning

-   First upload creates a document and submission version 1.
-   A revision request does not overwrite the submitted file or
    metadata.
-   User resubmission after `revision_requested` creates a new
    submission version.
-   Previous versions and decisions remain immutable.
-   `documents.current_version_no` points to the current submission
    version.
-   The current document status is updated to `pending_review` when a
    new revision is submitted.
-   The hash-matching search uses the current approved version only.
-   Editing an approved document is not supported in MVP; submit a new
    document record if a different file needs registration.

## 3. Review Checklist

Exactly four criteria:

1.  Kelengkapan.
2.  Keterbacaan.
3.  Kesesuaian kategori.
4.  Kelayakan pendaftaran.

Each criterion must have a boolean result. No implicit or blank
checklist values.

### Approval

-   All four criteria must be `true`.
-   Reviewer confirms the decision.
-   System records reviewer, timestamp, checklist, and optional note.
-   System creates the verification credential in the same logical
    transaction.
-   User receives an in-app notification.

### Request revision

-   At least one criterion must be `false`.
-   Reviewer note is mandatory and must explain the fix.
-   Status becomes `revision_requested`.
-   User may submit a new version.
-   Earlier review decision remains in history.

### Reject

-   At least one criterion must be `false`.
-   Reason is mandatory and must relate to the published platform policy
    or eligibility.
-   Status becomes `rejected`.
-   No active verification credential is issued.
-   A rejected submission is terminal under the recommended MVP policy.
    A new attempt must be submitted as a new document record.

## 4. Verification Rules

### Code

-   User must be logged in.
-   Code is looked up by digest.
-   The resulting document owner must match the current user.
-   If the code is absent or belongs to another user, return a generic
    no-match response.

### QR

-   QR contains an internal route with the code.
-   Login is required.
-   Owner check is mandatory.
-   QR is not a public verification credential.

### SHA-256

-   User uploads a PDF for comparison.
-   Server validates and hashes the exact bytes.
-   Search all current approved document versions owned by the current
    user.
-   Include revoked documents that were previously approved, but show
    them as revoked.
-   Return all matching records.
-   Do not search other accounts.
-   Do not create a new document submission from the comparison upload.
-   Do not retain the temporary comparison file.

## 5. Concurrency

When two reviewers open the same pending submission: - both may inspect
it; - only one final decision may commit; - the decision transaction
locks the submission row; - the second decision attempt returns a
conflict; - the first decision remains immutable.

## 6. Duplicate Uploads

Recommended behavior for MVP: - Do not silently deduplicate or merge
user submissions. - Optionally warn the owner if the same SHA-256
already exists in their own records. - The warning must not reveal
another account's records. - The owner may navigate to an existing
matching document if authorized. - Cross-account duplicate detection is
not exposed.

## 7. Revocation

The existing product status includes `revoked`, but authority and
process need final owner approval.

Recommended policy: - Only `platform_admin` may revoke. - Reason is
mandatory. - Revocation is recorded as an immutable audit event. -
QR/code and hash results continue to resolve to the record but show
`revoked`. - No silent deletion or rewriting of prior approval
history. - Revoke UI/API remains disabled until the owner approves the
policy.

## 8. Notification Events

In-app notifications: - submission received; - revision requested; -
approved; - rejected; - revoked (if enabled).

Email notifications are optional until an email provider and
notification policy are selected.

## 9. Product Claim Language

Preferred: - "Dokumen lolos pemeriksaan administratif." - "Dokumen
terdaftar pada platform." - "File memiliki hash yang cocok dengan file
yang terdaftar." - "Dokumen berstatus dicabut."

Avoid: - "Dokumen pasti asli." - "Dokumen sah secara hukum." - "Penerbit
telah terautentikasi."

Administrative review and hash equality do not prove issuer authenticity
or legal validity.
