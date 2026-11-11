# API_SPECIFICATION.md

## Document Verification Platform --- API Contract

**Version:** 1.0\
**API base path:** `/api/v1`\
**Transport:** HTTPS in production; JSON except multipart upload
endpoints\
**Authentication:** Supabase Auth session, verified server-side

------------------------------------------------------------------------

## 1. General Rules

-   Every private endpoint requires an authenticated session.
-   All ownership and role checks happen on the server.
-   Do not accept `owner_id`, `reviewer_id`, or role values from the
    browser as trusted identity.
-   IDs are UUIDs.
-   Use cursor pagination for potentially large lists.
-   Use UTC timestamps in API responses.
-   Use `Cache-Control: private, no-store` for private responses.
-   Mutating endpoints should support an idempotency key where duplicate
    requests could create duplicate records.
-   Return `404` for resources outside the user's scope to avoid
    confirming that another user's document exists.
-   Return `409` for state conflicts, such as a submission already
    reviewed.
-   Return minimal data; do not expose storage paths or internal
    credentials.

## 2. Response Envelope

Success:

``` json
{
  "data": {},
  "meta": {
    "requestId": "uuid"
  }
}
```

Error:

``` json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Periksa kembali data yang dikirim.",
    "fields": [],
    "requestId": "uuid"
  }
}
```

Do not include stack traces, SQL errors, secret values, storage keys, or
another user's metadata.

## 3. Authentication

Authentication endpoints are handled by Supabase Auth through the
approved server-side integration: - Register. - Login. - Logout. -
Verify email. - Request password reset. - Complete password reset.

The application must still protect every server page and Route Handler.
A successful login does not automatically authorize a role-specific
action.

## 4. User Endpoints

### `GET /api/v1/me`

Returns the current profile and the roles resolved by the server.

### `PATCH /api/v1/profile`

Updates allowed profile fields only.

Allowed fields: - `fullName` - `phone`

Do not allow role, account status, owner ID, or email to be changed
through this endpoint.

### `GET /api/v1/dashboard`

Returns owner-scoped counts and recent submissions.

### `GET /api/v1/categories`

Returns active classification categories. Categories do not define a
closed document acceptance list.

### `GET /api/v1/documents`

Query parameters: - `q` - `status` - `categoryId` - `from` - `to` -
`cursor` - `limit`

Always filter by authenticated owner ID on the server.

### `POST /api/v1/documents`

Content type: `multipart/form-data`

Fields: - `title` (required) - `categoryId` (required) -
`customDocumentType` (required only for `Lainnya`) - `documentDate`
(optional) - `issuingInstitution` (optional) - `description`
(optional) - `policyVersion` (required) - `consent` (must be true) -
`file` (required PDF)

The owner ID is derived from the session and is not accepted as an input
field.

Success response includes: - `documentId` - `submissionId` -
`versionNo` - `status: pending_review` - `submittedAt`

It must not include an active verification code or QR.

### `GET /api/v1/documents/:documentId`

Returns metadata and status only when the current user owns the
document.

### `GET /api/v1/documents/:documentId/file`

Streams the file only after owner authorization. The server retrieves
the private object; do not return a public storage URL.

### `GET /api/v1/documents/:documentId/verification-identity`

Owner-only; only available when document status is `approved` or
`revoked`.

Returns: - verification code derived server-side; - QR image or QR
payload; - status; - current approved version hash where policy permits.

For revoked records, clearly return `revoked` and do not describe the
record as currently valid.

### `POST /api/v1/documents/:documentId/resubmissions`

Creates a new submission version only when the current document status
is `revision_requested`.

Fields follow the same approved metadata structure and include a new PDF
and current policy consent.

The previous submission and review decision remain immutable.

### `GET /api/v1/notifications`

Returns notifications belonging to the current user.

### `PATCH /api/v1/notifications/:notificationId/read`

Marks one notification as read if it belongs to the current user.

## 5. Verification Endpoints

### `POST /api/v1/verify/code`

Body:

``` json
{
  "code": "DVP-..."
}
```

Process: 1. Authenticate user. 2. Normalize code. 3. Calculate digest.
4. Find credential by digest. 5. Check document owner equals current
user. 6. Return document metadata and approved/revoked status. 7. Record
a verification event without storing the raw code.

If the code is not found or belongs to another account, return a generic
no-match response.

### `GET /verify/qr?code=...`

The QR route: - requires authentication; - redirects unauthenticated
users to login with a validated same-origin return path; - verifies the
code using the same owner-only logic; - must not expose a public
verification page.

### `POST /api/v1/verify/hash`

Content type: `multipart/form-data`

Field: - `file` (PDF required)

Process: 1. Authenticate user. 2. Validate PDF and configured size. 3.
Calculate SHA-256 on the server. 4. Search all current approved document
versions belonging to the authenticated user. 5. Include previously
approved but revoked records with a revoked status. 6. Return all
matching records. 7. Discard temporary file bytes after processing. 8.
Record method/result/matched count without storing the file or raw
content.

A hash match means byte-for-byte identity. It does not prove issuer
authenticity or legal validity.

## 6. Admin Endpoints

All admin routes require role authorization.

### `GET /api/v1/admin/overview`

Requires `reviewer` or `platform_admin` according to each widget's
permission. Return aggregate metrics only. Document previews remain
reviewer-only.

### `GET /api/v1/admin/review-queue`

Requires `reviewer`.

Query parameters: - `q` - `status` - `categoryId` - `submittedFrom` -
`submittedTo` - `cursor` - `limit`

MVP queue policy: all reviewer-role accounts share one queue. Default
ordering is oldest pending submission first.

### `GET /api/v1/admin/submissions/:submissionId`

Requires `reviewer`. Returns the submission metadata and checklist
state.

### `GET /api/v1/admin/submissions/:submissionId/preview`

Requires `reviewer`. Streams a private PDF after authorization. Do not
return a public URL.

### `POST /api/v1/admin/submissions/:submissionId/decision`

Requires `reviewer`.

Body:

``` json
{
  "decision": "approved",
  "checklist": {
    "completeness": true,
    "readability": true,
    "category_match": true,
    "registration_eligibility": true
  },
  "note": ""
}
```

Validation: - All four checklist keys are required booleans. -
`approved` requires all four true. - `revision_requested` requires at
least one false and a clear note. - `rejected` requires at least one
false and a policy-based reason. - The submission must still be
`pending_review`. - The operation must be atomic. - A conflict returns
`409`.

### `GET /api/v1/admin/review-history`

Requires `reviewer`. Supports search, status, category, reviewer, and
date filters.

### `POST /api/v1/admin/documents/:documentId/revoke`

Not enabled in the initial MVP until the owner approves the revocation
policy and grants the role. If activated later, it requires
platform-admin permission and a mandatory reason.

## 7. Deferred Admin Endpoints

The following UI references are not authorization to implement
privileged operations: - user creation and role changes; - account
suspension/deletion; - system-wide configuration; - category management
through UI; - bulk export of personal documents.

Add endpoints only after the permission policy is approved.

## 8. HTTP Status Codes

  Code   Use
  ------ -------------------------------------------------
  200    Successful read/update
  201    Resource created
  202    Accepted asynchronous processing
  400    Malformed request
  401    Not authenticated
  403    Authenticated but role not authorized
  404    Not found or outside caller's scope
  409    State conflict or duplicate idempotency request
  413    Upload exceeds configured limit
  415    Unsupported file type
  422    File or field validation failed
  429    Rate limit exceeded
  500    Unexpected server error

## 9. Rate Limits

Apply configurable limits to: - login and password recovery (provider
controls plus application monitoring); - code verification attempts; -
QR resolution attempts; - PDF uploads; - hash comparison uploads; -
admin decision endpoints.

Use a distributed rate limiter in production; do not rely on in-memory
counters in serverless instances.


Implementation note: the database workflow RPCs are service-role-only. Route Handlers must authenticate and authorize the current session first, derive owner/reviewer IDs server-side, and then call the RPC with the server-only privileged client. The browser must never call these privileged RPCs directly.
