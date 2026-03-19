-- Feature 6: Clause Library
create table if not exists clause_library (
  id uuid default gen_random_uuid() primary key,
  lawyer_id uuid references profiles(id),
  title text not null,
  content text not null,
  category text,
  tags text[],
  created_at timestamptz default now()
);
alter table clause_library enable row level security;
drop policy if exists "Lawyers manage own clauses" on clause_library;
create policy "Lawyers manage own clauses" on clause_library
  for all using (lawyer_id = auth.uid());
