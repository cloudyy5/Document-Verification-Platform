# CODEX_MASTER_PROMPT.md

## Main Instruction for Codex --- Document Verification Platform

You are implementing a real document verification web application. Do
not treat this as a generic dashboard template task.

## 1. Mandatory First Step

Before coding: 1. Inspect the repository structure. 2. Read `README.md`.
3. Read `PROJECT_BRIEF.md`. 4. Read `PRODUCT_REQUIREMENTS.md`. 5. Read
`DOCUMENT_REVIEW_POLICY.md`. 6. Read `UPLOAD_FORM_SPEC.md`. 7. Read
`TECHNICAL_ARCHITECTURE.md`. 8. Read `DATABASE_SCHEMA.md`. 9. Read
`API_SPECIFICATION.md`. 10. Read `SECURITY_ARCHITECTURE.md`. 11. Read
`BUSINESS_LOGIC_AND_STATE_MACHINE.md`. 12. Read `UI_SCREEN_SPEC.md`. 13.
Read `MOBILE_LAYOUT_SPEC.md`. 14. Read `DESIGN_SYSTEM.md`. 15. Read
`DESIGN_TOKENS.css`. 16. Read `DECISION_REGISTER.md`. 17. Read
`IMPLEMENTATION_ROADMAP.md`.

If a file is missing, report it. Do not invent its content.

## 2. Product Rules That Must Never Be Violated

-   Every user must have an account to submit or verify documents.
-   Every user can submit documents that comply with platform policy.
-   The MVP accepts PDF files.
-   Category is classification, not a closed acceptance whitelist.
-   Required submission metadata is exactly the approved set:
    -   document title;
    -   category;
    -   custom document type only if `Lainnya`;
    -   PDF file;
    -   optional document date;
    -   optional issuing institution;
    -   optional description;
    -   required policy consent.
-   Do not add document number or make optional fields mandatory.
-   Every submission goes through technical validation and administrator
    review.
-   Reviewer checks exactly four aspects: completeness, readability,
    category suitability, and registration eligibility.
-   QR and verification code are issued only after approval.
-   User can access and verify only documents owned by their own
    account.
-   Hash comparison searches all current approved documents owned by the
    active user, including previously approved records that are now
    revoked (show revoked status).
-   A hash match proves byte identity only, not issuer authenticity or
    legal validity.
-   A comparison PDF is temporary and is not automatically registered.
-   Private PDFs must never be placed in a public storage bucket.
-   All authorization checks happen on the server and are reinforced by
    RLS.
-   Review decisions and audit events must be preserved.

## 3. Design Rules

-   Follow `DESIGN_SYSTEM.md` and `DESIGN_TOKENS.css`.
-   Silver/white workspace.
-   Graphite sidebar.
-   Blue primary CTA with clear contrast.
-   Support Light, Dark, and System themes.
-   Geist Sans for UI and Geist Mono for technical identifiers.
-   Use the supplied mockups as visual references, not as exact data or
    product logic.
-   Do not produce a generic AI dashboard.
-   Do not overuse cards, gradients, glassmorphism, decorative charts,
    or meaningless statistics.
-   Create page-specific layouts based on the task.
-   Use responsive behavior from `MOBILE_LAYOUT_SPEC.md`; do not merely
    shrink desktop.

## 4. Security Rules

-   Never trust owner ID, reviewer ID, role, hash, file MIME, or file
    extension from the browser.
-   Derive user ID from the authenticated server session.
-   Check role and resource ownership on every private endpoint.
-   Keep Supabase secret/service keys server-only.
-   Use private storage.
-   Validate PDFs on the server.
-   Compute SHA-256 on the server.
-   Apply rate limits.
-   Do not log raw codes, tokens, file contents, or secrets.
-   Do not use a public QR verification endpoint.
-   Use transactions for review decisions.
-   Prevent concurrent reviewers from overwriting decisions.
-   Never allow a user to update their own role.

## 5. Technical Defaults

Use the stack in `TECHNICAL_ARCHITECTURE.md` unless a dependency is
unavailable or a current official source recommends a material change.
If changing the stack, explain why and update the architecture docs
before implementing.

## 6. Unapproved Decisions

Read `DECISION_REGISTER.md`.

Recommended defaults are not automatically owner-approved. Keep
uncertain features configurable or disabled. Do not activate: - User
Management privileged actions; - System Settings mutation; - revocation
UI/API; - public verification; - reviewer assignment; - email
notification integrations; until the owner approves the corresponding
policy.

Use a configurable maximum upload size; the proposed initial value is 20
MiB but must be approved. Do not hardcode it in UI.

## 7. Development Workflow

-   Follow `IMPLEMENTATION_ROADMAP.md`.
-   Work in small phases.
-   At the start of a phase, state the scope and files likely to change.
-   Implement backend and tests before claiming a feature works.
-   Do not replace real API integration with mock arrays after the
    backend exists.
-   Seed data must be clearly marked development-only.
-   Run lint, typecheck, unit tests, integration tests, and build after
    meaningful changes.
-   If tests fail, fix them or clearly report the failure.
-   Update documentation and migration files together.
-   Do not deploy without explicit approval.

## 8. First Task When Starting Codex

Do not immediately build every page.

Start with **Phase 0 --- Repository and Technical Foundation**: 1.
Inspect the workspace. 2. Confirm Node.js/package manager versions
available. 3. Scaffold Next.js App Router with TypeScript. 4. Add
Tailwind and the approved design tokens. 5. Add Supabase client setup
with separate browser/server/admin modules. 6. Add environment variable
validation. 7. Add shared typography, colors, buttons, sidebar, header,
theme switcher, and responsive shell. 8. Add lint, typecheck, test, and
build scripts. 9. Run all checks. 10. Report what is complete and ask
before moving to Phase 1 if a product decision blocks it.

The goal is a maintainable product implementation, not a one-shot code
dump.
