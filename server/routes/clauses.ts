import { Router } from 'express'
import { z } from 'zod'
import { supabase } from '../lib/supabase.js'
import { requireAuth, requireLawyer } from '../middleware/auth.js'
import type { AuthRequest } from '../middleware/auth.js'

export const clausesRouter = Router()

clausesRouter.use(requireAuth, requireLawyer)

const clauseSchema = z.object({
  title: z.string().min(1).max(500),
  content: z.string().min(1),
  category: z.string().max(100).optional(),
  tags: z.array(z.string()).optional(),
})

const updateClauseSchema = clauseSchema.partial()

// GET /api/clauses?search=&category=
clausesRouter.get('/', async (req, res, next) => {
  try {
    const { userId } = req as unknown as AuthRequest
    const { search, category } = req.query as Record<string, string | undefined>

    let query = supabase
      .from('clause_library')
      .select('*')
      .eq('lawyer_id', userId)
      .order('created_at', { ascending: false })

    if (category) query = query.eq('category', category)
    if (search) query = query.ilike('title', `%${search}%`)

    const { data, error } = await query
    if (error) throw error
    res.json(data ?? [])
  } catch (err) {
    next(err)
  }
})

// POST /api/clauses
clausesRouter.post('/', async (req, res, next) => {
  try {
    const { userId } = req as unknown as AuthRequest
    const body = clauseSchema.parse(req.body)

    const { data, error } = await supabase
      .from('clause_library')
      .insert({ ...body, lawyer_id: userId })
      .select()
      .single()

    if (error) throw error
    res.status(201).json(data)
  } catch (err) {
    next(err)
  }
})

// PATCH /api/clauses/:id
clausesRouter.patch('/:id', async (req, res, next) => {
  try {
    const { userId } = req as unknown as AuthRequest
    const { id } = req.params
    const body = updateClauseSchema.parse(req.body)

    const { data, error } = await supabase
      .from('clause_library')
      .update(body)
      .eq('id', id)
      .eq('lawyer_id', userId)
      .select()
      .single()

    if (error) throw error
    if (!data) { res.status(404).json({ error: 'Clause not found' }); return }
    res.json(data)
  } catch (err) {
    next(err)
  }
})

// DELETE /api/clauses/:id
clausesRouter.delete('/:id', async (req, res, next) => {
  try {
    const { userId } = req as unknown as AuthRequest
    const { id } = req.params

    const { error } = await supabase
      .from('clause_library')
      .delete()
      .eq('id', id)
      .eq('lawyer_id', userId)

    if (error) throw error
    res.json({ success: true })
  } catch (err) {
    next(err)
  }
})
