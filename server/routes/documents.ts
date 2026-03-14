import { Router } from 'express'
import type { Request, Response } from 'express'
import { requireAuth, type AuthRequest } from '../middleware/auth.js'
import { supabase } from '../lib/supabase.js'

export const documentsRouter = Router()

documentsRouter.use(requireAuth)

// GET /api/documents — fetch all documents for the authenticated user
documentsRouter.get('/', async (req: Request, res: Response): Promise<void> => {
  const userId = (req as AuthRequest).userId

  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) {
    res.status(500).json({ error: error.message })
    return
  }

  res.json(data ?? [])
})

// POST /api/documents — create a new document
documentsRouter.post('/', async (req: Request, res: Response): Promise<void> => {
  const userId = (req as AuthRequest).userId
  // Strip any user_id from the body — always use the one from the JWT
  const { user_id: _ignored, ...rest } = req.body

  const { data, error } = await supabase
    .from('documents')
    .insert({ ...rest, user_id: userId })
    .select()
    .single()

  if (error) {
    res.status(500).json({ error: error.message })
    return
  }

  res.status(201).json(data)
})

// PATCH /api/documents/:id — update a document
documentsRouter.patch('/:id', async (req: Request, res: Response): Promise<void> => {
  const userId = (req as AuthRequest).userId
  const { id } = req.params

  const { data, error } = await supabase
    .from('documents')
    .update({ ...req.body, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .single()

  if (error) {
    res.status(500).json({ error: error.message })
    return
  }

  res.json(data)
})

// DELETE /api/documents/:id — delete a document
documentsRouter.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  const userId = (req as AuthRequest).userId
  const { id } = req.params

  const { error } = await supabase
    .from('documents')
    .delete()
    .eq('id', id)
    .eq('user_id', userId)

  if (error) {
    res.status(500).json({ error: error.message })
    return
  }

  res.json({ success: true })
})
