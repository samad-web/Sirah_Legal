import { Router } from 'express'
import type { Request, Response } from 'express'
import { requireAuth, type AuthRequest } from '../middleware/auth.js'
import { supabase } from '../lib/supabase.js'

export const profilesRouter = Router()

profilesRouter.use(requireAuth)

// GET /api/profiles/me
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
  // Strip id from body — always use the one from the JWT
  const { id: _ignored, ...updates } = req.body

  const { data, error } = await supabase
    .from('profiles')
    .upsert({ ...updates, id: userId })
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
