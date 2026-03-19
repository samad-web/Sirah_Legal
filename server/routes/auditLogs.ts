import { Router } from 'express'
import { supabase } from '../lib/supabase.js'
import { requireAuth, requireLawyer } from '../middleware/auth.js'
import type { AuthRequest } from '../middleware/auth.js'

export const auditLogsRouter = Router()

auditLogsRouter.use(requireAuth, requireLawyer)

// GET /api/audit-logs?caseId=&limit=50
auditLogsRouter.get('/', async (req, res, next) => {
  try {
    const { userId } = req as unknown as AuthRequest
    const caseId = req.query.caseId as string | undefined
    const limit = Math.min(Number(req.query.limit ?? 50), 200)

    // Get documents owned by this lawyer (or linked to the specified case)
    let docIds: string[] = []

    if (caseId) {
      // Verify lawyer owns case
      const { data: caseRow } = await supabase
        .from('cases')
        .select('id')
        .eq('id', caseId)
        .eq('lawyer_id', userId)
        .single()

      if (!caseRow) { res.status(404).json({ error: 'Case not found' }); return }

      const { data: caseDocRows } = await supabase
        .from('case_documents')
        .select('document_id')
        .eq('case_id', caseId)

      docIds = (caseDocRows ?? []).map((r: { document_id: string }) => r.document_id)
    } else {
      // All documents owned by this lawyer
      const { data: docs } = await supabase
        .from('documents')
        .select('id')
        .eq('user_id', userId)

      docIds = (docs ?? []).map((d: { id: string }) => d.id)
    }

    if (docIds.length === 0) { res.json([]); return }

    const { data, error } = await supabase
      .from('audit_logs')
      .select('*, client:profiles!user_id(id, full_name), document:documents!document_id(id, title)')
      .in('document_id', docIds)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) throw error
    res.json(data ?? [])
  } catch (err) {
    next(err)
  }
})
