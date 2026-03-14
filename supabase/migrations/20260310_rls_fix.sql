-- ============================================================
-- LexDraft: RLS Recursion Fix & Profile Visibility
-- ============================================================

-- 1. Helper Functions (Security Definer) to break recursion
-- These functions run with the privileges of the creator (postgres)
-- but allow us to check access without triggering nested RLS loops.

create or replace function public.is_case_lawyer(p_case_id uuid, p_user_id uuid)
returns boolean
language sql security definer
set search_path = public
as $$
  select exists (
    select 1 from public.cases
    where id = p_case_id and lawyer_id = p_user_id
  );
$$;

create or replace function public.is_case_client(p_case_id uuid, p_user_id uuid)
returns boolean
language sql security definer
set search_path = public
as $$
  select exists (
    select 1 from public.case_assignments
    where case_id = p_case_id and client_id = p_user_id
  );
$$;

-- 2. Drop existing problematic policies
drop policy if exists "Lawyers manage own cases" on public.cases;
drop policy if exists "Clients view assigned cases" on public.cases;
drop policy if exists "Lawyers manage case assignments" on public.case_assignments;
drop policy if exists "Clients view own assignments" on public.case_assignments;
drop policy if exists "Lawyers manage case documents" on public.case_documents;
drop policy if exists "Clients view assigned case documents" on public.case_documents;
drop policy if exists "Clients view assigned documents" on public.documents;

-- 3. Re-implement policies using helper functions

-- CASES
create policy "Lawyers manage own cases"
  on public.cases for all
  using (auth.uid() = lawyer_id);

create policy "Clients view assigned cases"
  on public.cases for select
  using (is_case_client(id, auth.uid()));

-- CASE_ASSIGNMENTS
create policy "Lawyers manage case assignments"
  on public.case_assignments for all
  using (is_case_lawyer(case_id, auth.uid()));

create policy "Clients view own assignments"
  on public.case_assignments for select
  using (client_id = auth.uid());

-- CASE_DOCUMENTS
create policy "Lawyers manage case documents"
  on public.case_documents for all
  using (is_case_lawyer(case_id, auth.uid()));

create policy "Clients view assigned case documents"
  on public.case_documents for select
  using (is_case_client(case_id, auth.uid()));

-- DOCUMENTS (Extended for clients)
create policy "Clients view assigned documents"
  on public.documents for select
  using (
    auth.uid() = user_id
    or
    exists (
      select 1
      from public.case_documents cd
      where cd.document_id = id
        and is_case_client(cd.case_id, auth.uid())
    )
  );

-- 4. Profile visibility for Lawyers
-- Allows lawyers to see profiles of clients they created or assigned.
create policy "Lawyers view their clients"
  on public.profiles for select
  using (
    auth.uid() = id -- own profile
    or 
    created_by_lawyer_id = auth.uid() -- clients they created
    or
    exists ( -- clients assigned to their cases
      select 1 from public.cases c
      join public.case_assignments ca on ca.case_id = c.id
      where c.lawyer_id = auth.uid() and ca.client_id = profiles.id
    )
  );
