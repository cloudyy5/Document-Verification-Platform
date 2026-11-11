-- Owner approval recorded in the Phase 1 conversation, 1 November 2026:
-- R-05: shared pending queue for all reviewer-role accounts.
-- R-13: activate the nine proposed classification categories.
-- This does not grant reviewer permissions to platform_admin or enable UI/API.
begin;

update private.access_control_settings
set shared_review_queue_enabled = true
where singleton = true;

update public.document_categories
set is_active = true
where slug in (
  'pendidikan', 'pekerjaan', 'organisasi', 'administrasi', 'keuangan',
  'kesehatan', 'hukum', 'pribadi', 'lainnya'
);

-- Newly created categories retain the fail-closed inactive default from 003.
commit;
