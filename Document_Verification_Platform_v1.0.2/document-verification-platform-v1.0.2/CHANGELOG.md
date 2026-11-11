# CHANGELOG.md

## v1.0 --- Technical preparation package

-   Consolidated the v0.9 product and design baseline.
-   Added technical architecture and technology recommendations.
-   Added relational database model and initial Supabase migration.
-   Added API contract for user, reviewer, and verification workflows.
-   Added security architecture and privacy controls.
-   Added business logic and state machine.
-   Added decision register separating confirmed decisions from proposed
    defaults.
-   Added testing strategy, deployment runbook, implementation roadmap,
    and Codex master prompt.
-   Added source-of-truth addenda to earlier project documents to
    reconcile stale TBD statements.

## v0.9 --- Design package

-   User and Admin Workspace visual references.
-   UI screen specification.
-   Mobile layout specification.
-   Codex handoff.

## v1.0.2 --- Workflow security refinement

-   Made workflow RPCs service-role-only.
-   Required Next.js server session/role checks before privileged RPC
    invocation.
-   Added submitter display-name snapshot for reviewer queue.
-   Made QR payload use an opaque credential UUID instead of placing the
    verification code in the URL.
-   Added immutable review-decision and audit-log triggers.
