-- ============================================================
-- LexDraft: Document Management Upgrade Migration
-- Adds letterhead customization and storage assets.
-- ============================================================

-- 1. Add customization columns to profiles
alter table public.profiles
  add column if not exists logo_url text,
  add column if not exists signature_url text,
  add column if not exists font_family text default 'Times New Roman',
  add column if not exists font_size integer default 12,
  add column if not exists font_color text default '#000000';

-- 2. Create storage bucket for user assets (logos, signatures)
-- Note: This requires the storage schema to exist (standard in Supabase)
insert into storage.buckets (id, name, public)
values ('user-assets', 'user-assets', true)
on conflict (id) do nothing;

-- 3. Storage RLS Policies
-- Allow users to upload their own assets
create policy "Users can upload own assets"
  on storage.objects for insert
  with check (
    bucket_id = 'user-assets' 
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Allow users to update/delete their own assets
create policy "Users can update own assets"
  on storage.objects for update
  using (
    bucket_id = 'user-assets' 
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users can delete own assets"
  on storage.objects for delete
  using (
    bucket_id = 'user-assets' 
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Public read access for assets (since they are referenced in documents)
create policy "Public read access for assets"
  on storage.objects for select
  using (bucket_id = 'user-assets');
