# DOCUMENT_CONTROL.md

## Document Verification Platform --- Specification Governance

**Version:** 1.0

------------------------------------------------------------------------

## 1. Current Package

The v1.0 package contains: - prior product brief, requirements, user
flow, personas, sitemap; - design reference and design system; - UI
screen and mobile specifications; - technical architecture; - database
schema and initial migration; - API contract; - security architecture; -
business logic/state machine; - decision register; - testing strategy; -
deployment runbook; - implementation roadmap; - Codex master prompt.

## 2. Source-of-Truth Order

If documents conflict, use this precedence:

1.  Confirmed owner decisions in `DECISION_REGISTER.md`.
2.  `PROJECT_BRIEF.md` and `PRODUCT_REQUIREMENTS.md`, including their
    latest addenda.
3.  `DOCUMENT_REVIEW_POLICY.md` and `UPLOAD_FORM_SPEC.md`.
4.  `TECHNICAL_ARCHITECTURE.md`, `DATABASE_SCHEMA.md`, and
    `API_SPECIFICATION.md`.
5.  `SECURITY_ARCHITECTURE.md`.
6.  `UI_SCREEN_SPEC.md`, `MOBILE_LAYOUT_SPEC.md`, and design system.
7.  Illustrative mockup images.

A screenshot never overrides a written security or product rule.

## 3. Versioning

-   Update version and changelog when a decision changes.
-   Never silently replace a confirmed product rule.
-   Update API, database, tests, and UI specs together when a state or
    field changes.
-   Keep SQL migrations immutable after they have been applied to a
    shared environment; add a new migration for changes.

## 4. Current Readiness

-   Visual direction: established.
-   Core page coverage: specified.
-   Product core rules: established.
-   Technical architecture: recommended.
-   Database model: drafted with initial migration.
-   API contract: drafted.
-   Security controls: specified.
-   Test and deployment plans: drafted.
-   Owner approval of recommended defaults: pending.
-   Production privacy/retention policy: pending.

The package is a Codex implementation brief, not a production
certification.
