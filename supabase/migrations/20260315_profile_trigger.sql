-- ============================================================
-- LexDraft: Auto-create profile on user sign-up
-- Run once in the Supabase SQL editor.
--
-- Without this trigger, users who sign up have no row in
-- public.profiles, which causes FK violations on cases,
-- case_assignments, and client profile inserts.
-- ============================================================

-- Trigger function: runs after every new row in auth.users
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    id,
    full_name,
    role,
    default_language,
    plan,
    documents_this_month,
    email_notifications
  )
  values (
    new.id,
    new.raw_user_meta_data->>'full_name',
    coalesce(new.raw_user_meta_data->>'role', 'lawyer'),
    'en',
    'free',
    0,
    true
  )
  on conflict (id) do nothing;   -- safe to re-run; won't overwrite existing rows

  return new;
end;
$$;

-- Attach trigger to auth.users (drop first to make idempotent)
drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute procedure public.handle_new_user();
