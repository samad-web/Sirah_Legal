-- Feature 5: Document Requests
create table if not exists document_requests (
  id uuid default gen_random_uuid() primary key,
  case_id uuid references cases(id) on delete cascade,
  lawyer_id uuid references profiles(id),
  client_id uuid references profiles(id),
  title text not null,
  description text,
  status text default 'pending' check (status in ('pending','fulfilled','cancelled')),
  created_at timestamptz default now(),
  fulfilled_at timestamptz
);
alter table document_requests enable row level security;
drop policy if exists "Lawyers manage requests" on document_requests;
create policy "Lawyers manage requests" on document_requests
  for all using (lawyer_id = auth.uid());
drop policy if exists "Clients view their requests" on document_requests;
create policy "Clients view their requests" on document_requests
  for select using (client_id = auth.uid());
drop policy if exists "Clients fulfil requests" on document_requests;
create policy "Clients fulfil requests" on document_requests
  for update using (client_id = auth.uid())
  with check (status = 'fulfilled');
