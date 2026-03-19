import { Router } from 'express'
import { z } from 'zod'
import { supabase } from '../lib/supabase.js'
import { requireAuth, requireLawyer, requireClient } from '../middleware/auth.js'
import type { AuthRequest } from '../middleware/auth.js'

export const documentRequestsRouter = Router()

documentRequestsRouter.use(requireAuth)

const createRequestSchema = z.object({
  case_id: z.string().uuid(),
  client_id: z.string().uuid(),
  title: z.string().min(1).max(500),
  description: z.string().optional(),
})

const updateRequestSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().optional(),
  status: z.enum(['pending', 'fulfilled', 'cancelled']).optional(),
})

// GET /api/document-requests?caseId=... — lawyer views requests
documentRequestsRouter.get('/', requireLawyer, async (req, res, next) => {
  try {
    const { userId } = req as unknown as AuthRequest
    const caseId = req.query.caseId as string | undefined

    let query = supabase
      .from('document_requests')
      .select('*, client:profiles!client_id(id, full_name)')
      .eq('lawyer_id', userId)
      .order('created_at', { ascending: false })

    if (caseId) query = query.eq('case_id', caseId)

    const { data, error } = await query
    if (error) throw error
    res.json(data ?? [])
  } catch (err) {
    next(err)
  }
})

// POST /api/document-requests — lawyer creates request
documentRequestsRouter.post('/', requireLawyer, async (req, res, next) => {
  try {
    const { userId } = req as unknown as AuthRequest
    const body = createRequestSchema.parse(req.body)

    // Verify lawyer owns the case
    const { data: caseRow } = await supabase
      .from('cases')
      .select('id')
      .eq('id', body.case_id)
      .eq('lawyer_id', userId)
      .single()

    if (!caseRow) { res.status(404).json({ error: 'Case not found' }); return }

    const { data, error } = await supabase
      .from('document_requests')
      .insert({ ...body, lawyer_id: userId })
      .select()
      .single()

    if (error) throw error
    res.status(201).json(data)
  } catch (err) {
    next(err)
  }
})

// PATCH /api/document-requests/:id — lawyer updates/cancels
documentRequestsRouter.patch('/:id', requireLawyer, async (req, res, next) => {
  try {
    const { userId } = req as unknown as AuthRequest
    const { id } = req.params
    const body = updateRequestSchema.parse(req.body)

    const { data, error } = await supabase
      .from('document_requests')
      .update(body)
      .eq('id', id)
      .eq('lawyer_id', userId)
      .select()
      .single()

    if (error) throw error
    if (!data) { res.status(404).json({ error: 'Request not found' }); return }
    res.json(data)
  } catch (err) {
    next(err)
  }
})

// GET /api/document-requests/client — client views their pending requests
documentRequestsRouter.get('/client', requireClient, async (req, res, next) => {
  try {
    const { userId } = req as unknown as AuthRequest

    const { data, error } = await supabase
      .from('document_requests')
      .select('*, case:cases!case_id(id, title)')
      .eq('client_id', userId)
      .order('created_at', { ascending: false })

    if (error) throw error
    res.json(data ?? [])
  } catch (err) {
    next(err)
  }
})

// PATCH /api/document-requests/client/:id/fulfil — client marks as fulfilled
documentRequestsRouter.patch('/client/:id/fulfil', requireClient, async (req, res, next) => {
  try {
    const { userId } = req as unknown as AuthRequest
    const { id } = req.params

    const { data, error } = await supabase
      .from('document_requests')
      .update({ status: 'fulfilled', fulfilled_at: new Date().toISOString() })
      .eq('id', id)
      .eq('client_id', userId)
      .select()
      .single()

    if (error) throw error
    if (!data) { res.status(404).json({ error: 'Request not found' }); return }
    res.json(data)
  } catch (err) {
    next(err)
  }
})
