import { Router } from 'express'
import { z } from 'zod'
import { supabase } from '../lib/supabase.js'
import { requireAuth, requireClient } from '../middleware/auth.js'
import type { AuthRequest } from '../middleware/auth.js'

export const clientRouter = Router()

// All routes: client only
clientRouter.use(requireAuth, requireClient)

// ─── Schemas ─────────────────────────────────────────────────────────────────

const auditSchema = z.object({
  document_id: z.uuid(),
  action: z.enum(['preview', 'download', 'view_list']),
})

// ─── GET /api/client/cases ────────────────────────────────────────────────────
// Returns cases this client is assigned to

clientRouter.get('/cases', async (req, res, next) => {
  try {
    const { userId } = req as AuthRequest

    const { data, error } = await supabase
      .from('case_assignments')
      .select('cases(*)')
      .eq('client_id', userId)

    if (error) throw error
    const cases = (data ?? []).map((row: Record<string, unknown>) => row.cases)
    res.json(cases)
  } catch (err) {
    next(err)
  }
})

// ─── GET /api/client/documents ────────────────────────────────────────────────
// Returns documents from cases this client is assigned to

clientRouter.get('/documents', async (req, res, next) => {
  try {
    const { userId } = req as AuthRequest

    // Get all case IDs this client is assigned to
    const { data: assignments, error: assignError } = await supabase
      .from('case_assignments')
      .select('case_id')
      .eq('client_id', userId)

    if (assignError) throw assignError

    const caseIds = (assignments ?? []).map((a: { case_id: string }) => a.case_id)

    if (caseIds.length === 0) {
      res.json([])
      return
    }

    // Get all document IDs linked to those cases
    const { data: caseDocRows, error: caseDocError } = await supabase
      .from('case_documents')
      .select('document_id')
      .in('case_id', caseIds)

    if (caseDocError) throw caseDocError

    const docIds = (caseDocRows ?? []).map((r: { document_id: string }) => r.document_id)

    if (docIds.length === 0) {
      res.json([])
      return
    }

    // Fetch the actual documents
    const { data: documents, error: docError } = await supabase
      .from('documents')
      .select('*')
      .in('id', docIds)
      .order('created_at', { ascending: false })

    if (docError) throw docError
    res.json(documents ?? [])
  } catch (err) {
    next(err)
  }
})

// ─── GET /api/client/cases/:id/timeline ──────────────────────────────────────
// Returns timeline events for a case the client is assigned to

clientRouter.get('/cases/:id/timeline', async (req, res, next) => {
  try {
    const { userId } = req as unknown as AuthRequest
    const { id } = req.params

    // Verify client is assigned to this case
    const { data: assignment } = await supabase
      .from('case_assignments')
      .select('case_id')
      .eq('case_id', id)
      .eq('client_id', userId)
      .single()

    if (!assignment) { res.status(403).json({ error: 'Access denied' }); return }

    const { data, error } = await supabase
      .from('case_timeline_events')
      .select('*')
      .eq('case_id', id)
      .order('event_date', { ascending: true })

    if (error) throw error
    res.json(data ?? [])
  } catch (err) { next(err) }
})

// ─── GET /api/client/cases/:id/documents ─────────────────────────────────────
// Returns documents linked to a specific case the client is assigned to

clientRouter.get('/cases/:id/documents', async (req, res, next) => {
  try {
    const { userId } = req as unknown as AuthRequest
    const { id } = req.params

    const { data: assignment } = await supabase
      .from('case_assignments')
      .select('case_id')
      .eq('case_id', id)
      .eq('client_id', userId)
      .single()

    if (!assignment) { res.status(403).json({ error: 'Access denied' }); return }

    const { data: caseDocRows, error: caseDocError } = await supabase
      .from('case_documents')
      .select('document_id')
      .eq('case_id', id)

    if (caseDocError) throw caseDocError

    const docIds = (caseDocRows ?? []).map((r: { document_id: string }) => r.document_id)
    if (docIds.length === 0) { res.json([]); return }

    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .in('id', docIds)
      .order('created_at', { ascending: false })

    if (error) throw error
    res.json(data ?? [])
  } catch (err) { next(err) }
})

// ─── POST /api/client/audit ───────────────────────────────────────────────────
// Logs document access for audit trail

clientRouter.post('/audit', async (req, res, next) => {
  try {
    const { userId } = req as AuthRequest
    const { document_id, action } = auditSchema.parse(req.body)

    const { error } = await supabase
      .from('audit_logs')
      .insert({ user_id: userId, document_id, action })

    if (error) throw error
    res.json({ success: true })
  } catch (err) {
    next(err)
  }
})

// ─── GET /api/client/messages/:caseId ────────────────────────────────────────

clientRouter.get('/messages/:caseId', async (req, res, next) => {
  try {
    const { userId } = req as AuthRequest
    const { caseId } = req.params

    const { data: assignment } = await supabase
      .from('case_assignments')
      .select('case_id')
      .eq('case_id', caseId)
      .eq('client_id', userId)
      .single()

    if (!assignment) { res.status(403).json({ error: 'Access denied' }); return }

    const { data, error } = await supabase
      .from('case_messages')
      .select('*, sender:profiles!sender_id(id, full_name, role)')
      .eq('case_id', caseId)
      .order('created_at', { ascending: true })

    if (error) throw error
    res.json(data ?? [])
  } catch (err) { next(err) }
})

// ─── POST /api/client/messages/:caseId ───────────────────────────────────────

const clientMsgSchema = z.object({ content: z.string().min(1).max(10000) })

clientRouter.post('/messages/:caseId', async (req, res, next) => {
  try {
    const { userId } = req as AuthRequest
    const { caseId } = req.params
    const { content } = clientMsgSchema.parse(req.body)

    const { data: assignment } = await supabase
      .from('case_assignments')
      .select('case_id')
      .eq('case_id', caseId)
      .eq('client_id', userId)
      .single()

    if (!assignment) { res.status(403).json({ error: 'Access denied' }); return }

    const { data, error } = await supabase
      .from('case_messages')
      .insert({ case_id: caseId, sender_id: userId, content })
      .select('*, sender:profiles!sender_id(id, full_name, role)')
      .single()

    if (error) throw error
    res.status(201).json(data)
  } catch (err) { next(err) }
})

// ─── GET /api/client/document-requests ───────────────────────────────────────

clientRouter.get('/document-requests', async (req, res, next) => {
  try {
    const { userId } = req as AuthRequest

    const { data, error } = await supabase
      .from('document_requests')
      .select('*, case:cases!case_id(id, title)')
      .eq('client_id', userId)
      .order('created_at', { ascending: false })

    if (error) throw error
    res.json(data ?? [])
  } catch (err) { next(err) }
})

// ─── PATCH /api/client/document-requests/:id/fulfil ──────────────────────────

clientRouter.patch('/document-requests/:id/fulfil', async (req, res, next) => {
  try {
    const { userId } = req as AuthRequest
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
  } catch (err) { next(err) }
})
