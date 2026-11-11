# DATABASE_SCHEMA.md

## Document Verification Platform --- Relational Data Model

**Version:** 1.0\
**Database:** PostgreSQL via Supabase\
**Primary key convention:** UUID\
**Timestamp convention:** `timestamptz`, stored in UTC

------------------------------------------------------------------------

## 1. Design Principles

1.  Authentication identities are managed by Supabase Auth.
2.  A profile is separate from the authentication identity.
3.  Privileged roles are stored separately from user-editable profile
    fields.
4.  A `document` represents the owner's logical document record.
5.  Each submission/revision creates a new immutable file-version
    record.
6.  Review decisions are append-only.
7.  A verification credential is created only after approval.
8.  A document's current status is stored on `documents`; each
    submission version has its own review status.
9.  Private file bytes remain in Supabase Storage; PostgreSQL stores
    only metadata and an opaque storage path.
10. The owner ID is always derived from the authenticated session on the
    server.

## 2. Entity Relationship Diagram

``` mermaid
erDiagram
    AUTH_USERS ||--|| PROFILES : has
    AUTH_USERS ||--o{ USER_ROLES : assigned
    AUTH_USERS ||--o{ DOCUMENTS : owns
    DOCUMENT_CATEGORIES ||--o{ DOCUMENT_SUBMISSIONS : classifies
    DOCUMENTS ||--o{ DOCUMENT_SUBMISSIONS : contains_versions
    DOCUMENT_SUBMISSIONS ||--o| REVIEW_DECISIONS : receives
    AUTH_USERS ||--o{ REVIEW_DECISIONS : reviews
    DOCUMENTS ||--o| VERIFICATION_CREDENTIALS : receives
    AUTH_USERS ||--o{ NOTIFICATIONS : receives
    AUTH_USERS ||--o{ VERIFICATION_EVENTS : performs
    AUTH_USERS ||--o{ AUDIT_LOGS : acts

    PROFILES {
      uuid id PK
      text full_name
      text phone
      text avatar_path
      timestamptz created_at
    }
    USER_ROLES {
      uuid user_id PK
      app_role role PK
      uuid granted_by
      timestamptz created_at
    }
    DOCUMENT_CATEGORIES {
      uuid id PK
      text name
      text slug UK
      boolean is_active
    }
    DOCUMENTS {
      uuid id PK
      uuid owner_id FK
      int current_version_no
      document_status current_status
      timestamptz registered_at
      timestamptz revoked_at
    }
    DOCUMENT_SUBMISSIONS {
      uuid id PK
      uuid document_id FK
      int version_no
      submission_status status
      uuid category_id FK
      text title
      text storage_path
      text sha256
      timestamptz submitted_at
    }
    REVIEW_DECISIONS {
      uuid submission_id PK
      uuid reviewer_id FK
      review_decision decision
      jsonb checklist
      text decision_note
      timestamptz created_at
    }
    VERIFICATION_CREDENTIALS {
      uuid id PK
      uuid document_id FK
      text code_digest UK
      int key_version
      timestamptz issued_at
    }
    NOTIFICATIONS {
      uuid id PK
      uuid user_id FK
      text type
      text title
      timestamptz read_at
    }
    AUDIT_LOGS {
      bigint id PK
      uuid actor_user_id
      text action
      text resource_type
      uuid resource_id
      timestamptz created_at
    }
    VERIFICATION_EVENTS {
      uuid id PK
      uuid user_id FK
      text method
      text result
      int matched_count
      timestamptz created_at
    }
```

`AUTH_USERS` is the Supabase-managed `auth.users` table and is not
recreated by the application.

## 3. Table Definitions

### 3.1 `profiles`

  -----------------------------------------------------------------------
  Column                  Type                    Rule
  ----------------------- ----------------------- -----------------------
  id                      uuid                    PK, references
                                                  `auth.users.id`

  full_name               text                    Optional at account
                                                  creation;
                                                  length-limited

  phone                   text                    Optional

  avatar_path             text                    Optional private/public
                                                  avatar path according
                                                  to future policy

  created_at              timestamptz             Server timestamp

  updated_at              timestamptz             Server timestamp
  -----------------------------------------------------------------------

Users can update only profile fields explicitly granted to them. Users
cannot update roles or account status through this table.

### 3.2 `user_roles`

  Column       Type          Rule
  ------------ ------------- ----------------------------------------
  user_id      uuid          FK to `auth.users.id`
  role         enum          `user`, `reviewer`, `platform_admin`
  granted_by   uuid          Nullable for initial default user role
  created_at   timestamptz   Server timestamp

Composite primary key: `(user_id, role)`.

-   New sign-ups receive only `user`.
-   Reviewer/admin roles are granted through a trusted operator process.
-   A user can have more than one role.
-   A platform administrator does not automatically receive reviewer
    access.

### 3.3 `document_categories`

Stores classification values. Categories are not a closed
document-acceptance list.

Suggested initial seed values: - Pendidikan - Pekerjaan - Organisasi -
Administrasi - Keuangan - Kesehatan - Hukum - Pribadi - Lainnya

`Lainnya` is required. A custom document type is required when that
category is selected.

### 3.4 `documents`

Represents the logical document owned by one user.

  Column               Type              Rule
  -------------------- ----------------- -------------------------------
  id                   uuid              PK
  owner_id             uuid              FK to auth user; immutable
  current_version_no   integer           Starts at 1
  current_status       document_status   Current logical status
  created_at           timestamptz       Server timestamp
  updated_at           timestamptz       Server timestamp
  registered_at        timestamptz       Set after approval
  revoked_at           timestamptz       Nullable
  revoked_by           uuid              Nullable
  revocation_reason    text              Nullable; required if revoked

### 3.5 `document_submissions`

Represents a submitted file version and metadata snapshot.

  Column                 Type                Rule
  ---------------------- ------------------- --------------------------------
  id                     uuid                PK
  document_id            uuid                FK to `documents.id`
  version_no             integer             Unique within a document
  status                 submission_status   Starts `pending_review`
  submitted_by           uuid                FK to auth user
  title                  text                Required
  category_id            uuid                FK to `document_categories.id`
  custom_document_type   text                Required only for `Lainnya`
  document_date          date                Optional
  issuing_institution    text                Optional
  description            text                Optional
  original_filename      text                Display metadata only
  mime_type              text                Must be validated as PDF
  file_size_bytes        bigint              Positive
  sha256                 char(64)            Lowercase hex SHA-256
  storage_bucket         text                Private bucket name
  storage_path           text                Opaque unique path
  policy_version         text                Required
  consented_at           timestamptz         Required
  submitted_at           timestamptz         Server timestamp
  created_at             timestamptz         Server timestamp

Constraints: - Unique `(document_id, version_no)`. - Unique
`(storage_bucket, storage_path)`. - File size must be positive. -
SHA-256 must be 64 lowercase hexadecimal characters. - The metadata
snapshot for an earlier submission is not silently overwritten. - No
document number field is included in the MVP.

### 3.6 `review_decisions`

One final decision per submission version.

  Column          Type          Rule
  --------------- ------------- ------------------------------------------
  submission_id   uuid          PK and FK to submission
  reviewer_id     uuid          FK to auth user
  decision        enum          approved / revision_requested / rejected
  checklist       jsonb         Four required boolean values
  decision_note   text          Required for revision/rejection
  created_at      timestamptz   Server timestamp

Required checklist keys: - `completeness` - `readability` -
`category_match` - `registration_eligibility`

Approval requires all four values to be `true`. Revision/rejection
requires an actionable note and at least one failed criterion.

Review decisions are immutable through the normal application UI.

### 3.7 `verification_credentials`

One credential per approved logical document.

  Column        Type          Rule
  ------------- ------------- -----------------------------------------
  id            uuid          PK; credential identity
  document_id   uuid          Unique FK to document
  code_digest   char(64)      Unique SHA-256 digest of displayed code
  key_version   smallint      HMAC key version
  issued_at     timestamptz   Set at approval

The raw code is derived on the server from the credential ID and the
server-held HMAC key. It is not returned to unauthenticated users and is
not stored in plaintext.

### 3.8 `notifications`

In-app notifications for submission, review, and verification events.

### 3.9 `audit_logs`

Append-only record of security-sensitive actions. Do not store file
bytes, passwords, session tokens, raw verification codes, or unnecessary
personal data.

### 3.10 `verification_events`

Stores verification method and result without storing the uploaded PDF
or raw code.

## 4. Status Model

`documents.current_status`: - `pending_review` - `revision_requested` -
`rejected` - `approved` - `revoked`

`document_submissions.status`: - `pending_review` -
`revision_requested` - `rejected` - `approved`

`revoked` belongs to the logical document because revocation affects the
registered record, not the historical fact that a submission was
approved.

## 5. Indexes

Required indexes: -
`documents(owner_id, current_status, updated_at desc)` -
`document_submissions(document_id, version_no desc)` -
`document_submissions(status, submitted_at)` -
`document_submissions(sha256)` -
`document_submissions(category_id, submitted_at)` -
`review_decisions(reviewer_id, created_at desc)` -
`notifications(user_id, created_at desc)` -
`audit_logs(resource_type, resource_id, created_at desc)` -
`verification_events(user_id, created_at desc)`

## 6. RLS and Privileged Access

Enable RLS on every application table exposed through the Supabase API.

-   Users can select their own documents and submissions only.
-   Users can select their own review decisions only.
-   Reviewers can select review queue records according to the MVP
    shared-queue policy.
-   Platform admins do not gain document-preview permission unless they
    also have reviewer role.
-   Verification credentials and audit logs are server-only.
-   Users cannot grant themselves roles.
-   Direct client inserts/updates to document state and review decisions
    are not allowed.
-   Server-side mutations must authenticate, authorize, validate, and
    audit.

Supabase service/secret keys bypass RLS. Keep them in server-only code
and never send them to a browser.

## 7. Migration

The initial migration is supplied at:

`supabase/migrations/202611010001_initial_schema.sql`

Review and run it in a development Supabase project first. The SQL is a
starting migration and must pass local migration, RLS, and integration
tests before production.

## 8. Deferred Schema Extensions

Not included in the initial schema: - reviewer assignment table; -
external identity verification; - public verification; -
payments/subscriptions; - OCR/AI fraud detection; - retention
automation; - full system settings management; - user deletion workflow.

Add these only after product scope and policy are approved.

## 9. Transactional Workflow Functions

The second migration adds: - `create_document_submission`: creates the
first document and submission version using the authenticated user ID. -
`create_document_resubmission`: creates a new immutable version only
after a revision request. - `apply_review_decision`: atomically records
a reviewer decision, changes state, creates the verification credential
after approval, and writes audit/notification events.

The submitter display name is snapshotted into the submission for
reviewer queue display. Do not expose the submitter's phone or email to
reviewers unless a separate approved requirement is added.


The workflow RPCs are granted to `service_role` only. They are not browser-callable. The Next.js server must derive the owner/reviewer identity from the verified session before calling them with the privileged server client.
