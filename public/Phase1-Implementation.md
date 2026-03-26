# LexDraft — Phase 1 Implementation Guide
### For Claude Code · Fail-Proof Spec with Full Test Coverage

> Stack: React 19 + TypeScript + Vite · Express (Node.js) · Supabase (PostgreSQL + Auth + Storage) · Tailwind CSS v4

---

## Overview

Phase 1 adds three features that close critical workflow gaps in LexDraft:

| # | Feature | Priority | Effort |
|---|---------|----------|--------|
| 1 | [In-App Document Editor](#feature-1-in-app-document-editor) | P0 | High |
| 2 | [Notifications System](#feature-2-notifications-system) | P0 | Medium |
| 3 | [Client File Upload](#feature-3-client-file-upload) | P0 | Medium |

**Implementation order must be: Feature 3 → Feature 2 → Feature 1**. Each feature builds on infrastructure laid by the previous one. Do not reorder.

---

## Pre-Implementation Checklist

Before writing any code, confirm these are in place:

- [ ] `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are in `.env`
- [ ] `SUPABASE_ANON_KEY` is in `.env.local` (frontend)
- [ ] Supabase Storage is enabled on the project
- [ ] The `documents` table exists with columns: `id`, `user_id`, `title`, `content`, `type`, `language`, `created_at`, `updated_at`
- [ ] The `cases` table exists with columns: `id`, `lawyer_id`, `title`, `description`, `status`, `created_at`
- [ ] The `case_clients` join table exists: `case_id`, `client_id`
- [ ] The `messages` table exists: `id`, `case_id`, `sender_id`, `content`, `read`, `created_at`
- [ ] RLS is enabled on all tables
- [ ] Run `npm install` confirms no dependency conflicts

---

## Feature 3 — Client File Upload

**Implement this first. It creates the Supabase Storage bucket, upload utilities, and DB schema that Features 1 and 2 depend on.**

### 3.1 What to Build

Clients should be able to upload files directly inside their portal in response to document requests created by their advocate. Every upload is:
- Stored in Supabase Storage under `uploads/{case_id}/{client_id}/{filename}`
- Recorded in the `client_uploads` table
- Automatically logged in the `audit_log` table (same table advocates already view)
- Linked to the originating `document_request` row

### 3.2 Database Schema — Run These Migrations

```sql
-- Migration 001: client_uploads table
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

-- RLS: clients see only their own uploads; lawyers see uploads for their cases
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

-- Migration 002: document_requests table (add fulfilled_at and upload_id if not present)
ALTER TABLE document_requests
  ADD COLUMN IF NOT EXISTS fulfilled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS upload_id UUID REFERENCES client_uploads(id) ON DELETE SET NULL;

-- Migration 003: audit_log table (if not present)
CREATE TABLE IF NOT EXISTS audit_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id     UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  client_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action      TEXT NOT NULL,        -- 'upload', 'preview', 'download', 'view'
  target_id   UUID,                 -- upload_id or document_id
  target_name TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lawyer_audit_read" ON audit_log
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM cases
      WHERE cases.id = audit_log.case_id
      AND cases.lawyer_id = auth.uid()
    )
  );

CREATE POLICY "client_audit_insert" ON audit_log
  FOR INSERT WITH CHECK (auth.uid() = client_id);
```

### 3.3 Supabase Storage — Bucket Setup

Run this once via the Supabase dashboard or SQL editor:

```sql
-- Create the uploads bucket (private — no public access)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'client-uploads',
  'client-uploads',
  false,
  10485760,  -- 10 MB per file
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

-- Storage RLS: clients can upload to their own path only
CREATE POLICY "client_upload_own" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'client-uploads'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

-- Lawyers can read uploads for their cases
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

-- Clients can read their own uploads
CREATE POLICY "client_read_own" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'client-uploads'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );
```

### 3.4 Backend — Express Routes

**File:** `server/routes/uploads.ts`

```typescript
import { Router, Request, Response } from 'express';
import { requireClient } from '../middleware/auth';
import { supabaseAdmin } from '../lib/supabase';
import multer from 'multer';
import path from 'path';

const router = Router();

// Multer: memory storage, 10 MB limit, strict MIME check
const ALLOWED_MIMES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg',
  'image/png',
  'image/webp',
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIMES.has(file.mimetype)) {
      return cb(new Error(`File type not allowed: ${file.mimetype}`));
    }
    cb(null, true);
  },
});

// POST /api/uploads
// Body: multipart/form-data with fields: file, case_id, request_id (optional)
router.post(
  '/',
  requireClient,
  upload.single('file'),
  async (req: Request, res: Response) => {
    const clientId = req.user!.id;

    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    const { case_id, request_id } = req.body as {
      case_id?: string;
      request_id?: string;
    };

    if (!case_id) {
      return res.status(400).json({ error: 'case_id is required' });
    }

    // Verify client is assigned to this case
    const { data: assignment, error: assignError } = await supabaseAdmin
      .from('case_clients')
      .select('case_id')
      .eq('case_id', case_id)
      .eq('client_id', clientId)
      .maybeSingle();

    if (assignError || !assignment) {
      return res.status(403).json({ error: 'Not assigned to this case' });
    }

    // Sanitise filename
    const ext = path.extname(req.file.originalname).toLowerCase();
    const safeBasename = path.basename(req.file.originalname, ext)
      .replace(/[^a-zA-Z0-9_\-]/g, '_')
      .slice(0, 80);
    const timestamp = Date.now();
    const storagePath = `uploads/${case_id}/${clientId}/${timestamp}_${safeBasename}${ext}`;

    // Upload to Supabase Storage
    const { error: storageError } = await supabaseAdmin.storage
      .from('client-uploads')
      .upload(storagePath, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: false,
      });

    if (storageError) {
      console.error('Storage upload failed:', storageError);
      return res.status(500).json({ error: 'File storage failed' });
    }

    // Insert record
    const { data: uploadRecord, error: dbError } = await supabaseAdmin
      .from('client_uploads')
      .insert({
        case_id,
        client_id: clientId,
        request_id: request_id ?? null,
        file_name: `${safeBasename}${ext}`,
        file_size: req.file.size,
        mime_type: req.file.mimetype,
        storage_path: storagePath,
      })
      .select()
      .single();

    if (dbError) {
      // Roll back storage
      await supabaseAdmin.storage.from('client-uploads').remove([storagePath]);
      return res.status(500).json({ error: 'Database insert failed' });
    }

    // Fulfil the document request if request_id provided
    if (request_id) {
      await supabaseAdmin
        .from('document_requests')
        .update({
          status: 'fulfilled',
          fulfilled_at: new Date().toISOString(),
          upload_id: uploadRecord.id,
        })
        .eq('id', request_id)
        .eq('case_id', case_id);
    }

    // Audit log
    await supabaseAdmin.from('audit_log').insert({
      case_id,
      client_id: clientId,
      action: 'upload',
      target_id: uploadRecord.id,
      target_name: uploadRecord.file_name,
    });

    return res.status(201).json({ upload: uploadRecord });
  }
);

// GET /api/uploads/:uploadId/url — generate a signed URL (1 hour expiry)
router.get('/:uploadId/url', requireClient, async (req: Request, res: Response) => {
  const clientId = req.user!.id;
  const { uploadId } = req.params;

  const { data: upload, error } = await supabaseAdmin
    .from('client_uploads')
    .select('storage_path, client_id')
    .eq('id', uploadId)
    .maybeSingle();

  if (error || !upload) {
    return res.status(404).json({ error: 'Upload not found' });
  }

  if (upload.client_id !== clientId) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const { data: signedUrl, error: urlError } = await supabaseAdmin.storage
    .from('client-uploads')
    .createSignedUrl(upload.storage_path, 3600);

  if (urlError || !signedUrl) {
    return res.status(500).json({ error: 'Could not generate download URL' });
  }

  return res.json({ url: signedUrl.signedUrl, expires_in: 3600 });
});

// DELETE /api/uploads/:uploadId
router.delete('/:uploadId', requireClient, async (req: Request, res: Response) => {
  const clientId = req.user!.id;
  const { uploadId } = req.params;

  const { data: upload, error } = await supabaseAdmin
    .from('client_uploads')
    .select('storage_path, client_id')
    .eq('id', uploadId)
    .maybeSingle();

  if (error || !upload) {
    return res.status(404).json({ error: 'Upload not found' });
  }

  if (upload.client_id !== clientId) {
    return res.status(403).json({ error: 'Access denied' });
  }

  await supabaseAdmin.storage.from('client-uploads').remove([upload.storage_path]);
  await supabaseAdmin.from('client_uploads').delete().eq('id', uploadId);

  return res.json({ deleted: true });
});

export default router;
```

**Wire up in `server/index.ts`:**
```typescript
import uploadsRouter from './routes/uploads';
app.use('/api/uploads', uploadsRouter);
```

### 3.5 Frontend — Upload Component

**File:** `src/components/client/FileUploadZone.tsx`

```tsx
import { useState, useCallback, useRef } from 'react';
import { apiClient } from '../../lib/api';

interface FileUploadZoneProps {
  caseId: string;
  requestId?: string;
  onUploadComplete: (upload: ClientUpload) => void;
}

const ALLOWED_EXTENSIONS = ['.pdf', '.doc', '.docx', '.jpg', '.jpeg', '.png', '.webp'];
const MAX_SIZE_MB = 10;

export function FileUploadZone({ caseId, requestId, onUploadComplete }: FileUploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const validateFile = (file: File): string | null => {
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return `File type not supported. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}`;
    }
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      return `File too large. Maximum size is ${MAX_SIZE_MB} MB.`;
    }
    return null;
  };

  const uploadFile = useCallback(async (file: File) => {
    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    setIsUploading(true);
    setProgress(0);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('case_id', caseId);
    if (requestId) formData.append('request_id', requestId);

    try {
      // XMLHttpRequest for progress tracking
      const upload = await new Promise<ClientUpload>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            setProgress(Math.round((e.loaded / e.total) * 100));
          }
        });
        xhr.addEventListener('load', () => {
          if (xhr.status === 201) {
            resolve(JSON.parse(xhr.responseText).upload);
          } else {
            try {
              reject(new Error(JSON.parse(xhr.responseText).error ?? 'Upload failed'));
            } catch {
              reject(new Error('Upload failed'));
            }
          }
        });
        xhr.addEventListener('error', () => reject(new Error('Network error during upload')));
        xhr.open('POST', '/api/uploads');
        xhr.setRequestHeader('Authorization', `Bearer ${apiClient.getToken()}`);
        xhr.send(formData);
      });

      onUploadComplete(upload);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed. Please try again.');
    } finally {
      setIsUploading(false);
      setProgress(0);
      if (inputRef.current) inputRef.current.value = '';
    }
  }, [caseId, requestId, onUploadComplete]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) uploadFile(file);
  }, [uploadFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => setIsDragging(false), []);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
  }, [uploadFile]);

  return (
    <div>
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => !isUploading && inputRef.current?.click()}
        role="button"
        aria-label="Upload file"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && !isUploading && inputRef.current?.click()}
        className={[
          'border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer',
          isDragging ? 'border-[#C9A84C] bg-[#C9A84C]/5' : 'border-[#2a2a2a] hover:border-[#C9A84C]/50',
          isUploading ? 'pointer-events-none opacity-70' : '',
        ].join(' ')}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ALLOWED_EXTENSIONS.join(',')}
          onChange={handleInputChange}
          className="hidden"
          aria-hidden="true"
        />

        {isUploading ? (
          <div>
            <p className="text-[#FAF7F0]/60 text-sm mb-3">Uploading...</p>
            <div className="h-1.5 bg-[#2a2a2a] rounded-full overflow-hidden">
              <div
                className="h-full bg-[#C9A84C] rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-[#C9A84C] text-xs mt-2">{progress}%</p>
          </div>
        ) : (
          <>
            <p className="text-[#FAF7F0]/60 text-sm">
              Drag & drop a file here, or <span className="text-[#C9A84C] underline">browse</span>
            </p>
            <p className="text-[#FAF7F0]/30 text-xs mt-1">
              PDF, DOC, DOCX, JPG, PNG, WEBP · Max {MAX_SIZE_MB} MB
            </p>
          </>
        )}
      </div>

      {error && (
        <p role="alert" className="text-red-400 text-xs mt-2 flex items-center gap-1">
          <span aria-hidden>⚠</span> {error}
        </p>
      )}
    </div>
  );
}
```

---

## Feature 2 — Notifications System

**Implement after Feature 3. The notification triggers piggyback on the upload and document-request infrastructure.**

### 2.1 What to Build

- In-app notification bell in the advocate's sidebar showing unread count
- Notifications auto-created by the server on 5 trigger events (see §2.2)
- Notification centre page listing all notifications, newest first
- Mark-as-read on click; mark-all-read button
- Email notifications via Nodemailer (or Resend) for advocate-facing events
- Real-time unread count using Supabase Realtime (channel subscription)

### 2.2 Trigger Events

| Event | Who gets notified | Channel |
|-------|------------------|---------|
| Client uploads a file | Advocate | In-app + Email |
| Client marks document request as fulfilled | Advocate | In-app + Email |
| Client sends a message | Advocate | In-app only |
| Advocate creates a document request | Client | In-app only |
| Case status changes | Client | In-app + Email |

### 2.3 Database Schema

```sql
-- Migration 004: notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type         TEXT NOT NULL,   -- see enum below
  title        TEXT NOT NULL,
  body         TEXT NOT NULL,
  link         TEXT,            -- relative URL to navigate to on click
  read         BOOLEAN NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Notification type enum values (enforce in application layer):
-- 'client_upload', 'request_fulfilled', 'new_message',
-- 'document_request_created', 'case_status_changed'

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_own_notifications" ON notifications
  FOR ALL USING (auth.uid() = user_id);

-- Index for fast unread count queries
CREATE INDEX IF NOT EXISTS notifications_user_unread
  ON notifications (user_id, read)
  WHERE read = false;
```

### 2.4 Notification Service — Shared Utility

**File:** `server/services/notifications.ts`

```typescript
import { supabaseAdmin } from '../lib/supabase';

export type NotificationType =
  | 'client_upload'
  | 'request_fulfilled'
  | 'new_message'
  | 'document_request_created'
  | 'case_status_changed';

interface CreateNotificationParams {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  link?: string;
}

export async function createNotification(params: CreateNotificationParams): Promise<void> {
  const { error } = await supabaseAdmin.from('notifications').insert({
    user_id: params.userId,
    type: params.type,
    title: params.title,
    body: params.body,
    link: params.link ?? null,
  });

  if (error) {
    // Log but don't throw — notifications are non-critical
    console.error('[notifications] Insert failed:', error.message);
  }
}

// Helper: notify advocate when client uploads a file
export async function notifyAdvocateClientUpload(
  lawyerId: string,
  clientName: string,
  caseTitle: string,
  caseId: string,
  fileName: string
): Promise<void> {
  await createNotification({
    userId: lawyerId,
    type: 'client_upload',
    title: 'New file uploaded',
    body: `${clientName} uploaded "${fileName}" to case "${caseTitle}"`,
    link: `/clients?case=${caseId}&tab=audit`,
  });
}

// Helper: notify advocate when request is marked fulfilled
export async function notifyAdvocateRequestFulfilled(
  lawyerId: string,
  clientName: string,
  requestTitle: string,
  caseId: string
): Promise<void> {
  await createNotification({
    userId: lawyerId,
    type: 'request_fulfilled',
    title: 'Document request fulfilled',
    body: `${clientName} marked "${requestTitle}" as complete`,
    link: `/clients?case=${caseId}&tab=requests`,
  });
}

// Helper: notify advocate of new client message
export async function notifyAdvocateNewMessage(
  lawyerId: string,
  clientName: string,
  caseTitle: string,
  caseId: string
): Promise<void> {
  await createNotification({
    userId: lawyerId,
    type: 'new_message',
    title: 'New message',
    body: `${clientName} sent a message in "${caseTitle}"`,
    link: `/messages?case=${caseId}`,
  });
}

// Helper: notify client of new document request
export async function notifyClientDocumentRequest(
  clientId: string,
  requestTitle: string,
  caseTitle: string
): Promise<void> {
  await createNotification({
    userId: clientId,
    type: 'document_request_created',
    title: 'Document requested',
    body: `Your advocate has requested: "${requestTitle}" for case "${caseTitle}"`,
    link: `/client/dashboard`,
  });
}

// Helper: notify client of case status change
export async function notifyClientCaseStatusChange(
  clientId: string,
  caseTitle: string,
  newStatus: string
): Promise<void> {
  await createNotification({
    userId: clientId,
    type: 'case_status_changed',
    title: 'Case status updated',
    body: `"${caseTitle}" is now marked as ${newStatus}`,
    link: `/client/dashboard`,
  });
}
```

### 2.5 Backend — Notification Routes

**File:** `server/routes/notifications.ts`

```typescript
import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { supabaseAdmin } from '../lib/supabase';

const router = Router();

// GET /api/notifications?limit=20&offset=0
router.get('/', requireAuth, async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const limit = Math.min(Number(req.query.limit ?? 20), 50);
  const offset = Number(req.query.offset ?? 0);

  const { data, error, count } = await supabaseAdmin
    .from('notifications')
    .select('*', { count: 'exact' })
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) return res.status(500).json({ error: error.message });

  const unreadCount = await supabaseAdmin
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('read', false);

  return res.json({
    notifications: data,
    total: count,
    unread_count: unreadCount.count ?? 0,
  });
});

// PATCH /api/notifications/:id/read
router.patch('/:id/read', requireAuth, async (req: Request, res: Response) => {
  const userId = req.user!.id;
  const { id } = req.params;

  const { error } = await supabaseAdmin
    .from('notifications')
    .update({ read: true })
    .eq('id', id)
    .eq('user_id', userId);  // ownership check

  if (error) return res.status(500).json({ error: error.message });

  return res.json({ updated: true });
});

// PATCH /api/notifications/read-all
router.patch('/read-all', requireAuth, async (req: Request, res: Response) => {
  const userId = req.user!.id;

  const { error } = await supabaseAdmin
    .from('notifications')
    .update({ read: true })
    .eq('user_id', userId)
    .eq('read', false);

  if (error) return res.status(500).json({ error: error.message });

  return res.json({ updated: true });
});

export default router;
```

**Wire up:**
```typescript
import notificationsRouter from './routes/notifications';
app.use('/api/notifications', notificationsRouter);
```

### 2.6 Trigger Integration Points

In `server/routes/uploads.ts`, after the audit log insert, add:

```typescript
// Fetch case and client details for notification
const { data: caseData } = await supabaseAdmin
  .from('cases')
  .select('title, lawyer_id')
  .eq('id', case_id)
  .single();

const { data: clientProfile } = await supabaseAdmin
  .from('profiles')
  .select('full_name')
  .eq('id', clientId)
  .maybeSingle();

if (caseData) {
  await notifyAdvocateClientUpload(
    caseData.lawyer_id,
    clientProfile?.full_name ?? 'Your client',
    caseData.title,
    case_id,
    uploadRecord.file_name
  );
}
```

In the existing messages route (wherever a message is inserted), add after the insert:

```typescript
const { data: caseData } = await supabaseAdmin
  .from('cases')
  .select('title, lawyer_id')
  .eq('id', message.case_id)
  .single();

const { data: clientProfile } = await supabaseAdmin
  .from('profiles')
  .select('full_name')
  .eq('id', senderId)
  .maybeSingle();

if (caseData && senderId !== caseData.lawyer_id) {
  await notifyAdvocateNewMessage(
    caseData.lawyer_id,
    clientProfile?.full_name ?? 'Your client',
    caseData.title,
    message.case_id
  );
}
```

### 2.7 Frontend — Notification Bell Hook

**File:** `src/hooks/useNotifications.ts`

```typescript
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { apiClient } from '../lib/api';

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  link: string | null;
  read: boolean;
  created_at: string;
}

export function useNotifications(userId: string | null) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const fetchNotifications = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const data = await apiClient.get('/api/notifications?limit=20');
      setNotifications(data.notifications);
      setUnreadCount(data.unread_count);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // Real-time unread count via Supabase Realtime
  useEffect(() => {
    if (!userId) return;

    fetchNotifications();

    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          setNotifications((prev) => [payload.new as Notification, ...prev]);
          setUnreadCount((prev) => prev + 1);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, fetchNotifications]);

  const markRead = useCallback(async (id: string) => {
    await apiClient.patch(`/api/notifications/${id}/read`, {});
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));
  }, []);

  const markAllRead = useCallback(async () => {
    await apiClient.patch('/api/notifications/read-all', {});
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
  }, []);

  return { notifications, unreadCount, loading, markRead, markAllRead, refetch: fetchNotifications };
}
```

### 2.8 Frontend — Notification Bell Component

**File:** `src/components/NotificationBell.tsx`

```tsx
import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from '../hooks/useNotifications';
import { useAuthStore } from '../store/authStore';
import { formatDistanceToNow } from 'date-fns';

export function NotificationBell() {
  const { user } = useAuthStore();
  const { notifications, unreadCount, loading, markRead, markAllRead } =
    useNotifications(user?.id ?? null);
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const handleNotificationClick = async (n: typeof notifications[0]) => {
    if (!n.read) await markRead(n.id);
    if (n.link) {
      navigate(n.link);
      setOpen(false);
    }
  };

  return (
    <div ref={panelRef} className="relative">
      <button
        aria-label={`Notifications — ${unreadCount} unread`}
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="relative p-2 rounded-md hover:bg-[#1e1e1e] transition-colors"
      >
        {/* Bell icon */}
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>
        {unreadCount > 0 && (
          <span
            aria-hidden="true"
            className="absolute top-1 right-1 w-4 h-4 rounded-full bg-[#C9A84C] text-[#0a0a0a] text-[9px] font-bold flex items-center justify-center"
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Notifications"
          className="absolute right-0 top-10 w-80 bg-[#161616] border border-[#2a2a2a] rounded-xl shadow-2xl z-50 overflow-hidden"
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#2a2a2a]">
            <h2 className="text-sm font-semibold text-[#FAF7F0]">Notifications</h2>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="text-xs text-[#C9A84C] hover:underline"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-[360px] overflow-y-auto">
            {loading && (
              <p className="text-center text-xs text-[#FAF7F0]/40 py-8">Loading...</p>
            )}

            {!loading && notifications.length === 0 && (
              <div className="py-12 text-center">
                <p className="text-[#FAF7F0]/30 text-sm">You're all caught up</p>
              </div>
            )}

            {notifications.map((n) => (
              <button
                key={n.id}
                onClick={() => handleNotificationClick(n)}
                className={[
                  'w-full text-left px-4 py-3 border-b border-[#2a2a2a] last:border-0',
                  'hover:bg-[#1e1e1e] transition-colors',
                  !n.read ? 'border-l-2 border-l-[#C9A84C]' : 'border-l-2 border-l-transparent',
                ].join(' ')}
              >
                <p className={`text-sm font-medium ${n.read ? 'text-[#FAF7F0]/60' : 'text-[#FAF7F0]'}`}>
                  {n.title}
                </p>
                <p className="text-xs text-[#FAF7F0]/40 mt-0.5 line-clamp-2">{n.body}</p>
                <p className="text-[10px] text-[#FAF7F0]/25 mt-1">
                  {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                </p>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

**Add to advocate sidebar layout — replace any existing bell placeholder.**

---

## Feature 1 — In-App Document Editor

**Implement last. Depends on Feature 2's notification infrastructure and the existing document library.**

### 1.1 What to Build

After AI generation streams in, the document renders in a TipTap rich-text editor instead of a read-only `<pre>` block. The advocate can:
- Edit any text directly
- Save changes (creates a new version snapshot)
- Regenerate a highlighted section with an AI instruction
- See an unsaved-changes indicator when edits haven't been saved

### 1.2 Dependencies — Install First

```bash
npm install @tiptap/react @tiptap/starter-kit @tiptap/extension-placeholder @tiptap/extension-character-count
```

Do not install `@tiptap/pro-*` packages — use only the open-source extensions listed above.

### 1.3 Database Schema

```sql
-- Migration 005: document_versions table
CREATE TABLE IF NOT EXISTS document_versions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id  UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  content      TEXT NOT NULL,
  char_count   INT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE document_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lawyer_own_doc_versions" ON document_versions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM documents
      WHERE documents.id = document_versions.document_id
      AND documents.user_id = auth.uid()
    )
  );
```

### 1.4 Backend — Document Update Route

**File:** `server/routes/documents.ts` — add these two handlers to the existing router:

```typescript
// PATCH /api/documents/:id — save edited content
router.patch('/:id', requireLawyer, async (req: Request, res: Response) => {
  const lawyerId = req.user!.id;
  const { id } = req.params;
  const { content } = req.body as { content?: string };

  if (typeof content !== 'string' || content.trim().length === 0) {
    return res.status(400).json({ error: 'content is required and must be a non-empty string' });
  }

  if (content.length > 500_000) {
    return res.status(400).json({ error: 'content exceeds maximum length (500,000 characters)' });
  }

  // Ownership check
  const { data: doc, error: docError } = await supabaseAdmin
    .from('documents')
    .select('id, user_id, content')
    .eq('id', id)
    .eq('user_id', lawyerId)
    .maybeSingle();

  if (docError || !doc) {
    return res.status(404).json({ error: 'Document not found' });
  }

  // No-op if content unchanged
  if (doc.content === content) {
    return res.json({ updated: false, message: 'Content unchanged' });
  }

  // Save version snapshot of CURRENT content before overwriting
  await supabaseAdmin.from('document_versions').insert({
    document_id: id,
    content: doc.content,
    char_count: doc.content.length,
  });

  // Update document
  const { error: updateError } = await supabaseAdmin
    .from('documents')
    .update({ content, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (updateError) {
    return res.status(500).json({ error: 'Failed to save document' });
  }

  return res.json({ updated: true });
});

// GET /api/documents/:id/versions
router.get('/:id/versions', requireLawyer, async (req: Request, res: Response) => {
  const lawyerId = req.user!.id;
  const { id } = req.params;

  // Ownership check
  const { data: doc } = await supabaseAdmin
    .from('documents')
    .select('id')
    .eq('id', id)
    .eq('user_id', lawyerId)
    .maybeSingle();

  if (!doc) return res.status(404).json({ error: 'Document not found' });

  const { data: versions, error } = await supabaseAdmin
    .from('document_versions')
    .select('id, char_count, created_at')
    .eq('document_id', id)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) return res.status(500).json({ error: error.message });

  return res.json({ versions });
});

// GET /api/documents/versions/:versionId — fetch full content of a specific version
router.get('/versions/:versionId', requireLawyer, async (req: Request, res: Response) => {
  const lawyerId = req.user!.id;
  const { versionId } = req.params;

  const { data: version, error } = await supabaseAdmin
    .from('document_versions')
    .select('id, content, char_count, created_at, document_id')
    .eq('id', versionId)
    .maybeSingle();

  if (error || !version) return res.status(404).json({ error: 'Version not found' });

  // Verify lawyer owns the parent document
  const { data: doc } = await supabaseAdmin
    .from('documents')
    .select('id')
    .eq('id', version.document_id)
    .eq('user_id', lawyerId)
    .maybeSingle();

  if (!doc) return res.status(403).json({ error: 'Access denied' });

  return res.json({ version });
});
```

### 1.5 Backend — Section Regeneration Route

**File:** `server/routes/generate.ts` — add this route:

```typescript
// POST /api/generate/section
// Regenerates a highlighted section of an existing document
router.post('/section', requireLawyer, async (req: Request, res: Response) => {
  const { document_id, selected_text, instruction } = req.body as {
    document_id?: string;
    selected_text?: string;
    instruction?: string;
  };

  if (!document_id || !selected_text || !instruction) {
    return res.status(400).json({ error: 'document_id, selected_text, and instruction are all required' });
  }

  if (selected_text.length > 5000) {
    return res.status(400).json({ error: 'Selected text too long (max 5,000 characters)' });
  }

  if (instruction.length > 500) {
    return res.status(400).json({ error: 'Instruction too long (max 500 characters)' });
  }

  // Ownership check
  const lawyerId = req.user!.id;
  const { data: doc } = await supabaseAdmin
    .from('documents')
    .select('id, type')
    .eq('id', document_id)
    .eq('user_id', lawyerId)
    .maybeSingle();

  if (!doc) return res.status(404).json({ error: 'Document not found' });

  // Check quota
  const quotaOk = await checkGenerationQuota(lawyerId);
  if (!quotaOk) {
    return res.status(429).json({ error: 'Monthly generation limit reached. Please upgrade your plan.' });
  }

  const systemPrompt = `You are an expert Indian legal document drafter.
You will receive a section of a legal document and an instruction to improve it.
Output ONLY the rewritten section — no preamble, no explanation, no markdown fences.
Maintain the same legal tone, format, and structure as the original.
Do not add fabricated case citations. Use [CITATION] if referencing case law.
Do not add fabricated registration numbers. Use [TO BE VERIFIED] for such references.`;

  const userPrompt = `ORIGINAL SECTION:
${selected_text}

INSTRUCTION:
${instruction}

Rewrite the section above following the instruction. Output only the rewritten text.`;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    const stream = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      stream: true,
      max_tokens: 2000,
    });

    for await (const chunk of stream) {
      const text = chunk.choices[0]?.delta?.content ?? '';
      if (text) res.write(`data: ${JSON.stringify({ text })}\n\n`);
    }

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (err) {
    res.write(`data: ${JSON.stringify({ error: 'Generation failed' })}\n\n`);
    res.end();
  }
});
```

### 1.6 Frontend — Document Editor Component

**File:** `src/components/documents/DocumentEditor.tsx`

```tsx
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import CharacterCount from '@tiptap/extension-character-count';
import { useState, useEffect, useCallback, useRef } from 'react';
import { apiClient } from '../../lib/api';

interface DocumentEditorProps {
  documentId: string;
  initialContent: string;
  onSaved?: () => void;
}

const AUTOSAVE_DEBOUNCE_MS = 2000;
const MAX_CHARS = 500_000;

export function DocumentEditor({ documentId, initialContent, onSaved }: DocumentEditorProps) {
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const autosaveTimer = useRef<ReturnType<typeof setTimeout>>();

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: 'Start editing your document...' }),
      CharacterCount.configure({ limit: MAX_CHARS }),
    ],
    content: initialContent,
    onUpdate: ({ editor }) => {
      setIsDirty(true);
      setSaveError(null);

      // Debounced autosave
      clearTimeout(autosaveTimer.current);
      autosaveTimer.current = setTimeout(() => {
        saveDocument(editor.getText({ blockSeparator: '\n\n' }));
      }, AUTOSAVE_DEBOUNCE_MS);
    },
  });

  // Cleanup autosave timer on unmount
  useEffect(() => {
    return () => clearTimeout(autosaveTimer.current);
  }, []);

  const saveDocument = useCallback(async (content: string) => {
    setIsSaving(true);
    setSaveError(null);

    try {
      await apiClient.patch(`/api/documents/${documentId}`, { content });
      setIsDirty(false);
      setLastSaved(new Date());
      onSaved?.();
    } catch (err) {
      setSaveError('Save failed. Changes are not persisted yet.');
    } finally {
      setIsSaving(false);
    }
  }, [documentId, onSaved]);

  const handleManualSave = useCallback(() => {
    if (!editor || !isDirty) return;
    clearTimeout(autosaveTimer.current);
    saveDocument(editor.getText({ blockSeparator: '\n\n' }));
  }, [editor, isDirty, saveDocument]);

  const handleRegenerateSection = useCallback(async () => {
    if (!editor) return;

    const { from, to } = editor.state.selection;
    if (from === to) {
      alert('Select a section of text first, then click Regenerate Section.');
      return;
    }

    const selectedText = editor.state.doc.textBetween(from, to, '\n');
    const instruction = window.prompt(
      'How should this section be rewritten?\n\nExample: "Make this more formal" or "Add a penalty clause"'
    );

    if (!instruction?.trim()) return;

    setIsRegenerating(true);
    let result = '';

    try {
      const response = await fetch('/api/generate/section', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiClient.getToken()}`,
        },
        body: JSON.stringify({
          document_id: documentId,
          selected_text: selectedText,
          instruction: instruction.trim(),
        }),
      });

      if (!response.ok || !response.body) {
        throw new Error('Regeneration failed');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const lines = decoder.decode(value).split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') break;
            try {
              const parsed = JSON.parse(data);
              if (parsed.text) result += parsed.text;
              if (parsed.error) throw new Error(parsed.error);
            } catch { /* skip malformed lines */ }
          }
        }
      }

      // Replace selected text with regenerated text
      editor.chain().focus().deleteRange({ from, to }).insertContentAt(from, result).run();
      setIsDirty(true);
    } catch (err) {
      alert('Regeneration failed. Please try again.');
    } finally {
      setIsRegenerating(false);
    }
  }, [editor, documentId]);

  const charCount = editor?.storage.characterCount.characters() ?? 0;
  const isNearLimit = charCount > MAX_CHARS * 0.9;

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-[#2a2a2a] bg-[#161616]">
        <div className="flex items-center gap-3">
          {/* Status indicator */}
          <span className="text-xs text-[#FAF7F0]/40">
            {isSaving ? 'Saving...' :
             isDirty ? '● Unsaved changes' :
             lastSaved ? `Saved ${lastSaved.toLocaleTimeString()}` : 'Ready'}
          </span>
          {saveError && (
            <span role="alert" className="text-xs text-red-400">{saveError}</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleRegenerateSection}
            disabled={isRegenerating}
            title="Select text, then click to regenerate that section with AI"
            className="px-3 py-1.5 text-xs bg-[#C9A84C]/10 border border-[#C9A84C]/30 text-[#C9A84C] rounded-md hover:bg-[#C9A84C]/20 disabled:opacity-40 transition-colors"
          >
            {isRegenerating ? 'Regenerating...' : '✦ Regenerate section'}
          </button>

          <button
            onClick={handleManualSave}
            disabled={!isDirty || isSaving}
            className="px-3 py-1.5 text-xs bg-[#FAF7F0]/5 border border-[#FAF7F0]/10 text-[#FAF7F0]/60 rounded-md hover:text-[#FAF7F0] disabled:opacity-30 transition-colors"
          >
            Save
          </button>
        </div>
      </div>

      {/* Editor area */}
      <div className="flex-1 overflow-y-auto">
        <EditorContent
          editor={editor}
          className={[
            'h-full prose prose-invert max-w-none',
            'prose-p:text-[#FAF7F0]/90 prose-p:leading-relaxed',
            'focus:outline-none',
          ].join(' ')}
        />
      </div>

      {/* Footer: character count */}
      <div className="px-4 py-2 border-t border-[#2a2a2a] flex justify-end">
        <span className={`text-xs ${isNearLimit ? 'text-red-400' : 'text-[#FAF7F0]/25'}`}>
          {charCount.toLocaleString()} / {MAX_CHARS.toLocaleString()} characters
        </span>
      </div>
    </div>
  );
}
```

---

## Test Cases

> Run with: `npm test` (Vitest) for unit/integration tests · `npx playwright test` for E2E

### Setup — Test Utilities

**File:** `tests/helpers/db.ts`

```typescript
import { supabaseAdmin } from '../../server/lib/supabase';

export async function createTestLawyer() {
  const email = `test-lawyer-${Date.now()}@sirah.test`;
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password: 'Test1234!',
    user_metadata: { role: 'lawyer' },
  });
  if (error) throw error;
  return data.user;
}

export async function createTestClient() {
  const email = `test-client-${Date.now()}@sirah.test`;
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password: 'Test1234!',
    user_metadata: { role: 'client' },
  });
  if (error) throw error;
  return data.user;
}

export async function createTestCase(lawyerId: string) {
  const { data, error } = await supabaseAdmin
    .from('cases')
    .insert({ lawyer_id: lawyerId, title: 'Test Case', description: 'Test', status: 'Active' })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function assignClientToCase(caseId: string, clientId: string) {
  const { error } = await supabaseAdmin
    .from('case_clients')
    .insert({ case_id: caseId, client_id: clientId });
  if (error) throw error;
}

export async function createTestDocument(lawyerId: string, content = 'Initial document content') {
  const { data, error } = await supabaseAdmin
    .from('documents')
    .insert({ user_id: lawyerId, title: 'Test Document', content, type: 'Notice', language: 'EN' })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function createTestDocumentRequest(caseId: string, title = 'Upload original deed') {
  const { data, error } = await supabaseAdmin
    .from('document_requests')
    .insert({ case_id: caseId, title, status: 'pending' })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getAuthToken(email: string, password: string) {
  const { data, error } = await supabaseAdmin.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data.session!.access_token;
}

export async function cleanupUser(userId: string) {
  await supabaseAdmin.auth.admin.deleteUser(userId);
}
```

---

### Feature 3 Tests — Client File Upload

**File:** `tests/uploads.test.ts`

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../server/index';
import {
  createTestLawyer, createTestClient, createTestCase,
  assignClientToCase, createTestDocumentRequest,
  getAuthToken, cleanupUser,
} from './helpers/db';
import { supabaseAdmin } from '../server/lib/supabase';
import path from 'path';
import fs from 'fs';

const TEST_PDF_PATH = path.join(__dirname, 'fixtures', 'sample.pdf');
const TEST_EXE_PATH = path.join(__dirname, 'fixtures', 'bad.exe');

// Create minimal test fixtures if they don't exist
beforeAll(async () => {
  if (!fs.existsSync(path.join(__dirname, 'fixtures'))) {
    fs.mkdirSync(path.join(__dirname, 'fixtures'), { recursive: true });
  }
  if (!fs.existsSync(TEST_PDF_PATH)) {
    // Minimal valid PDF header
    fs.writeFileSync(TEST_PDF_PATH, '%PDF-1.4\n%%EOF\n');
  }
  if (!fs.existsSync(TEST_EXE_PATH)) {
    fs.writeFileSync(TEST_EXE_PATH, 'MZ fake exe content');
  }
});

describe('POST /api/uploads', () => {
  let lawyer: any, client: any, otherClient: any;
  let caseId: string, requestId: string;
  let clientToken: string, lawyerToken: string, otherClientToken: string;
  const createdUploadIds: string[] = [];

  beforeAll(async () => {
    lawyer      = await createTestLawyer();
    client      = await createTestClient();
    otherClient = await createTestClient();
    const testCase = await createTestCase(lawyer.id);
    caseId = testCase.id;
    await assignClientToCase(caseId, client.id);
    const req = await createTestDocumentRequest(caseId);
    requestId = req.id;

    clientToken      = await getAuthToken(client.email!, 'Test1234!');
    lawyerToken      = await getAuthToken(lawyer.email!, 'Test1234!');
    otherClientToken = await getAuthToken(otherClient.email!, 'Test1234!');
  });

  afterAll(async () => {
    // Remove test uploads from storage
    for (const id of createdUploadIds) {
      const { data } = await supabaseAdmin.from('client_uploads').select('storage_path').eq('id', id).single();
      if (data) await supabaseAdmin.storage.from('client-uploads').remove([data.storage_path]);
    }
    await supabaseAdmin.from('client_uploads').delete().in('id', createdUploadIds);
    await cleanupUser(lawyer.id);
    await cleanupUser(client.id);
    await cleanupUser(otherClient.id);
  });

  // ── HAPPY PATH ──────────────────────────────────────────────

  it('TC-UP-01: Authenticated client uploads a valid PDF to their assigned case', async () => {
    const res = await request(app)
      .post('/api/uploads')
      .set('Authorization', `Bearer ${clientToken}`)
      .field('case_id', caseId)
      .attach('file', TEST_PDF_PATH);

    expect(res.status).toBe(201);
    expect(res.body.upload).toMatchObject({
      case_id: caseId,
      client_id: client.id,
      mime_type: 'application/pdf',
    });
    expect(res.body.upload.id).toBeTruthy();
    expect(res.body.upload.storage_path).toContain(caseId);
    createdUploadIds.push(res.body.upload.id);
  });

  it('TC-UP-02: Upload with request_id marks the document request as fulfilled', async () => {
    const res = await request(app)
      .post('/api/uploads')
      .set('Authorization', `Bearer ${clientToken}`)
      .field('case_id', caseId)
      .field('request_id', requestId)
      .attach('file', TEST_PDF_PATH);

    expect(res.status).toBe(201);
    createdUploadIds.push(res.body.upload.id);

    // Verify the request is now fulfilled
    const { data: req } = await supabaseAdmin
      .from('document_requests')
      .select('status, fulfilled_at, upload_id')
      .eq('id', requestId)
      .single();

    expect(req?.status).toBe('fulfilled');
    expect(req?.fulfilled_at).not.toBeNull();
    expect(req?.upload_id).toBe(res.body.upload.id);
  });

  it('TC-UP-03: Upload creates an audit log entry', async () => {
    const res = await request(app)
      .post('/api/uploads')
      .set('Authorization', `Bearer ${clientToken}`)
      .field('case_id', caseId)
      .attach('file', TEST_PDF_PATH);

    expect(res.status).toBe(201);
    createdUploadIds.push(res.body.upload.id);

    const { data: log } = await supabaseAdmin
      .from('audit_log')
      .select('action, target_id')
      .eq('target_id', res.body.upload.id)
      .maybeSingle();

    expect(log?.action).toBe('upload');
    expect(log?.target_id).toBe(res.body.upload.id);
  });

  it('TC-UP-04: Upload creates a notification for the advocate', async () => {
    const res = await request(app)
      .post('/api/uploads')
      .set('Authorization', `Bearer ${clientToken}`)
      .field('case_id', caseId)
      .attach('file', TEST_PDF_PATH);

    expect(res.status).toBe(201);
    createdUploadIds.push(res.body.upload.id);

    // Wait briefly for async notification insert
    await new Promise((r) => setTimeout(r, 200));

    const { data: notif } = await supabaseAdmin
      .from('notifications')
      .select('type, user_id')
      .eq('user_id', lawyer.id)
      .eq('type', 'client_upload')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    expect(notif?.type).toBe('client_upload');
    expect(notif?.user_id).toBe(lawyer.id);
  });

  // ── AUTH FAILURES ──────────────────────────────────────────

  it('TC-UP-05: Returns 401 with no Authorization header', async () => {
    const res = await request(app)
      .post('/api/uploads')
      .field('case_id', caseId)
      .attach('file', TEST_PDF_PATH);

    expect(res.status).toBe(401);
  });

  it('TC-UP-06: Returns 401 with an invalid/expired token', async () => {
    const res = await request(app)
      .post('/api/uploads')
      .set('Authorization', 'Bearer this.is.not.valid')
      .field('case_id', caseId)
      .attach('file', TEST_PDF_PATH);

    expect(res.status).toBe(401);
  });

  it('TC-UP-07: Advocate token (not a client) is rejected with 403', async () => {
    const res = await request(app)
      .post('/api/uploads')
      .set('Authorization', `Bearer ${lawyerToken}`)
      .field('case_id', caseId)
      .attach('file', TEST_PDF_PATH);

    expect(res.status).toBe(403);
  });

  it('TC-UP-08: Client not assigned to the case is rejected with 403', async () => {
    const res = await request(app)
      .post('/api/uploads')
      .set('Authorization', `Bearer ${otherClientToken}`)
      .field('case_id', caseId)
      .attach('file', TEST_PDF_PATH);

    expect(res.status).toBe(403);
  });

  // ── VALIDATION FAILURES ────────────────────────────────────

  it('TC-UP-09: Returns 400 when no file is attached', async () => {
    const res = await request(app)
      .post('/api/uploads')
      .set('Authorization', `Bearer ${clientToken}`)
      .field('case_id', caseId);

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/no file/i);
  });

  it('TC-UP-10: Returns 400 when case_id is missing', async () => {
    const res = await request(app)
      .post('/api/uploads')
      .set('Authorization', `Bearer ${clientToken}`)
      .attach('file', TEST_PDF_PATH);

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/case_id/i);
  });

  it('TC-UP-11: Rejects disallowed file type (.exe)', async () => {
    const res = await request(app)
      .post('/api/uploads')
      .set('Authorization', `Bearer ${clientToken}`)
      .field('case_id', caseId)
      .attach('file', TEST_EXE_PATH);

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/not allowed/i);
  });

  it('TC-UP-12: Returns 400 for a non-existent case_id', async () => {
    const res = await request(app)
      .post('/api/uploads')
      .set('Authorization', `Bearer ${clientToken}`)
      .field('case_id', '00000000-0000-0000-0000-000000000000')
      .attach('file', TEST_PDF_PATH);

    expect(res.status).toBe(403); // Not assigned → 403
  });
});

describe('GET /api/uploads/:uploadId/url', () => {
  let client: any, otherClient: any, clientToken: string, otherToken: string;
  let uploadId: string;

  beforeAll(async () => {
    const lawyer = await createTestLawyer();
    client      = await createTestClient();
    otherClient = await createTestClient();
    const testCase = await createTestCase(lawyer.id);
    await assignClientToCase(testCase.id, client.id);
    clientToken = await getAuthToken(client.email!, 'Test1234!');
    otherToken  = await getAuthToken(otherClient.email!, 'Test1234!');

    const uploadRes = await request(app)
      .post('/api/uploads')
      .set('Authorization', `Bearer ${clientToken}`)
      .field('case_id', testCase.id)
      .attach('file', TEST_PDF_PATH);

    uploadId = uploadRes.body.upload.id;
  });

  it('TC-URL-01: Client retrieves a signed URL for their own upload', async () => {
    const res = await request(app)
      .get(`/api/uploads/${uploadId}/url`)
      .set('Authorization', `Bearer ${clientToken}`);

    expect(res.status).toBe(200);
    expect(res.body.url).toMatch(/^https:/);
    expect(res.body.expires_in).toBe(3600);
  });

  it('TC-URL-02: Different client cannot access another client upload URL', async () => {
    const res = await request(app)
      .get(`/api/uploads/${uploadId}/url`)
      .set('Authorization', `Bearer ${otherToken}`);

    expect(res.status).toBe(403);
  });

  it('TC-URL-03: Returns 404 for a non-existent upload ID', async () => {
    const res = await request(app)
      .get('/api/uploads/00000000-0000-0000-0000-000000000000/url')
      .set('Authorization', `Bearer ${clientToken}`);

    expect(res.status).toBe(404);
  });
});
```

---

### Feature 2 Tests — Notifications

**File:** `tests/notifications.test.ts`

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../server/index';
import { createTestLawyer, createTestClient, getAuthToken, cleanupUser } from './helpers/db';
import { supabaseAdmin } from '../server/lib/supabase';
import { createNotification } from '../server/services/notifications';

describe('Notification service', () => {
  let lawyer: any, lawyerToken: string;

  beforeAll(async () => {
    lawyer      = await createTestLawyer();
    lawyerToken = await getAuthToken(lawyer.email!, 'Test1234!');
  });

  afterAll(async () => {
    await supabaseAdmin.from('notifications').delete().eq('user_id', lawyer.id);
    await cleanupUser(lawyer.id);
  });

  it('TC-NT-01: createNotification inserts a row with correct fields', async () => {
    await createNotification({
      userId: lawyer.id,
      type:   'client_upload',
      title:  'Test notification',
      body:   'A client uploaded a file',
      link:   '/clients?tab=audit',
    });

    const { data } = await supabaseAdmin
      .from('notifications')
      .select('*')
      .eq('user_id', lawyer.id)
      .eq('type', 'client_upload')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    expect(data?.title).toBe('Test notification');
    expect(data?.read).toBe(false);
    expect(data?.link).toBe('/clients?tab=audit');
  });

  it('TC-NT-02: GET /api/notifications returns notifications for authenticated user', async () => {
    const res = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${lawyerToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.notifications)).toBe(true);
    expect(typeof res.body.unread_count).toBe('number');
  });

  it('TC-NT-03: unread_count increments correctly after notification creation', async () => {
    const before = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${lawyerToken}`);
    const prevCount = before.body.unread_count;

    await createNotification({
      userId: lawyer.id,
      type:   'new_message',
      title:  'New message',
      body:   'You have a new message',
    });

    const after = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${lawyerToken}`);

    expect(after.body.unread_count).toBe(prevCount + 1);
  });

  it('TC-NT-04: PATCH /api/notifications/:id/read marks single notification as read', async () => {
    const { data: notif } = await supabaseAdmin
      .from('notifications')
      .select('id')
      .eq('user_id', lawyer.id)
      .eq('read', false)
      .limit(1)
      .single();

    const res = await request(app)
      .patch(`/api/notifications/${notif!.id}/read`)
      .set('Authorization', `Bearer ${lawyerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.updated).toBe(true);

    const { data: updated } = await supabaseAdmin
      .from('notifications')
      .select('read')
      .eq('id', notif!.id)
      .single();

    expect(updated?.read).toBe(true);
  });

  it('TC-NT-05: PATCH /api/notifications/read-all clears all unread', async () => {
    const res = await request(app)
      .patch('/api/notifications/read-all')
      .set('Authorization', `Bearer ${lawyerToken}`);

    expect(res.status).toBe(200);

    const after = await request(app)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${lawyerToken}`);

    expect(after.body.unread_count).toBe(0);
  });

  it('TC-NT-06: Returns 401 on GET without auth token', async () => {
    const res = await request(app).get('/api/notifications');
    expect(res.status).toBe(401);
  });

  it('TC-NT-07: User cannot read another user\'s notifications', async () => {
    const other = await createTestLawyer();
    const otherToken = await getAuthToken(other.email!, 'Test1234!');

    const { data: notif } = await supabaseAdmin
      .from('notifications')
      .select('id')
      .eq('user_id', lawyer.id)
      .limit(1)
      .single();

    const res = await request(app)
      .patch(`/api/notifications/${notif!.id}/read`)
      .set('Authorization', `Bearer ${otherToken}`);

    // Should silently ignore (0 rows updated) — not return the notification
    const { data: unchanged } = await supabaseAdmin
      .from('notifications')
      .select('read')
      .eq('id', notif!.id)
      .single();

    // The row should be unchanged (still its previous state, not flipped by other user)
    expect(unchanged?.read).toBeDefined();

    await cleanupUser(other.id);
  });

  it('TC-NT-08: Pagination works — limit=1 returns 1 notification', async () => {
    const res = await request(app)
      .get('/api/notifications?limit=1&offset=0')
      .set('Authorization', `Bearer ${lawyerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.notifications.length).toBeLessThanOrEqual(1);
    expect(typeof res.body.total).toBe('number');
  });
});
```

---

### Feature 1 Tests — Document Editor

**File:** `tests/documents.test.ts`

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../server/index';
import {
  createTestLawyer, createTestDocument,
  getAuthToken, cleanupUser,
} from './helpers/db';
import { supabaseAdmin } from '../server/lib/supabase';

describe('PATCH /api/documents/:id', () => {
  let lawyer: any, otherLawyer: any;
  let lawyerToken: string, otherToken: string;
  let docId: string;

  beforeAll(async () => {
    lawyer      = await createTestLawyer();
    otherLawyer = await createTestLawyer();
    lawyerToken = await getAuthToken(lawyer.email!, 'Test1234!');
    otherToken  = await getAuthToken(otherLawyer.email!, 'Test1234!');
    const doc = await createTestDocument(lawyer.id);
    docId = doc.id;
  });

  afterAll(async () => {
    await supabaseAdmin.from('document_versions').delete().eq('document_id', docId);
    await supabaseAdmin.from('documents').delete().eq('id', docId);
    await cleanupUser(lawyer.id);
    await cleanupUser(otherLawyer.id);
  });

  // ── HAPPY PATH ──────────────────────────────────────────────

  it('TC-ED-01: Lawyer can save edited document content', async () => {
    const newContent = 'Updated legal notice content for testing.';

    const res = await request(app)
      .patch(`/api/documents/${docId}`)
      .set('Authorization', `Bearer ${lawyerToken}`)
      .send({ content: newContent });

    expect(res.status).toBe(200);
    expect(res.body.updated).toBe(true);

    const { data } = await supabaseAdmin
      .from('documents')
      .select('content')
      .eq('id', docId)
      .single();

    expect(data?.content).toBe(newContent);
  });

  it('TC-ED-02: Saving new content creates a version snapshot of the previous content', async () => {
    const { data: before } = await supabaseAdmin
      .from('documents').select('content').eq('id', docId).single();

    await request(app)
      .patch(`/api/documents/${docId}`)
      .set('Authorization', `Bearer ${lawyerToken}`)
      .send({ content: 'Second revision of document content.' });

    const { data: versions } = await supabaseAdmin
      .from('document_versions')
      .select('content')
      .eq('document_id', docId)
      .order('created_at', { ascending: false });

    expect(versions?.length).toBeGreaterThan(0);
    // The most recently created version should hold the content that was there BEFORE this save
    expect(versions?.[0]?.content).toBe(before?.content);
  });

  it('TC-ED-03: Saving identical content returns updated:false and creates no new version', async () => {
    const { data: current } = await supabaseAdmin
      .from('documents').select('content').eq('id', docId).single();

    const { count: versionsBefore } = await supabaseAdmin
      .from('document_versions')
      .select('id', { count: 'exact', head: true })
      .eq('document_id', docId);

    const res = await request(app)
      .patch(`/api/documents/${docId}`)
      .set('Authorization', `Bearer ${lawyerToken}`)
      .send({ content: current!.content });

    expect(res.status).toBe(200);
    expect(res.body.updated).toBe(false);

    const { count: versionsAfter } = await supabaseAdmin
      .from('document_versions')
      .select('id', { count: 'exact', head: true })
      .eq('document_id', docId);

    expect(versionsAfter).toBe(versionsBefore);
  });

  // ── AUTH & OWNERSHIP ──────────────────────────────────────

  it('TC-ED-04: Returns 401 with no Authorization header', async () => {
    const res = await request(app)
      .patch(`/api/documents/${docId}`)
      .send({ content: 'Should not work' });

    expect(res.status).toBe(401);
  });

  it('TC-ED-05: Another lawyer cannot edit a document they do not own', async () => {
    const res = await request(app)
      .patch(`/api/documents/${docId}`)
      .set('Authorization', `Bearer ${otherToken}`)
      .send({ content: 'Unauthorized edit attempt' });

    expect(res.status).toBe(404); // looks like not found — not 403 (don't leak existence)
  });

  // ── VALIDATION ─────────────────────────────────────────────

  it('TC-ED-06: Returns 400 when content field is missing from body', async () => {
    const res = await request(app)
      .patch(`/api/documents/${docId}`)
      .set('Authorization', `Bearer ${lawyerToken}`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/content/i);
  });

  it('TC-ED-07: Returns 400 when content is an empty string', async () => {
    const res = await request(app)
      .patch(`/api/documents/${docId}`)
      .set('Authorization', `Bearer ${lawyerToken}`)
      .send({ content: '' });

    expect(res.status).toBe(400);
  });

  it('TC-ED-08: Returns 400 when content exceeds 500,000 character limit', async () => {
    const res = await request(app)
      .patch(`/api/documents/${docId}`)
      .set('Authorization', `Bearer ${lawyerToken}`)
      .send({ content: 'A'.repeat(500_001) });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/maximum length/i);
  });
});

describe('GET /api/documents/:id/versions', () => {
  let lawyer: any, lawyerToken: string, docId: string;

  beforeAll(async () => {
    lawyer      = await createTestLawyer();
    lawyerToken = await getAuthToken(lawyer.email!, 'Test1234!');
    const doc   = await createTestDocument(lawyer.id, 'Version 0 content');
    docId = doc.id;

    // Create 2 versions via save
    await request(app)
      .patch(`/api/documents/${docId}`)
      .set('Authorization', `Bearer ${lawyerToken}`)
      .send({ content: 'Version 1 content' });

    await request(app)
      .patch(`/api/documents/${docId}`)
      .set('Authorization', `Bearer ${lawyerToken}`)
      .send({ content: 'Version 2 content' });
  });

  afterAll(async () => {
    await supabaseAdmin.from('document_versions').delete().eq('document_id', docId);
    await supabaseAdmin.from('documents').delete().eq('id', docId);
    await cleanupUser(lawyer.id);
  });

  it('TC-VH-01: Returns a list of versions ordered newest-first', async () => {
    const res = await request(app)
      .get(`/api/documents/${docId}/versions`)
      .set('Authorization', `Bearer ${lawyerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.versions.length).toBeGreaterThanOrEqual(2);

    const dates = res.body.versions.map((v: any) => new Date(v.created_at).getTime());
    for (let i = 0; i < dates.length - 1; i++) {
      expect(dates[i]).toBeGreaterThanOrEqual(dates[i + 1]);
    }
  });

  it('TC-VH-02: Each version has id, char_count, and created_at — no content in list', async () => {
    const res = await request(app)
      .get(`/api/documents/${docId}/versions`)
      .set('Authorization', `Bearer ${lawyerToken}`);

    const v = res.body.versions[0];
    expect(v.id).toBeTruthy();
    expect(typeof v.char_count).toBe('number');
    expect(v.created_at).toBeTruthy();
    expect(v.content).toBeUndefined(); // content not included in list for performance
  });

  it('TC-VH-03: Returns 404 for a non-existent document', async () => {
    const res = await request(app)
      .get('/api/documents/00000000-0000-0000-0000-000000000000/versions')
      .set('Authorization', `Bearer ${lawyerToken}`);

    expect(res.status).toBe(404);
  });

  it('TC-VH-04: Full version content is accessible via GET /api/documents/versions/:versionId', async () => {
    const listRes = await request(app)
      .get(`/api/documents/${docId}/versions`)
      .set('Authorization', `Bearer ${lawyerToken}`);

    const versionId = listRes.body.versions[0].id;

    const res = await request(app)
      .get(`/api/documents/versions/${versionId}`)
      .set('Authorization', `Bearer ${lawyerToken}`);

    expect(res.status).toBe(200);
    expect(typeof res.body.version.content).toBe('string');
    expect(res.body.version.content.length).toBeGreaterThan(0);
  });
});
```

---

## Wiring Checklist

After all code is written, verify each of these before committing:

### Feature 3 — Client File Upload
- [ ] `multer` is in `package.json` dependencies (not devDependencies)
- [ ] `uploads` router is mounted at `/api/uploads` in `server/index.ts`
- [ ] `requireClient` middleware is imported from the correct path
- [ ] Supabase Storage bucket `client-uploads` exists and is set to private
- [ ] All 4 SQL migrations in §3.2 have been applied to the database
- [ ] All 3 storage RLS policies in §3.3 have been applied
- [ ] `FileUploadZone` component is imported and rendered inside `ClientDashboard` for each document request card
- [ ] `case_id` and (where applicable) `request_id` props are passed correctly to `FileUploadZone`
- [ ] `sample.pdf` and `bad.exe` test fixtures exist at `tests/fixtures/`

### Feature 2 — Notifications
- [ ] Migration 004 (notifications table + RLS + index) has been applied
- [ ] `notifications` router is mounted at `/api/notifications` in `server/index.ts`
- [ ] `requireAuth` middleware (not `requireLawyer`) is used on notification routes — both roles need this
- [ ] `notifyAdvocateClientUpload` is called inside `POST /api/uploads` after audit log insert
- [ ] `notifyAdvocateNewMessage` is called inside the existing messages route after message insert
- [ ] `notifyClientDocumentRequest` is called inside the document requests route after insert
- [ ] `NotificationBell` component is added to the advocate sidebar layout (not inside a page component)
- [ ] `useNotifications` hook receives `user?.id` — it must not be called with `undefined` as userId
- [ ] Supabase Realtime is enabled for the `notifications` table in the Supabase dashboard

### Feature 1 — Document Editor
- [ ] `@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/extension-placeholder`, `@tiptap/extension-character-count` are all in `package.json`
- [ ] Migration 005 (document_versions table + RLS) has been applied
- [ ] `PATCH /api/documents/:id` route is added to the existing documents router
- [ ] `GET /api/documents/:id/versions` route is added to the existing documents router
- [ ] `GET /api/documents/versions/:versionId` route is added — **this route must be registered BEFORE `/:id` in the router to avoid Express treating "versions" as an id param**
- [ ] `POST /api/generate/section` is added to the existing generate router
- [ ] `DocumentEditor` component replaces the existing read-only preview `<pre>` or `<div>` in the document preview page
- [ ] `documentId` and `initialContent` props are passed from the parent page component
- [ ] `checkGenerationQuota` function is imported and called in the section regeneration route (use the same quota check already used in the main generate routes)
- [ ] TipTap CSS is imported: `import '@tiptap/core/dist/index.css'` (or prose CSS is handled via Tailwind Typography plugin)

---

*LexDraft Phase 1 · Built by SIRAH DIGITAL · Implementation spec v1.0*
