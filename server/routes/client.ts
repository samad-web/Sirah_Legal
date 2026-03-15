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
  document_id: z.string().uuid(),
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
