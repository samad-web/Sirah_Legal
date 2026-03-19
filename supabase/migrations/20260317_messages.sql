-- Feature 4: Secure Messaging
create table if not exists case_messages (
  id uuid default gen_random_uuid() primary key,
  case_id uuid references cases(id) on delete cascade,
  sender_id uuid references profiles(id),
  content text not null,
  read_at timestamptz,
  created_at timestamptz default now()
);
alter table case_messages enable row level security;
drop policy if exists "Case participants can read messages" on case_messages;
create policy "Case participants can read messages" on case_messages
  for select using (
    case_id in (select id from cases where lawyer_id = auth.uid())
    or case_id in (select case_id from case_assignments where client_id = auth.uid())
  );
drop policy if exists "Case participants can send messages" on case_messages;
create policy "Case participants can send messages" on case_messages
  for insert with check (
    sender_id = auth.uid() and (
      case_id in (select id from cases where lawyer_id = auth.uid())
      or case_id in (select case_id from case_assignments where client_id = auth.uid())
    )
  );
