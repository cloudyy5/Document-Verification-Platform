-- Classification list approved by the owner during Phase 1, 1 November 2026.
-- R-13 is recorded in migration 004 and docs/decision-notes.md.
-- No accounts, private documents, review decisions, or statistics are seeded.
-- Existing operator choices are preserved when seeding again.
begin;

insert into public.document_categories
  (name, slug, is_active, is_system, display_order)
values
  ('Pendidikan', 'pendidikan', true, true, 10),
  ('Pekerjaan', 'pekerjaan', true, true, 20),
  ('Organisasi', 'organisasi', true, true, 30),
  ('Administrasi', 'administrasi', true, true, 40),
  ('Keuangan', 'keuangan', true, true, 50),
  ('Kesehatan', 'kesehatan', true, true, 60),
  ('Hukum', 'hukum', true, true, 70),
  ('Pribadi', 'pribadi', true, true, 80),
  ('Lainnya', 'lainnya', true, true, 999)
on conflict (slug) do nothing;

commit;
