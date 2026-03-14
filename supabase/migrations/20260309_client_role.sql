-- ============================================================
-- LexDraft: Client Role Feature Migration
-- Run this once in the Supabase SQL editor.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. Add role column to profiles
-- ────────────────────────────────────────────────────────────
alter table public.profiles
  add column if not exists role text not null default 'lawyer'
    check (role in ('lawyer', 'client'));

-- Backfill: any existing rows without a role become 'lawyer'
update public.profiles set role = 'lawyer' where role is null;

-- ────────────────────────────────────────────────────────────
-- 2. Add created_by_lawyer_id to profiles (for client accounts)
-- ────────────────────────────────────────────────────────────
alter table public.profiles
  add column if not exists created_by_lawyer_id uuid references public.profiles(id);

-- ────────────────────────────────────────────────────────────
-- 3. Cases table
-- ────────────────────────────────────────────────────────────
create table if not exists public.cases (
  id          uuid primary key default gen_random_uuid(),
  lawyer_id   uuid not null references public.profiles(id) on delete cascade,
  title       text not null,
  description text,
  status      text not null default 'active' check (status in ('active', 'closed', 'archived')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ────────────────────────────────────────────────────────────
-- 4. Case assignments  (client ↔ case)
-- ────────────────────────────────────────────────────────────
create table if not exists public.case_assignments (
  case_id     uuid not null references public.cases(id) on delete cascade,
  client_id   uuid not null references public.profiles(id) on delete cascade,
  assigned_at timestamptz not null default now(),
  primary key (case_id, client_id)
);

-- ────────────────────────────────────────────────────────────
-- 5. Case documents  (document ↔ case)
-- ────────────────────────────────────────────────────────────
create table if not exists public.case_documents (
  case_id     uuid not null references public.cases(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  linked_at   timestamptz not null default now(),
  primary key (case_id, document_id)
);

-- ────────────────────────────────────────────────────────────
-- 6. Audit logs  (document access tracking)
-- ────────────────────────────────────────────────────────────
create table if not exists public.audit_logs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  document_id uuid references public.documents(id) on delete set null,
  action      text not null,           -- 'preview' | 'download' | 'view_list'
  metadata    jsonb,
  created_at  timestamptz not null default now()
);

-- ────────────────────────────────────────────────────────────
-- 7. Enable RLS on new tables
-- ────────────────────────────────────────────────────────────
alter table public.cases             enable row level security;
alter table public.case_assignments  enable row level security;
alter table public.case_documents    enable row level security;
alter table public.audit_logs        enable row level security;

-- ────────────────────────────────────────────────────────────
-- 8. RLS Policies — cases
-- ────────────────────────────────────────────────────────────

-- Lawyers can manage their own cases
create policy "Lawyers manage own cases"
  on public.cases for all
  using (auth.uid() = lawyer_id);

-- Clients can view cases they are assigned to
create policy "Clients view assigned cases"
  on public.cases for select
  using (
    exists (
      select 1 from public.case_assignments ca
      where ca.case_id = id
        and ca.client_id = auth.uid()
    )
  );

-- ────────────────────────────────────────────────────────────
-- 9. RLS Policies — case_assignments
-- ────────────────────────────────────────────────────────────

-- Lawyers can manage assignments for their cases
create policy "Lawyers manage case assignments"
  on public.case_assignments for all
  using (
    exists (
      select 1 from public.cases c
      where c.id = case_id
        and c.lawyer_id = auth.uid()
    )
  );

-- Clients can see their own assignments
create policy "Clients view own assignments"
  on public.case_assignments for select
  using (client_id = auth.uid());

-- ────────────────────────────────────────────────────────────
-- 10. RLS Policies — case_documents
-- ────────────────────────────────────────────────────────────

-- Lawyers can manage document links for their cases
create policy "Lawyers manage case documents"
  on public.case_documents for all
  using (
    exists (
      select 1 from public.cases c
      where c.id = case_id
        and c.lawyer_id = auth.uid()
    )
  );

-- Clients can view case_documents for their assigned cases
create policy "Clients view assigned case documents"
  on public.case_documents for select
  using (
    exists (
      select 1 from public.case_assignments ca
      where ca.case_id = case_id
        and ca.client_id = auth.uid()
    )
  );

-- ────────────────────────────────────────────────────────────
-- 11. RLS Policies — documents (extend existing)
-- ────────────────────────────────────────────────────────────

-- Clients can SELECT only documents linked to their cases
-- (The existing "Users can manage own documents" policy covers lawyer CRUD)
create policy "Clients view assigned documents"
  on public.documents for select
  using (
    auth.uid() = user_id   -- lawyer who created it (existing logic)
    or
    exists (               -- client with access through case assignment
      select 1
      from public.case_documents cd
      join public.case_assignments ca on ca.case_id = cd.case_id
      where cd.document_id = id
        and ca.client_id = auth.uid()
    )
  );

-- ────────────────────────────────────────────────────────────
-- 12. RLS Policies — audit_logs
-- ────────────────────────────────────────────────────────────

-- Any authenticated user can insert their own audit log
create policy "Users can insert own audit logs"
  on public.audit_logs for insert
  with check (auth.uid() = user_id);

-- Lawyers can view audit logs for documents they own
create policy "Lawyers view audit logs for own documents"
  on public.audit_logs for select
  using (
    auth.uid() = user_id
    or
    exists (
      select 1 from public.documents d
      where d.id = document_id
        and d.user_id = auth.uid()
    )
  );

-- ────────────────────────────────────────────────────────────
-- 13. Helper RPC: get client documents
--     Called from the frontend to fetch all documents a client
--     can access via their case assignments.
-- ────────────────────────────────────────────────────────────
create or replace function get_client_documents(p_client_id uuid)
returns setof public.documents
language sql security definer
as $$
  select d.*
  from public.documents d
  where exists (
    select 1
    from public.case_documents cd
    join public.case_assignments ca on ca.case_id = cd.case_id
    where cd.document_id = d.id
      and ca.client_id = p_client_id
  )
  order by d.created_at desc;
$$;

-- ────────────────────────────────────────────────────────────
-- 14. Helper RPC: get client cases
-- ────────────────────────────────────────────────────────────
create or replace function get_client_cases(p_client_id uuid)
returns setof public.cases
language sql security definer
as $$
  select c.*
  from public.cases c
  join public.case_assignments ca on ca.case_id = c.id
  where ca.client_id = p_client_id
  order by c.created_at desc;
$$;

-- ────────────────────────────────────────────────────────────
-- Done.
-- ────────────────────────────────────────────────────────────
