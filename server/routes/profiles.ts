import { Router } from 'express'
import type { Request, Response } from 'express'
import { z } from 'zod'
import { requireAuth } from '../middleware/auth.js'
import type { AuthRequest } from '../middleware/auth.js'
import { supabase } from '../lib/supabase.js'

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
  letterhead_url: z.string().url().nullable().optional(),
  signature_url: z.string().url().nullable().optional(),
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
