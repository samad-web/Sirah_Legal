import { Router } from 'express'
import type { Request, Response } from 'express'
import { z } from 'zod'
import { requireAuth } from '../middleware/auth.js'
import type { AuthRequest } from '../middleware/auth.js'
import { enforceQuota } from '../middleware/quota.js'
import { supabase } from '../lib/supabase.js'

// ─── Schemas ──────────────────────────────────────────────────────────────────

const documentCreateSchema = z.object({
  title: z.string().min(1, 'Title is required').max(500),
  type: z.enum(['notice', 'contract', 'title-report', 'contract-review']),
  language: z.enum(['en', 'ta', 'hi']),
  content: z.string().max(500_000, 'Document content exceeds maximum allowed size'),
  analysis: z.record(z.string(), z.unknown()).nullable().optional(),
  status: z.enum(['draft', 'exported', 'shared']).optional().default('draft'),
})

const documentUpdateSchema = documentCreateSchema.partial()

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  search: z.string().max(200).optional(),
})

export const documentsRouter = Router()

documentsRouter.use(requireAuth)

// GET /api/documents?page=1&limit=20
documentsRouter.get('/', async (req: Request, res: Response): Promise<void> => {
  const userId = (req as AuthRequest).userId

  const pageResult = paginationSchema.safeParse(req.query)
  if (!pageResult.success) {
    res.status(400).json({ error: 'Invalid pagination params' })
    return
  }
  const { page, limit, search } = pageResult.data
  const offset = (page - 1) * limit

  let query = supabase
    .from('documents')
    .select('*', { count: 'exact' })
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (search) {
    query = query.textSearch('search_vector', search, { type: 'websearch' })
  }

  const { data, error, count } = await query

  if (error) {
    res.status(500).json({ error: error.message })
    return
  }

  res.json({ data: data ?? [], total: count ?? 0, page, limit })
})

// POST /api/documents
documentsRouter.post('/', enforceQuota, async (req: Request, res: Response): Promise<void> => {
  const userId = (req as AuthRequest).userId

  const parsed = documentCreateSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues.map(i => i.message).join('; ') })
    return
  }

  const { data, error } = await supabase
    .from('documents')
    .insert({ ...parsed.data, user_id: userId })
    .select()
    .single()

  if (error) {
    res.status(500).json({ error: error.message })
    return
  }

  res.status(201).json(data)
})

// PATCH /api/documents/:id
documentsRouter.patch('/:id', async (req: Request, res: Response): Promise<void> => {
  const userId = (req as AuthRequest).userId
  const { id } = req.params

  const parsed = documentUpdateSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues.map(i => i.message).join('; ') })
    return
  }

  const { data, error } = await supabase
    .from('documents')
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
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

// DELETE /api/documents/:id
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
