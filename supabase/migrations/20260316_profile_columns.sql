-- ============================================================
-- LexDraft: Add missing advocate profile columns
-- Run once in the Supabase SQL editor.
-- ============================================================

alter table public.profiles
  add column if not exists bar_council_no   text,
  add column if not exists state_bar        text,
  add column if not exists firm_name        text,
  add column if not exists office_address   text,
  add column if not exists default_state    text,
  add column if not exists default_dispute  text default 'arbitration',
  add column if not exists letterhead_url   text,
  add column if not exists documents_this_month integer not null default 0,
  add column if not exists plan             text not null default 'free',
  add column if not exists role             text not null default 'lawyer',
  add column if not exists created_by_lawyer_id uuid references public.profiles(id) on delete set null,
  add column if not exists email_notifications  boolean not null default true;
