# UI_SCREEN_SPEC.md

## Document Verification Platform --- Complete Workspace UI Specification

**Version:** 0.1\
**Design direction:** Enterprise Trust × Premium Technology\
**Visual theme:** Silver / White surfaces, Graphite navigation, Blue
primary actions\
**Theme support:** Light Mode + Dark Mode\
**Target:** Desktop-first, responsive to tablet and mobile

------------------------------------------------------------------------

## 1. Purpose and Authority

This document consolidates the approved visual direction and the
screen-level requirements for the User Workspace and Admin Workspace.

Use these documents together: - `DESIGN_REFERENCE.md` --- visual
inspiration and design intent. - `DESIGN_SYSTEM.md` --- typography,
colors, spacing, component rules, responsive guidance. -
`DESIGN_TOKENS.css` --- semantic CSS variables. - `UPLOAD_FORM_SPEC.md`
--- authoritative metadata and upload form rules. -
`DOCUMENT_REVIEW_POLICY.md` --- authoritative administrative review
policy. - `PRODUCT_REQUIREMENTS.md` --- product behavior and access
rules.

**Precedence rule:** If an illustrative mockup image conflicts with an
approved product rule in `UPLOAD_FORM_SPEC.md`,
`DOCUMENT_REVIEW_POLICY.md`, or `PRODUCT_REQUIREMENTS.md`, the written
product rule takes precedence.

Mockup screenshots are visual references, not production data and not
exact implementation specifications.

## 2. Shared Application Shell

### 2.1 Desktop shell

-   Graphite sidebar on the left.
-   Light silver/white main workspace.
-   Top header with search where useful, notifications, theme control,
    and account menu.
-   Main page title and concise explanatory subtitle.
-   Primary action is visually prominent and uses the primary blue
    token.
-   Use the same shell geometry across User and Admin Workspaces, but
    use separate navigation items and permission-aware menus.

### 2.2 User navigation

-   Overview
-   My Documents
-   Submit Document
-   Verify Document
-   Profile & Settings

Activity can be displayed in the dashboard and document detail. A
dedicated Activity page is optional until product scope is confirmed.

### 2.3 Admin navigation

-   Admin Overview
-   Review Queue
-   Review History
-   User Management (design reference; activation requires approved
    permissions and policy)
-   System Settings (design reference; activation requires approved
    settings scope)

### 2.4 Responsive shell

Desktop: - Expanded sidebar target width: 248 px. - Collapsed sidebar
target width: 72 px. - Header target height: 64 px. - Content padding
target: 32 px.

Tablet: - Sidebar collapses or becomes a drawer. - Content padding
target: 24 px.

Mobile: - Sidebar becomes a drawer or compact bottom navigation after
usability testing. - Content padding target: 16 px. - Avoid forcing wide
tables into unreadable columns; use a mobile list/card presentation or
horizontal scroll with clear affordance.

## 3. User Workspace Screens

### U-01 --- Dashboard Overview

**Purpose:** Give each user a concise view of their own submissions,
approved documents, and recent activity.

**Main layout:** 1. Page heading and short welcome/context. 2. Summary
metrics: total submissions/documents, pending review, approved, revision
requested, rejected. 3. Recent submissions table/list. 4. Quick actions:
Submit Document and Verify Document. 5. Recent activity timeline.

**Rules:** - All counts and rows are scoped to the authenticated user's
owner ID. - Empty state explains how to submit the first document. - Do
not show global platform statistics. - Do not present illustrative chart
values as real data. - Primary CTA: `Submit Document`. - Secondary CTA:
`Verify Document`.

**Responsive:** - Metrics wrap into a compact grid. - Recent submissions
become stacked rows/cards on narrow screens. - Quick actions remain easy
to reach.

### U-02 --- My Documents

**Purpose:** Let users browse their own submitted/registered documents
and track their status.

**Main layout:** 1. Page title and `Submit New Document` CTA. 2. Status
summary/filter row. 3. Search by document title or verification code. 4.
Filters: category, status, date range. 5. Document table.

**Table columns:** - Document title and document ID. - Category. -
Submission/registration date. - Status. - Actions.

**Row actions:** - View details. - Context actions only when permitted
by document status.

**Rules:** - Only documents owned by the current user are returned. - QR
and verification code are available only for approved documents. - Do
not expose verification credentials for pending, revision-requested,
rejected, or revoked documents. - The category list is extensible and
includes `Lainnya`. - Search/filter results must remain owner-scoped on
the backend.

**Responsive:** - Convert table rows into compact document cards or
provide horizontal scrolling. - Keep title, status, and View action
visible.

### U-03 --- Submit Document

**Purpose:** Submit a PDF document and its metadata for administrative
review.

**Authoritative fields:**

  Field                            Requirement
  -------------------------------- ---------------------------------------------------
  Nama dokumen                     Required
  Kategori dokumen                 Required
  Jenis dokumen                    Required only when category `Lainnya` is selected
  File PDF                         Required
  Tanggal dokumen                  Optional
  Instansi penerbit                Optional
  Deskripsi                        Optional
  Persetujuan kebijakan platform   Required; unchecked by default

**Layout:** 1. Page heading and concise explanation. 2. PDF upload area
with choose-file alternative. 3. Selected-file row with filename, size,
validation state, replace/remove action. 4. Document metadata form. 5.
Administrative review explanation (completeness, readability, category
fit, registration eligibility). 6. Required consent checkbox and links
to policies. 7. Cancel and primary `Ajukan Dokumen` action. 8. Optional
side panel explaining submission steps and privacy.

**Important corrections:** - Do not add a Document Number field to the
MVP form. - Do not make document date mandatory. - Do not make issuing
institution mandatory. - Do not hardcode a 10 MB file limit; the maximum
file size remains a technical decision and must be configurable. -
Consent must not ask users to guarantee authenticity or legal validity.
Use wording that confirms the user has the right to submit the file and
has read/accepted the platform terms and privacy policy. - Save consent
timestamp and policy version. - PDF validation must happen server-side,
including MIME/signature and structural checks. - QR Code and
verification code are not issued at submission time.

**Success state:** - Show submission reference/ID. - Show
`Pending Review`. - Explain that an administrator will review the
document. - Do not show an active QR Code or verification code before
approval.

### U-04 --- Document Detail

**Purpose:** Show one document's metadata, review status, verification
identity, and activity.

**Main layout:** 1. Breadcrumb/back link. 2. Document title, document
ID, category, and status. 3. PDF preview/download action subject to
owner permission and file policy. 4. Metadata section. 5. Verification
panel. 6. Activity/review history.

**Verification panel:** - Unique verification code. - QR Code. - SHA-256
value where appropriate. - Copy code/copy hash actions. - Download QR
action if approved.

**Rules:** - Only the owner can access this page. - Only approved
documents have active verification code and QR. - Revoked documents must
show revoked status and must not appear as currently valid. - Do not
imply that an approved administrative review proves legal authenticity.

**States:** - Pending Review: show submission status and no active
QR/code. - Revision Requested: show reviewer note and resubmission
action. - Approved: show QR/code and verification details. - Rejected:
show decision and reason according to policy. - Revoked: show revoked
state and relevant audit information permitted to the owner.

### U-05 --- Verify Document

**Purpose:** Allow a logged-in user to verify documents belonging to
that same user's account.

**Three methods:**

1.  **QR Code**
    -   Scan with camera where browser/device permissions allow, or
        upload QR image.
    -   Resolve the document reference on the backend.
    -   Enforce authentication and owner check.
2.  **Verification Code**
    -   Enter a unique code.
    -   Search only the authenticated user's documents.
    -   Do not reveal whether a code belongs to another user.
3.  **Upload PDF / SHA-256**
    -   Upload a PDF for integrity comparison.
    -   Calculate SHA-256 on the server.
    -   Automatically search all approved documents owned by the current
        user.
    -   Return zero, one, or multiple matching documents.
    -   The uploaded comparison file is not automatically registered as
        a new submission.

**Result states:** - Match found: show matched document metadata and
approved/revoked state. - Multiple matches: show every matching record
belonging to the current user. - No match: explain that no identical
file was found in the user's approved documents. - Invalid file: show a
clear technical validation error. - Revoked: clearly state that the
record is revoked and not currently valid.

**Critical explanation:** A matching SHA-256 hash indicates
byte-for-byte file identity with the stored file. It does not
independently prove that the document is authentic, legally valid, or
issued by the named institution.

### U-06 --- Profile & Settings

**Purpose:** Let users manage their account details and preferences.

**Sections:** - Profile information. - Account security. - Notification
preferences. - Theme preference: Light, Dark, System. - Session/device
information if supported.

**Rules:** - Email changes and password changes require secure
confirmation flows. - Do not expose secrets or password values. - Save
actions require clear success/error feedback. - Theme preference
persists across User and Admin Workspace where the account has both
permissions.

## 4. Admin Workspace Screens

### A-01 --- Admin Overview

**Purpose:** Give administrators/reviewers an operational summary and a
direct route to pending work.

**Main layout:** 1. Page heading and date filter. 2. Metrics: Total
Documents, Approved, Pending Review, Revision Requested, Rejected,
Revoked. 3. Submission trend chart (only if reliable time-series data
exists). 4. Document category distribution (only if category data
exists). 5. Quick action: Review New Documents. 6. Recent Submissions
requiring review. 7. Recent Activities.

**Rules:** - All counts and charts must be generated from actual
authorized backend data. - Never hardcode demo numbers in production. -
Do not expose document contents or unnecessary personal information in
overview. - Review Queue is the primary operational action. - Hide
analytics widgets when data is unavailable rather than inventing values.

### A-02 --- Review Queue

**Purpose:** Let authorized reviewers find and open submissions
requiring administrative review.

**Main layout:** 1. Page title and concise description. 2. Tabs/filters
for Pending Review, Revision Requested/resubmitted items, and All
Submissions if permission allows. 3. Search by document title,
submission ID, or submitter. 4. Filters: category, submitter, submission
date, status. 5. Queue table. 6. Pagination and page-size control.

**Suggested columns:** - Submission ID/document title. - Submitter. -
Category. - Submission date/time. - Waiting time. - Status. - Action:
Review.

**Queue ordering:** - Default to oldest pending submission first (FIFO)
unless a priority policy is formally approved. - Do not invent
High/Medium/Low priority labels without a defined rule. - Show actual
waiting time from timestamps. - A revision resubmission must be
identifiable without creating an undocumented status.

**Permission:** - Reviewer sees only submissions within their authorized
scope/assignment. - Backend enforces scope and ownership-independent
reviewer permission.

### A-03 --- Review Detail

**Purpose:** Help the reviewer inspect the PDF, check the metadata,
complete the four administrative criteria, and make a traceable
decision.

**Desktop layout:** - Left area: private PDF viewer (approximately
65--70% of work area). - Right area: submission metadata and review
checklist (approximately 30--35%). - Decision actions at the bottom or
in a clear sticky action area.

**Metadata:** - Submission ID. - Document title. - Submitter. - Category
and custom document type if `Lainnya`. - Submission date. - Filename and
file size. - Current status.

**Four required checklist criteria:** 1. Kelengkapan. 2. Keterbacaan. 3.
Kesesuaian kategori. 4. Kelayakan pendaftaran.

**Decision actions:** - Approve. - Request Revision. - Reject.

**Rules:** - Approve is disabled until all mandatory checklist criteria
pass. - Request Revision requires a clear actionable note. - Reject
requires a reason aligned with the published platform policy. - Reviewer
cannot create new rejection grounds outside the policy. - Every decision
stores reviewer ID, timestamp, checklist results, and note/reason. - If
PDF preview fails, reviewer cannot approve until the issue is
resolved. - PDF access must use an authorized private endpoint.

**Mobile layout:** - Stack metadata, PDF preview, checklist, notes, and
decisions vertically. - Decision actions remain accessible without
covering content.

### A-04 --- Review History

**Purpose:** Provide a traceable record of review decisions.

**Main layout:** 1. Page title and short description. 2. Search by
document title, submission ID, or submitter. 3. Filters:
decision/status, category, reviewer, date range. 4. Table with document,
submitter, reviewer, decision, reviewed date/time, and View action. 5.
Pagination and export only if approved and authorized.

**Rules:** - History records are immutable from the ordinary UI. -
Corrections must create a new auditable event rather than silently
rewriting the old decision. - Reviewer access is scoped by permission. -
Sensitive metadata should be minimized.

### A-05 --- User Management

**Purpose:** Provide an administrative interface for user account
administration.

**Visual design reference only until permissions and account-management
policy are approved.**

**Suggested layout:** - User count summary. - Search by name/email/user
ID. - Filters by role and account status. - User table with name, email,
role, status, registration date, last login. - Add/edit/deactivate
actions only when explicitly authorized.

**Rules to settle before activation:** - Who can create users? - Who can
assign reviewer/admin roles? - Whether accounts can be suspended,
deactivated, or deleted. - Whether role changes require approval or
step-up authentication. - What audit trail is required.

Do not implement privileged actions solely because they appear in the
mockup.

### A-06 --- System Settings

**Purpose:** Provide a structured interface for approved platform
configuration.

**Visual design reference only until configuration ownership and policy
are approved.**

Potential sections: - General platform information. - Verification
rules. - Document categories. - User access/roles. - Notifications. -
Audit log. - File storage/security configuration.

**Rules:** - Do not expose storage secrets, API keys, signing keys, or
credentials in the browser. - Sensitive settings require server-side
authorization and audit logging. - Category management must preserve the
principle that categories classify documents; they are not a closed
allowlist. - Changes to verification rules require explicit confirmation
and audit history.

## 5. Shared UI States

Every data-driven screen must define: - Initial/loading state. -
Skeleton/loading state where appropriate. - Empty state. - Error
state. - Permission-denied state. - Success feedback. - Partial-data
state where relevant.

Forms additionally require: - Field validation errors. - Disabled
state. - Submitting state. - Success state. - Recoverable failure state.

## 6. Shared Components

-   AppSidebar.
-   AppHeader.
-   Breadcrumbs.
-   PageHeader.
-   Primary/Secondary/Ghost/Destructive Button.
-   SearchInput.
-   SelectFilter.
-   DateRangeFilter.
-   StatusBadge.
-   SummaryMetric.
-   DataTable.
-   MobileDataList.
-   Pagination.
-   FileDropzone.
-   UploadedFileRow.
-   DocumentMetadataPanel.
-   PDFViewer.
-   ReviewChecklist.
-   DecisionDialog.
-   VerificationResultPanel.
-   ActivityTimeline.
-   ThemeSwitcher.
-   EmptyState.
-   ErrorState.
-   Toast/InlineFeedback.

Use `DESIGN_SYSTEM.md` and `DESIGN_TOKENS.css` as the single source of
truth for visual tokens.

## 7. Visual Quality and Anti-Template Rules

-   Do not put every content block into a card.
-   Do not use generic charts unless they communicate real operational
    data.
-   Avoid decorative gradients, neon glow, and glassmorphism.
-   Use silver/white surfaces and graphite navigation consistently.
-   Use blue for primary actions, not every icon or label.
-   Use semantic status colors with text labels.
-   Preserve whitespace and alignment.
-   Give each screen a layout that reflects its actual task.
-   Do not make the admin workspace a copy of the user dashboard with
    different labels.
-   Avoid invented data in production; use clearly marked seed/demo data
    in development.

## 8. Acceptance Criteria for Visual Completion

-   [ ] All six User Workspace screens are represented in design
    references/specification.
-   [ ] All six Admin Workspace screens are represented in design
    references/specification.
-   [ ] Upload metadata follows the approved eight-field structure.
-   [ ] No fixed upload-size limit is hardcoded before technical
    approval.
-   [ ] All statuses use consistent labels and semantic colors.
-   [ ] User data is owner-scoped.
-   [ ] Admin actions are permission-controlled.
-   [ ] QR/code is available only after approval.
-   [ ] Hash comparison searches all approved documents belonging to the
    current user.
-   [ ] Light and Dark themes follow semantic tokens.
-   [ ] Desktop, tablet, and mobile behavior is defined.
-   [ ] Loading, empty, error, success, and permission states are
    specified.
-   [ ] Visual mockups are treated as references, not as a substitute
    for backend validation.
