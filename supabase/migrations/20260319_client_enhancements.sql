-- ─── Client Portal Enhancements Migration ────────────────────────────────────
-- Features: Notifications, Client Notes, Client Feedback, Urgent Requests

-- 1. client_notifications table
create table if not exists client_notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references profiles(id) on delete cascade,
  type        text not null check (type in ('message','document','request','reminder','case-update')),
  title       text not null,
  body        text,
  ref_id      text,
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);

create index if not exists idx_client_notifications_user on client_notifications(user_id, created_at desc);

alter table client_notifications enable row level security;

create policy "client_notifications_select" on client_notifications
  for select using (auth.uid() = user_id);

create policy "client_notifications_update" on client_notifications
  for update using (auth.uid() = user_id);

-- 2. client_notes table (client's own private notes per case)
create table if not exists client_notes (
  id                uuid primary key default gen_random_uuid(),
  client_id         uuid not null references profiles(id) on delete cascade,
  case_id           uuid not null references cases(id) on delete cascade,
  content           text not null,
  share_with_lawyer boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists idx_client_notes_client_case on client_notes(client_id, case_id);

alter table client_notes enable row level security;

create policy "client_notes_all" on client_notes
  for all using (auth.uid() = client_id);

-- 3. client_feedback table
create table if not exists client_feedback (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references profiles(id) on delete cascade,
  case_id     uuid references cases(id) on delete set null,
  rating      smallint not null check (rating between 1 and 5),
  comment     text,
  created_at  timestamptz not null default now()
);

alter table client_feedback enable row level security;

create policy "client_feedback_insert" on client_feedback
  for insert with check (auth.uid() = client_id);

create policy "client_feedback_select" on client_feedback
  for select using (auth.uid() = client_id);

-- 4. Add is_urgent + urgency_reason to document_requests
alter table document_requests
  add column if not exists is_urgent    boolean not null default false,
  add column if not exists urgency_note text;

-- 5. Add acknowledged_at to audit_logs for document acknowledgment tracking
-- We'll use a separate lightweight table for acknowledgments
create table if not exists document_acknowledgments (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references profiles(id) on delete cascade,
  document_id     uuid not null references documents(id) on delete cascade,
  acknowledged_at timestamptz not null default now(),
  unique (user_id, document_id)
);

alter table document_acknowledgments enable row level security;

create policy "doc_ack_all" on document_acknowledgments
  for all using (auth.uid() = user_id);
