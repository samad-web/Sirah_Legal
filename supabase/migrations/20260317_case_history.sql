-- Feature 10: Case Status History
create table if not exists case_status_history (
  id uuid default gen_random_uuid() primary key,
  case_id uuid references cases(id) on delete cascade,
  old_status text,
  new_status text not null,
  changed_by uuid references profiles(id),
  note text,
  created_at timestamptz default now()
);
alter table case_status_history enable row level security;
drop policy if exists "Lawyers view own case history" on case_status_history;
create policy "Lawyers view own case history" on case_status_history
  for all using (
    case_id in (select id from cases where lawyer_id = auth.uid())
  );
