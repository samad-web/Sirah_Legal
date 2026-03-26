-- Phase 1 Migration: Client File Upload + Notifications + Document Editor enhancements
-- Run order: Feature 3 → Feature 2 → Feature 1

-- ═══════════════════════════════════════════════════════════════════════════════
-- Feature 3: Client File Upload
-- ═══════════════════════════════════════════════════════════════════════════════

-- 3A: client_uploads table
CREATE TABLE IF NOT EXISTS client_uploads (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id         UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  client_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  request_id      UUID REFERENCES document_requests(id) ON DELETE SET NULL,
  file_name       TEXT NOT NULL,
  file_size       BIGINT NOT NULL,
  mime_type       TEXT NOT NULL,
  storage_path    TEXT NOT NULL UNIQUE,
  uploaded_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE client_uploads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "client_own_uploads" ON client_uploads
  FOR ALL USING (auth.uid() = client_id);

CREATE POLICY "lawyer_case_uploads" ON client_uploads
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM cases
      WHERE cases.id = client_uploads.case_id
      AND cases.lawyer_id = auth.uid()
    )
  );

-- 3B: Add upload_id to document_requests (fulfilled_at already exists)
ALTER TABLE document_requests
  ADD COLUMN IF NOT EXISTS upload_id UUID REFERENCES client_uploads(id) ON DELETE SET NULL;

-- 3C: Storage bucket for client uploads (private)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'client-uploads',
  'client-uploads',
  false,
  10485760,  -- 10 MB
  ARRAY[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/jpeg',
    'image/png',
    'image/webp'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: clients upload to their own path
CREATE POLICY "client_upload_own" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'client-uploads'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

-- Lawyers read uploads for their cases
CREATE POLICY "lawyer_read_uploads" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'client-uploads'
    AND EXISTS (
      SELECT 1
      FROM client_uploads cu
      JOIN cases c ON c.id = cu.case_id
      WHERE cu.storage_path = name
      AND c.lawyer_id = auth.uid()
    )
  );

-- Clients read their own uploads
CREATE POLICY "client_read_own_uploads" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'client-uploads'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

-- ═══════════════════════════════════════════════════════════════════════════════
-- Feature 2: Notifications System
-- ═══════════════════════════════════════════════════════════════════════════════

-- Use the existing client_notifications table if it exists, otherwise create notifications
CREATE TABLE IF NOT EXISTS notifications (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type         TEXT NOT NULL,
  title        TEXT NOT NULL,
  body         TEXT NOT NULL,
  link         TEXT,
  read         BOOLEAN NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_own_notifications" ON notifications
  FOR ALL USING (auth.uid() = user_id);

-- Index for fast unread count queries
CREATE INDEX IF NOT EXISTS notifications_user_unread
  ON notifications (user_id, read)
  WHERE read = false;
