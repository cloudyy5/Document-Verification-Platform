# Document Verification Platform --- Preparation Package v1.0

This package consolidates the current product, design, technical,
database, API, security, testing, deployment, and Codex implementation
specifications.

## Start here

1.  `DOCUMENT_CONTROL.md`
2.  `DECISION_REGISTER.md`
3.  `CODEX_MASTER_PROMPT.md`
4.  `IMPLEMENTATION_ROADMAP.md`

## Start Codex

-   `LOCAL_SETUP_CHECKLIST.md`
-   `CODEX_FIRST_PROMPT.md`

## Core technical documents

-   `TECHNICAL_ARCHITECTURE.md`
-   `DATABASE_SCHEMA.md`
-   `API_SPECIFICATION.md`
-   `SECURITY_ARCHITECTURE.md`
-   `BUSINESS_LOGIC_AND_STATE_MACHINE.md`
-   `TESTING_STRATEGY.md`
-   `DEPLOYMENT_RUNBOOK.md`
-   `ARCHITECTURE_DECISIONS.md`

## Existing product and design documents

The package also includes the v0.9 project brief, requirements, review
policy, upload form specification, design system, screen specifications,
mobile layout specification, and visual reference assets.

## Important status

This is an implementation-ready planning package, not a deployed
application and not a production security certification. Recommended
defaults in `DECISION_REGISTER.md` still require owner approval.
Privacy, retention, malware scanning, and production service
configuration must be finalized before public launch.

## Database migrations

-   `supabase/migrations/202611010001_initial_schema.sql`
-   `supabase/migrations/202611010002_workflow_rpcs.sql`

The second migration adds server-only transactional workflow functions.
Review and test both migrations locally before staging.
