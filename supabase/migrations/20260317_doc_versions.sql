-- Feature 9: Document Versioning
create table if not exists document_versions (
  id uuid default gen_random_uuid() primary key,
  document_id uuid references documents(id) on delete cascade,
  content text not null,
  version_number int not null,
  created_by uuid references profiles(id),
  created_at timestamptz default now()
);
alter table document_versions enable row level security;
drop policy if exists "Users manage own document versions" on document_versions;
create policy "Users manage own document versions" on document_versions
  for all using (
    document_id in (select id from documents where user_id = auth.uid())
  );
