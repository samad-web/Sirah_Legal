import { Router } from 'express'
import type { Request, Response } from 'express'
import { z } from 'zod'
import multer from 'multer'
import { requireAuth } from '../middleware/auth.js'
import type { AuthRequest } from '../middleware/auth.js'
import { supabase } from '../lib/supabase.js'

const STORAGE_BUCKET = 'advocate-files'
const ALLOWED_MIME: Record<string, string[]> = {
  letterhead: ['image/png', 'image/jpeg', 'application/pdf'],
  signature:  ['image/png', 'image/jpeg'],
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
})

// ─── Schema ───────────────────────────────────────────────────────────────────

const profileUpdateSchema = z.object({
  full_name: z.string().max(255).nullable().optional(),
  bar_council_no: z.string().max(100).nullable().optional(),
  state_bar: z.string().max(100).nullable().optional(),
  firm_name: z.string().max(255).nullable().optional(),
  office_address: z.string().max(1000).nullable().optional(),
  default_language: z.enum(['en', 'ta', 'hi']).optional(),
  default_state: z.string().max(100).nullable().optional(),
  default_dispute: z.string().max(50).nullable().optional(),
  letterhead_url: z.url().nullable().optional(),
  signature_url: z.url().nullable().optional(),
  email_notifications: z.boolean().optional(),
})

export const profilesRouter = Router()

profilesRouter.use(requireAuth)

// GET /api/profiles/me
// Note: requireAuth middleware already guarantees a profile row exists,
// so PGRST116 (no rows) should not occur in normal operation.
profilesRouter.get('/me', async (req: Request, res: Response): Promise<void> => {
  const userId = (req as AuthRequest).userId

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()

  if (error) {
    res.status(404).json({ error: error.message })
    return
  }

  res.json(data)
})

// PATCH /api/profiles/me
profilesRouter.patch('/me', async (req: Request, res: Response): Promise<void> => {
  const userId = (req as AuthRequest).userId

  const parsed = profileUpdateSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues.map(i => i.message).join('; ') })
    return
  }

  const { data, error } = await supabase
    .from('profiles')
    .upsert({ ...parsed.data, id: userId })
    .select()
    .single()

  if (error) {
    res.status(500).json({ error: error.message })
    return
  }

  res.json(data)
})

// POST /api/profiles/upload-file
// Handles letterhead / signature uploads server-side using the service-role key,
// bypassing frontend RLS entirely.
profilesRouter.post(
  '/upload-file',
  upload.single('file'),
  async (req: Request, res: Response): Promise<void> => {
    const userId = (req as AuthRequest).userId
    const slot = req.body?.slot as string

    if (!req.file) { res.status(400).json({ error: 'No file uploaded' }); return }
    if (slot !== 'letterhead' && slot !== 'signature') {
      res.status(400).json({ error: 'slot must be letterhead or signature' }); return
    }
    if (!ALLOWED_MIME[slot].includes(req.file.mimetype)) {
      res.status(400).json({ error: `Invalid file type for ${slot}` }); return
    }

    const ext = (req.file.originalname.split('.').pop() ?? 'bin').toLowerCase()
    const path = `${userId}/${slot}.${ext}`

    const { error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(path, req.file.buffer, { contentType: req.file.mimetype, upsert: true })

    if (error) { res.status(500).json({ error: error.message }); return }

    const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path)
    res.json({ url: `${data.publicUrl}?t=${Date.now()}` })
  },
)

// POST /api/profiles/increment-count
profilesRouter.post('/increment-count', async (req: Request, res: Response): Promise<void> => {
  const userId = (req as AuthRequest).userId

  try {
    const { error } = await supabase.rpc('increment_document_count', { uid: userId })
    if (error) throw error
    res.json({ success: true })
  } catch {
    // Fall back to a read-modify-write if the RPC doesn't exist
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('documents_this_month')
        .eq('id', userId)
        .single()

      if (profile) {
        await supabase
          .from('profiles')
          .update({ documents_this_month: (profile.documents_this_month ?? 0) + 1 })
          .eq('id', userId)
      }
      res.json({ success: true })
    } catch {
      res.json({ success: false })
    }
  }
})
