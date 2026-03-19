-- Feature 3: Case Notes
create table if not exists case_notes (
  id uuid default gen_random_uuid() primary key,
  case_id uuid references cases(id) on delete cascade,
  lawyer_id uuid references profiles(id),
  content text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table case_notes enable row level security;
drop policy if exists "Lawyers manage own case notes" on case_notes;
create policy "Lawyers manage own case notes" on case_notes
  for all using (lawyer_id = auth.uid());
