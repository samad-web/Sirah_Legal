-- Feature 14: Client Intake Forms
create table if not exists intake_forms (
  id uuid default gen_random_uuid() primary key,
  lawyer_id uuid references profiles(id),
  case_id uuid references cases(id),
  title text not null,
  fields jsonb not null default '[]',
  created_at timestamptz default now()
);
create table if not exists intake_submissions (
  id uuid default gen_random_uuid() primary key,
  form_id uuid references intake_forms(id) on delete cascade,
  respondent_email text,
  data jsonb not null,
  submitted_at timestamptz default now()
);
alter table intake_forms enable row level security;
drop policy if exists "Lawyers manage intake forms" on intake_forms;
create policy "Lawyers manage intake forms" on intake_forms
  for all using (lawyer_id = auth.uid());
-- intake_submissions: allow anon insert via service role in API; no RLS needed for server-side
alter table intake_submissions enable row level security;
drop policy if exists "Lawyers view submissions" on intake_submissions;
create policy "Lawyers view submissions" on intake_submissions
  for select using (
    form_id in (select id from intake_forms where lawyer_id = auth.uid())
  );
