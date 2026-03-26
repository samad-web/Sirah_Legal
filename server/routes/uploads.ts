import { Router } from 'express'
import type { Response } from 'express'
import multer from 'multer'
import path from 'path'
import { requireAuth, requireClient } from '../middleware/auth.js'
import type { AuthRequest } from '../middleware/auth.js'
import { supabase } from '../lib/supabase.js'
import { notifyAdvocateClientUpload } from '../services/notifications.js'

export const uploadsRouter = Router()

uploadsRouter.use(requireAuth)

// Multer: memory storage, 10 MB limit, strict MIME check
const ALLOWED_MIMES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg',
  'image/png',
  'image/webp',
])

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIMES.has(file.mimetype)) {
      return cb(new Error(`File type not allowed: ${file.mimetype}`))
    }
    cb(null, true)
  },
})

// POST /api/uploads
// Body: multipart/form-data with fields: file, case_id, request_id (optional)
uploadsRouter.post(
  '/',
  requireClient,
  upload.single('file'),
  async (req, res: Response): Promise<void> => {
    try {
      const clientId = (req as unknown as AuthRequest).userId

      if (!req.file) {
        res.status(400).json({ error: 'No file provided' })
        return
      }

      const { case_id, request_id } = req.body as {
        case_id?: string
        request_id?: string
      }

      if (!case_id) {
        res.status(400).json({ error: 'case_id is required' })
        return
      }

      // Verify client is assigned to this case
      const { data: assignment, error: assignError } = await supabase
        .from('case_assignments')
        .select('case_id')
        .eq('case_id', case_id)
        .eq('client_id', clientId)
        .maybeSingle()

      if (assignError || !assignment) {
        res.status(403).json({ error: 'Not assigned to this case' })
        return
      }

      // Sanitise filename
      const ext = path.extname(req.file.originalname).toLowerCase()
      const safeBasename = path.basename(req.file.originalname, ext)
        .replace(/[^a-zA-Z0-9_\-]/g, '_')
        .slice(0, 80)
      const timestamp = Date.now()
      const storagePath = `uploads/${case_id}/${clientId}/${timestamp}_${safeBasename}${ext}`

      // Upload to Supabase Storage
      const { error: storageError } = await supabase.storage
        .from('client-uploads')
        .upload(storagePath, req.file.buffer, {
          contentType: req.file.mimetype,
          upsert: false,
        })

      if (storageError) {
        console.error('[uploads] Storage upload failed:', storageError)
        res.status(500).json({ error: 'File storage failed' })
        return
      }

      // Insert record
      const { data: uploadRecord, error: dbError } = await supabase
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
        .single()

      if (dbError || !uploadRecord) {
        // Roll back storage
        await supabase.storage.from('client-uploads').remove([storagePath])
        console.error('[uploads] DB insert failed:', dbError?.message)
        res.status(500).json({ error: 'Database insert failed' })
        return
      }

      // Fulfil the document request if request_id provided
      if (request_id) {
        await supabase
          .from('document_requests')
          .update({
            status: 'fulfilled',
            fulfilled_at: new Date().toISOString(),
            upload_id: uploadRecord.id,
          })
          .eq('id', request_id)
          .eq('case_id', case_id)
      }

      // Audit log
      await supabase.from('audit_logs').insert({
        user_id: clientId,
        document_id: uploadRecord.id,
        action: 'upload',
      })

      // Notify advocate (fire-and-forget)
      const { data: caseData } = await supabase
        .from('cases')
        .select('title, lawyer_id')
        .eq('id', case_id)
        .single()

      const { data: clientProfile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', clientId)
        .maybeSingle()

      if (caseData) {
        notifyAdvocateClientUpload(
          caseData.lawyer_id,
          clientProfile?.full_name ?? 'Your client',
          caseData.title,
          case_id,
          uploadRecord.file_name,
        ).catch(() => {/* non-critical */})
      }

      res.status(201).json({ upload: uploadRecord })
    } catch (err) {
      console.error('[uploads] POST / unexpected error:', err)
      res.status(500).json({ error: 'Upload failed' })
    }
  },
)

// GET /api/uploads/:uploadId/url — generate a signed URL (1 hour expiry)
uploadsRouter.get('/:uploadId/url', requireClient, async (req, res: Response): Promise<void> => {
  try {
    const clientId = (req as unknown as AuthRequest).userId
    const { uploadId } = req.params

    const { data: uploadRow, error } = await supabase
      .from('client_uploads')
      .select('storage_path, client_id')
      .eq('id', uploadId)
      .maybeSingle()

    if (error || !uploadRow) {
      res.status(404).json({ error: 'Upload not found' })
      return
    }

    if (uploadRow.client_id !== clientId) {
      res.status(403).json({ error: 'Access denied' })
      return
    }

    const { data: signedUrl, error: urlError } = await supabase.storage
      .from('client-uploads')
      .createSignedUrl(uploadRow.storage_path, 3600)

    if (urlError || !signedUrl) {
      res.status(500).json({ error: 'Could not generate download URL' })
      return
    }

    res.json({ url: signedUrl.signedUrl, expires_in: 3600 })
  } catch (err) {
    console.error('[uploads] GET /:uploadId/url error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// GET /api/uploads/case/:caseId — get uploads for a case (lawyer or assigned client)
uploadsRouter.get('/case/:caseId', async (req, res: Response): Promise<void> => {
  try {
    const userId = (req as unknown as AuthRequest).userId
    const { caseId } = req.params

    // Verify user is either the lawyer or an assigned client
    const { data: caseRow } = await supabase
      .from('cases')
      .select('id, lawyer_id')
      .eq('id', caseId)
      .single()

    if (!caseRow) {
      res.status(404).json({ error: 'Case not found' })
      return
    }

    const isLawyer = caseRow.lawyer_id === userId
    if (!isLawyer) {
      const { data: assignment } = await supabase
        .from('case_assignments')
        .select('case_id')
        .eq('case_id', caseId)
        .eq('client_id', userId)
        .maybeSingle()
      if (!assignment) {
        res.status(403).json({ error: 'Access denied' })
        return
      }
    }

    const { data, error } = await supabase
      .from('client_uploads')
      .select('*, client:profiles!client_id(id, full_name)')
      .eq('case_id', caseId)
      .order('uploaded_at', { ascending: false })

    if (error) {
      console.error('[uploads] GET /case/:caseId error:', error.message)
      res.status(500).json({ error: 'Failed to fetch uploads' })
      return
    }

    res.json(data ?? [])
  } catch (err) {
    console.error('[uploads] GET /case/:caseId unexpected error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// DELETE /api/uploads/:uploadId
uploadsRouter.delete('/:uploadId', requireClient, async (req, res: Response): Promise<void> => {
  try {
    const clientId = (req as unknown as AuthRequest).userId
    const { uploadId } = req.params

    const { data: uploadRow, error } = await supabase
      .from('client_uploads')
      .select('storage_path, client_id')
      .eq('id', uploadId)
      .maybeSingle()

    if (error || !uploadRow) {
      res.status(404).json({ error: 'Upload not found' })
      return
    }

    if (uploadRow.client_id !== clientId) {
      res.status(403).json({ error: 'Access denied' })
      return
    }

    await supabase.storage.from('client-uploads').remove([uploadRow.storage_path])
    await supabase.from('client_uploads').delete().eq('id', uploadId)

    res.json({ deleted: true })
  } catch (err) {
    console.error('[uploads] DELETE /:uploadId error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})
