-- ─── pg_cron: reset monthly document quota on the 1st of each month ──────────
-- Prerequisites: enable pg_cron in Supabase dashboard
--   Dashboard → Database → Extensions → search "pg_cron" → Enable
--
-- This job runs at 00:00 UTC on the 1st of every month and resets
-- documents_this_month to 0 for all profiles.

select cron.schedule(
  'reset-monthly-quota',      -- unique job name (idempotent re-run)
  '0 0 1 * *',                -- cron expression: midnight UTC, 1st of month
  $$
    update public.profiles
    set documents_this_month = 0
    where documents_this_month > 0;
  $$
);


-- ─── Full-text search: generated tsvector column + GIN index ─────────────────
-- Combines title and content into a searchable vector.
-- The STORED keyword means Postgres maintains the column automatically
-- on every INSERT/UPDATE — no application-side maintenance needed.

alter table public.documents
  add column if not exists search_vector tsvector
  generated always as (
    to_tsvector(
      'english',
      coalesce(title, '') || ' ' || coalesce(content, '')
    )
  ) stored;

create index if not exists documents_search_vector_gin
  on public.documents using gin(search_vector);
