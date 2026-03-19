import { Router } from 'express'
import { z } from 'zod'
import { supabase } from '../lib/supabase.js'
import { requireAuth, requireLawyer } from '../middleware/auth.js'
import type { AuthRequest } from '../middleware/auth.js'

export const casesRouter = Router()

// All case routes require auth + lawyer role
casesRouter.use(requireAuth, requireLawyer)

// ─── Schemas ─────────────────────────────────────────────────────────────────

const createTimelineEventSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().optional(),
  event_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
  event_type: z.enum(['hearing', 'filing', 'order', 'milestone', 'payment', 'notice']).default('milestone'),
})

const updateTimelineEventSchema = createTimelineEventSchema.partial()

const createCaseSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().optional(),
  status: z.enum(['active', 'closed', 'archived']).optional().default('active'),
})

const updateCaseSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  status: z.enum(['active', 'closed', 'archived']).optional(),
})

// ─── GET /api/cases ───────────────────────────────────────────────────────────

casesRouter.get('/', async (req, res, next) => {
  try {
    const { userId } = req as unknown as AuthRequest
    const { data, error } = await supabase
      .from('cases')
      .select('*')
      .eq('lawyer_id', userId)
      .order('created_at', { ascending: false })

    if (error) throw error
    res.json(data ?? [])
  } catch (err) {
    next(err)
  }
})

// ─── POST /api/cases ──────────────────────────────────────────────────────────

casesRouter.post('/', async (req, res, next) => {
  try {
    const { userId } = req as unknown as AuthRequest
    const body = createCaseSchema.parse(req.body)

    const { data, error } = await supabase
      .from('cases')
      .insert({ ...body, lawyer_id: userId })
      .select()
      .single()

    if (error) throw error
    res.status(201).json(data)
  } catch (err) {
    next(err)
  }
})

// ─── PATCH /api/cases/:id ─────────────────────────────────────────────────────

casesRouter.patch('/:id', async (req, res, next) => {
  try {
    const { userId } = req as unknown as AuthRequest
    const { id } = req.params
    const body = updateCaseSchema.parse(req.body)

    // Fetch current status to detect changes
    const { data: currentCase } = await supabase
      .from('cases')
      .select('status')
      .eq('id', id)
      .eq('lawyer_id', userId)
      .single()

    const { data, error } = await supabase
      .from('cases')
      .update(body)
      .eq('id', id)
      .eq('lawyer_id', userId)
      .select()
      .single()

    if (error) throw error
    if (!data) { res.status(404).json({ error: 'Case not found' }); return }

    // Log status change if status changed
    if (body.status && currentCase && body.status !== currentCase.status) {
      await supabase.from('case_status_history').insert({
        case_id: id,
        old_status: currentCase.status,
        new_status: body.status,
        changed_by: userId,
      })
    }

    res.json(data)
  } catch (err) {
    next(err)
  }
})

// ─── DELETE /api/cases/:id ────────────────────────────────────────────────────

casesRouter.delete('/:id', async (req, res, next) => {
  try {
    const { userId } = req as unknown as AuthRequest
    const { id } = req.params

    const { error } = await supabase
      .from('cases')
      .delete()
      .eq('id', id)
      .eq('lawyer_id', userId)

    if (error) throw error
    res.json({ success: true })
  } catch (err) {
    next(err)
  }
})

// ─── GET /api/cases/:id/clients ───────────────────────────────────────────────

casesRouter.get('/:id/clients', async (req, res, next) => {
  try {
    const { userId } = req as unknown as AuthRequest
    const { id } = req.params

    // Verify lawyer owns this case
    const { data: caseRow } = await supabase
      .from('cases')
      .select('id')
      .eq('id', id)
      .eq('lawyer_id', userId)
      .single()

    if (!caseRow) { res.status(404).json({ error: 'Case not found' }); return }

    const { data, error } = await supabase
      .from('case_assignments')
      .select('profiles(*)')
      .eq('case_id', id)

    if (error) throw error
    const profiles = (data ?? []).map((row: Record<string, unknown>) => row.profiles)
    res.json(profiles)
  } catch (err) {
    next(err)
  }
})

// ─── POST /api/cases/:id/clients/:clientId ────────────────────────────────────

casesRouter.post('/:id/clients/:clientId', async (req, res, next) => {
  try {
    const { userId } = req as unknown as AuthRequest
    const { id, clientId } = req.params

    // Verify lawyer owns this case
    const { data: caseRow } = await supabase
      .from('cases')
      .select('id')
      .eq('id', id)
      .eq('lawyer_id', userId)
      .single()

    if (!caseRow) { res.status(404).json({ error: 'Case not found' }); return }

    const { error } = await supabase
      .from('case_assignments')
      .upsert({ case_id: id, client_id: clientId })

    if (error) throw error
    res.status(201).json({ success: true })
  } catch (err) {
    next(err)
  }
})

// ─── DELETE /api/cases/:id/clients/:clientId ──────────────────────────────────

casesRouter.delete('/:id/clients/:clientId', async (req, res, next) => {
  try {
    const { userId } = req as unknown as AuthRequest
    const { id, clientId } = req.params

    // Verify lawyer owns this case
    const { data: caseRow } = await supabase
      .from('cases')
      .select('id')
      .eq('id', id)
      .eq('lawyer_id', userId)
      .single()

    if (!caseRow) { res.status(404).json({ error: 'Case not found' }); return }

    const { error } = await supabase
      .from('case_assignments')
      .delete()
      .eq('case_id', id)
      .eq('client_id', clientId)

    if (error) throw error
    res.json({ success: true })
  } catch (err) {
    next(err)
  }
})

// ─── GET /api/cases/:id/documents ─────────────────────────────────────────────

casesRouter.get('/:id/documents', async (req, res, next) => {
  try {
    const { userId } = req as unknown as AuthRequest
    const { id } = req.params

    // Verify lawyer owns this case
    const { data: caseRow } = await supabase
      .from('cases')
      .select('id')
      .eq('id', id)
      .eq('lawyer_id', userId)
      .single()

    if (!caseRow) { res.status(404).json({ error: 'Case not found' }); return }

    const { data, error } = await supabase
      .from('case_documents')
      .select('document_id')
      .eq('case_id', id)

    if (error) throw error
    res.json((data ?? []).map((row: { document_id: string }) => row.document_id))
  } catch (err) {
    next(err)
  }
})

// ─── POST /api/cases/:id/documents/:docId ─────────────────────────────────────

casesRouter.post('/:id/documents/:docId', async (req, res, next) => {
  try {
    const { userId } = req as unknown as AuthRequest
    const { id, docId } = req.params

    // Verify lawyer owns this case
    const { data: caseRow } = await supabase
      .from('cases')
      .select('id')
      .eq('id', id)
      .eq('lawyer_id', userId)
      .single()

    if (!caseRow) { res.status(404).json({ error: 'Case not found' }); return }

    // Verify lawyer owns this document
    const { data: docRow } = await supabase
      .from('documents')
      .select('id')
      .eq('id', docId)
      .eq('user_id', userId)
      .single()

    if (!docRow) { res.status(404).json({ error: 'Document not found' }); return }

    const { error } = await supabase
      .from('case_documents')
      .upsert({ case_id: id, document_id: docId })

    if (error) throw error
    res.status(201).json({ success: true })
  } catch (err) {
    next(err)
  }
})

// ─── DELETE /api/cases/:id/documents/:docId ───────────────────────────────────

casesRouter.delete('/:id/documents/:docId', async (req, res, next) => {
  try {
    const { userId } = req as unknown as AuthRequest
    const { id, docId } = req.params

    // Verify lawyer owns this case
    const { data: caseRow } = await supabase
      .from('cases')
      .select('id')
      .eq('id', id)
      .eq('lawyer_id', userId)
      .single()

    if (!caseRow) { res.status(404).json({ error: 'Case not found' }); return }

    const { error } = await supabase
      .from('case_documents')
      .delete()
      .eq('case_id', id)
      .eq('document_id', docId)

    if (error) throw error
    res.json({ success: true })
  } catch (err) {
    next(err)
  }
})

// ─── GET /api/cases/:id/timeline ──────────────────────────────────────────────

casesRouter.get('/:id/timeline', async (req, res, next) => {
  try {
    const { userId } = req as unknown as AuthRequest
    const { id } = req.params

    const { data: caseRow } = await supabase.from('cases').select('id').eq('id', id).eq('lawyer_id', userId).single()
    if (!caseRow) { res.status(404).json({ error: 'Case not found' }); return }

    const { data, error } = await supabase
      .from('case_timeline_events')
      .select('*')
      .eq('case_id', id)
      .order('event_date', { ascending: true })

    if (error) throw error
    res.json(data ?? [])
  } catch (err) { next(err) }
})

// ─── POST /api/cases/:id/timeline ─────────────────────────────────────────────

casesRouter.post('/:id/timeline', async (req, res, next) => {
  try {
    const { userId } = req as unknown as AuthRequest
    const { id } = req.params
    const body = createTimelineEventSchema.parse(req.body)

    const { data: caseRow } = await supabase.from('cases').select('id').eq('id', id).eq('lawyer_id', userId).single()
    if (!caseRow) { res.status(404).json({ error: 'Case not found' }); return }

    const { data, error } = await supabase
      .from('case_timeline_events')
      .insert({ ...body, case_id: id, lawyer_id: userId })
      .select()
      .single()

    if (error) throw error
    res.status(201).json(data)
  } catch (err) { next(err) }
})

// ─── PATCH /api/cases/:id/timeline/:eventId ───────────────────────────────────

casesRouter.patch('/:id/timeline/:eventId', async (req, res, next) => {
  try {
    const { userId } = req as unknown as AuthRequest
    const { id, eventId } = req.params
    const body = updateTimelineEventSchema.parse(req.body)

    const { data: caseRow } = await supabase.from('cases').select('id').eq('id', id).eq('lawyer_id', userId).single()
    if (!caseRow) { res.status(404).json({ error: 'Case not found' }); return }

    const { data, error } = await supabase
      .from('case_timeline_events')
      .update(body)
      .eq('id', eventId)
      .eq('case_id', id)
      .select()
      .single()

    if (error) throw error
    if (!data) { res.status(404).json({ error: 'Event not found' }); return }
    res.json(data)
  } catch (err) { next(err) }
})

// ─── DELETE /api/cases/:id/timeline/:eventId ──────────────────────────────────

casesRouter.delete('/:id/timeline/:eventId', async (req, res, next) => {
  try {
    const { userId } = req as unknown as AuthRequest
    const { id, eventId } = req.params

    const { data: caseRow } = await supabase.from('cases').select('id').eq('id', id).eq('lawyer_id', userId).single()
    if (!caseRow) { res.status(404).json({ error: 'Case not found' }); return }

    const { error } = await supabase
      .from('case_timeline_events')
      .delete()
      .eq('id', eventId)
      .eq('case_id', id)

    if (error) throw error
    res.json({ success: true })
  } catch (err) { next(err) }
})

// ─── GET /api/cases/timeline/all ──────────────────────────────────────────────
// Returns all timeline events across all of this lawyer's cases
// NOTE: This route must be defined before /:id routes to avoid param collision

casesRouter.get('/timeline/all', async (req, res, next) => {
  try {
    const { userId } = req as unknown as AuthRequest

    const { data, error } = await supabase
      .from('case_timeline_events')
      .select('*, cases(title)')
      .eq('lawyer_id', userId)
      .order('event_date', { ascending: true })

    if (error) throw error
    res.json(data ?? [])
  } catch (err) { next(err) }
})

// ─── Case Notes ───────────────────────────────────────────────────────────────

const noteCreateSchema = z.object({
  content: z.string().min(1).max(50000),
})

// GET /api/cases/:id/notes
casesRouter.get('/:id/notes', async (req, res, next) => {
  try {
    const { userId } = req as unknown as AuthRequest
    const { id } = req.params

    const { data: caseRow } = await supabase.from('cases').select('id').eq('id', id).eq('lawyer_id', userId).single()
    if (!caseRow) { res.status(404).json({ error: 'Case not found' }); return }

    const { data, error } = await supabase
      .from('case_notes')
      .select('*')
      .eq('case_id', id)
      .order('created_at', { ascending: false })

    if (error) throw error
    res.json(data ?? [])
  } catch (err) { next(err) }
})

// POST /api/cases/:id/notes
casesRouter.post('/:id/notes', async (req, res, next) => {
  try {
    const { userId } = req as unknown as AuthRequest
    const { id } = req.params
    const { content } = noteCreateSchema.parse(req.body)

    const { data: caseRow } = await supabase.from('cases').select('id').eq('id', id).eq('lawyer_id', userId).single()
    if (!caseRow) { res.status(404).json({ error: 'Case not found' }); return }

    const { data, error } = await supabase
      .from('case_notes')
      .insert({ case_id: id, lawyer_id: userId, content })
      .select()
      .single()

    if (error) throw error
    res.status(201).json(data)
  } catch (err) { next(err) }
})

// PATCH /api/cases/:id/notes/:noteId
casesRouter.patch('/:id/notes/:noteId', async (req, res, next) => {
  try {
    const { userId } = req as unknown as AuthRequest
    const { id, noteId } = req.params
    const { content } = noteCreateSchema.parse(req.body)

    const { data, error } = await supabase
      .from('case_notes')
      .update({ content, updated_at: new Date().toISOString() })
      .eq('id', noteId)
      .eq('case_id', id)
      .eq('lawyer_id', userId)
      .select()
      .single()

    if (error) throw error
    if (!data) { res.status(404).json({ error: 'Note not found' }); return }
    res.json(data)
  } catch (err) { next(err) }
})

// DELETE /api/cases/:id/notes/:noteId
casesRouter.delete('/:id/notes/:noteId', async (req, res, next) => {
  try {
    const { userId } = req as unknown as AuthRequest
    const { id, noteId } = req.params

    const { error } = await supabase
      .from('case_notes')
      .delete()
      .eq('id', noteId)
      .eq('case_id', id)
      .eq('lawyer_id', userId)

    if (error) throw error
    res.json({ success: true })
  } catch (err) { next(err) }
})

// ─── Case Status History ──────────────────────────────────────────────────────

// GET /api/cases/:id/history
casesRouter.get('/:id/history', async (req, res, next) => {
  try {
    const { userId } = req as unknown as AuthRequest
    const { id } = req.params

    const { data: caseRow } = await supabase.from('cases').select('id').eq('id', id).eq('lawyer_id', userId).single()
    if (!caseRow) { res.status(404).json({ error: 'Case not found' }); return }

    const { data, error } = await supabase
      .from('case_status_history')
      .select('*')
      .eq('case_id', id)
      .order('created_at', { ascending: false })

    if (error) throw error
    res.json(data ?? [])
  } catch (err) { next(err) }
})
