# DEPLOYMENT_RUNBOOK.md

## Document Verification Platform --- Development to Production

**Version:** 1.0

------------------------------------------------------------------------

## 1. Environments

Maintain separate environments:

1.  Local development.
2.  Staging.
3.  Production.

Do not use production documents or real personal data as development
fixtures.

## 2. Accounts and Services to Prepare

-   GitHub repository.
-   Vercel project.
-   Supabase development project.
-   Supabase staging project.
-   Supabase production project.
-   Domain name.
-   Email provider if email verification/notifications are enabled.
-   Malware scanning service before public launch.
-   Error monitoring/logging provider if selected.

## 3. Supabase Setup

1.  Create the project.
2.  Select a region appropriate to the intended user base and data
    requirements.
3.  Configure Auth site URL and allowed redirect URLs.
4.  Configure email verification and password recovery.
5.  Create private bucket `document-submissions`.
6.  Set PDF MIME restriction and configured file-size limit.
7.  Apply migrations using Supabase CLI.
8.  Seed initial document categories.
9.  Confirm RLS is enabled on every application table.
10. Run RLS policy tests.
11. Create the initial platform administrator through a trusted secure
    process; never expose a public admin-registration route.

## 4. Local Development

Recommended sequence:

``` bash
npm install
npx supabase init
npx supabase start
npx supabase db reset
cp .env.example .env.local
npm run dev
```

Use the local Supabase credentials printed by the CLI. Do not commit
`.env.local`.

## 5. Vercel Setup

1.  Connect the GitHub repository.
2.  Configure the production build command.
3.  Add environment variables to Development, Preview, and Production
    scopes separately.
4.  Add the custom domain.
5.  Configure Supabase Auth redirect URLs for the deployed domain.
6.  Ensure private API routes are not statically cached.
7.  Deploy staging first.
8.  Run the complete test suite against staging.
9.  Promote to production only after release gates pass.

## 6. Migration Discipline

-   All schema changes must be committed as SQL migrations.
-   Test migrations on local and staging first.
-   Back up production before a high-risk migration.
-   Never use ad hoc production SQL as the only record of a schema
    change.
-   Keep rollback/recovery notes for each production migration.

## 7. Storage and Secrets

-   Keep the document bucket private.
-   Use opaque storage object names.
-   Keep Supabase secret/service credentials server-only.
-   Rotate secrets if exposed.
-   Do not place secrets in `NEXT_PUBLIC_*` variables.
-   Do not log signed URLs, raw verification codes, or storage
    credentials.

## 8. Production Readiness Checklist

-   [ ] Domain and HTTPS configured.
-   [ ] Supabase Auth redirect URLs correct.
-   [ ] Email verification/password reset tested.
-   [ ] Admin MFA configured.
-   [ ] RLS tests pass.
-   [ ] Private bucket confirmed private.
-   [ ] Upload size and encrypted-PDF policies approved.
-   [ ] Malware scanning enabled.
-   [ ] Rate limiting configured.
-   [ ] Error monitoring configured.
-   [ ] Backups enabled and restoration tested.
-   [ ] Privacy policy and acceptable-use policy published.
-   [ ] Data retention/deletion policy approved.
-   [ ] Support contact published.
-   [ ] Production data is not present in development.
-   [ ] Final UAT approved.

## 9. Rollback

If a deployment causes a critical issue: 1. Disable affected feature
flags or route. 2. Roll back application deployment to last known good
release. 3. Do not reverse a destructive database migration without a
tested recovery plan. 4. Preserve audit logs and uploaded document
objects. 5. Investigate, patch, test in staging, and redeploy.
