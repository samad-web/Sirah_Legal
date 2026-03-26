import { Router } from 'express'
import { z } from 'zod'
import { supabase } from '../lib/supabase.js'
import { requireAuth, requireClient } from '../middleware/auth.js'
import type { AuthRequest } from '../middleware/auth.js'

const OPENAI_BASE = 'https://api.openai.com/v1'
const OPENAI_MODEL = 'gpt-4o-mini'
const OPENAI_TIMEOUT_MS = 30_000

// Strip injection-prone delimiters from data before embedding in AI prompts
function sanitizeForPrompt(input: string): string {
  return input
    .replace(/```/g, '')
    .replace(/<\/?[a-z][^>]*>/gi, '')
    .slice(0, 10_000)
}

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

// ─── PATCH /api/client/document-requests/:id/urgent ──────────────────────────

const urgentSchema = z.object({ urgency_note: z.string().max(500).optional() })

clientRouter.patch('/document-requests/:id/urgent', async (req, res, next) => {
  try {
    const { userId } = req as unknown as AuthRequest
    const { id } = req.params
    const { urgency_note } = urgentSchema.parse(req.body)

    const { data, error } = await supabase
      .from('document_requests')
      .update({ is_urgent: true, urgency_note: urgency_note ?? null })
      .eq('id', id)
      .eq('client_id', userId)
      .select()
      .single()

    if (error) throw error
    if (!data) { res.status(404).json({ error: 'Request not found' }); return }
    res.json(data)
  } catch (err) { next(err) }
})

// ─── GET /api/client/notifications ────────────────────────────────────────────

clientRouter.get('/notifications', async (req, res, next) => {
  try {
    const { userId } = req as AuthRequest

    const { data, error } = await supabase
      .from('client_notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) throw error
    res.json(data ?? [])
  } catch (err) { next(err) }
})

// ─── PATCH /api/client/notifications/read-all ─────────────────────────────────

clientRouter.patch('/notifications/read-all', async (req, res, next) => {
  try {
    const { userId } = req as AuthRequest

    const { error } = await supabase
      .from('client_notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('user_id', userId)
      .is('read_at', null)

    if (error) throw error
    res.json({ success: true })
  } catch (err) { next(err) }
})

// ─── PATCH /api/client/notifications/:id/read ────────────────────────────────

clientRouter.patch('/notifications/:id/read', async (req, res, next) => {
  try {
    const { userId } = req as unknown as AuthRequest
    const { id } = req.params

    const { error } = await supabase
      .from('client_notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', userId)

    if (error) throw error
    res.json({ success: true })
  } catch (err) { next(err) }
})

// ─── GET /api/client/notes ────────────────────────────────────────────────────

clientRouter.get('/notes', async (req, res, next) => {
  try {
    const { userId } = req as AuthRequest
    const caseId = req.query.caseId as string | undefined

    let query = supabase
      .from('client_notes')
      .select('*')
      .eq('client_id', userId)
      .order('created_at', { ascending: false })

    if (caseId) query = query.eq('case_id', caseId)

    const { data, error } = await query
    if (error) throw error
    res.json(data ?? [])
  } catch (err) { next(err) }
})

// ─── POST /api/client/notes ───────────────────────────────────────────────────

const noteSchema = z.object({
  case_id: z.string().uuid(),
  content: z.string().min(1).max(10000),
  share_with_lawyer: z.boolean().default(false),
})

clientRouter.post('/notes', async (req, res, next) => {
  try {
    const { userId } = req as AuthRequest
    const { case_id, content, share_with_lawyer } = noteSchema.parse(req.body)

    // Verify client is assigned to this case
    const { data: assignment } = await supabase
      .from('case_assignments')
      .select('case_id')
      .eq('case_id', case_id)
      .eq('client_id', userId)
      .single()

    if (!assignment) { res.status(403).json({ error: 'Access denied' }); return }

    const { data, error } = await supabase
      .from('client_notes')
      .insert({ client_id: userId, case_id, content, share_with_lawyer })
      .select()
      .single()

    if (error) throw error
    res.status(201).json(data)
  } catch (err) { next(err) }
})

// ─── PATCH /api/client/notes/:id ─────────────────────────────────────────────

const noteUpdateSchema = z.object({
  content: z.string().min(1).max(10000).optional(),
  share_with_lawyer: z.boolean().optional(),
})

clientRouter.patch('/notes/:id', async (req, res, next) => {
  try {
    const { userId } = req as unknown as AuthRequest
    const { id } = req.params
    const updates = noteUpdateSchema.parse(req.body)

    const { data, error } = await supabase
      .from('client_notes')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('client_id', userId)
      .select()
      .single()

    if (error) throw error
    if (!data) { res.status(404).json({ error: 'Note not found' }); return }
    res.json(data)
  } catch (err) { next(err) }
})

// ─── DELETE /api/client/notes/:id ─────────────────────────────────────────────

clientRouter.delete('/notes/:id', async (req, res, next) => {
  try {
    const { userId } = req as unknown as AuthRequest
    const { id } = req.params

    const { error } = await supabase
      .from('client_notes')
      .delete()
      .eq('id', id)
      .eq('client_id', userId)

    if (error) throw error
    res.json({ success: true })
  } catch (err) { next(err) }
})

// ─── POST /api/client/feedback ────────────────────────────────────────────────

const feedbackSchema = z.object({
  case_id: z.string().uuid().optional(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(2000).optional(),
})

clientRouter.post('/feedback', async (req, res, next) => {
  try {
    const { userId } = req as AuthRequest
    const { case_id, rating, comment } = feedbackSchema.parse(req.body)

    const { data, error } = await supabase
      .from('client_feedback')
      .insert({ client_id: userId, case_id: case_id ?? null, rating, comment: comment ?? null })
      .select()
      .single()

    if (error) throw error
    res.status(201).json(data)
  } catch (err) { next(err) }
})

// ─── POST /api/client/acknowledge ────────────────────────────────────────────

const ackSchema = z.object({ document_id: z.string().uuid() })

clientRouter.get('/acknowledge', async (req, res, next) => {
  try {
    const { userId } = req as AuthRequest

    const { data, error } = await supabase
      .from('document_acknowledgments')
      .select('*')
      .eq('user_id', userId)

    if (error) throw error
    res.json(data ?? [])
  } catch (err) { next(err) }
})

clientRouter.post('/acknowledge', async (req, res, next) => {
  try {
    const { userId } = req as AuthRequest
    const { document_id } = ackSchema.parse(req.body)

    const { data, error } = await supabase
      .from('document_acknowledgments')
      .upsert({ user_id: userId, document_id, acknowledged_at: new Date().toISOString() }, { onConflict: 'user_id,document_id' })
      .select()
      .single()

    if (error) throw error
    res.status(201).json(data)
  } catch (err) { next(err) }
})

// ─── POST /api/client/cases/:id/summary ──────────────────────────────────────

clientRouter.post('/cases/:id/summary', async (req, res, next) => {
  try {
    const { userId } = req as unknown as AuthRequest
    const { id } = req.params

    // Verify access
    const { data: assignment } = await supabase
      .from('case_assignments')
      .select('case_id')
      .eq('case_id', id)
      .eq('client_id', userId)
      .single()

    if (!assignment) { res.status(403).json({ error: 'Access denied' }); return }

    // Gather case data
    const [{ data: caseData }, { data: events }, { data: messages }, { data: requests }] = await Promise.all([
      supabase.from('cases').select('title, description, status, created_at').eq('id', id).single(),
      supabase.from('case_timeline_events').select('title, event_type, event_date').eq('case_id', id).order('event_date'),
      supabase.from('case_messages').select('content, created_at').eq('case_id', id).order('created_at', { ascending: false }).limit(10),
      supabase.from('document_requests').select('title, status').eq('case_id', id),
    ])

    // Sanitize all DB-sourced data before embedding in prompt
    const safeTitle = sanitizeForPrompt(caseData?.title ?? 'Untitled')
    const safeStatus = sanitizeForPrompt(caseData?.status ?? 'unknown')
    const safeDesc = sanitizeForPrompt(caseData?.description || 'Not provided')
    const safeOpened = caseData?.created_at ? new Date(caseData.created_at).toLocaleDateString() : 'Unknown'

    const prompt = `You are a legal assistant helping a client understand their case in simple, plain language.

Case: ${safeTitle}
Status: ${safeStatus}
Description: ${safeDesc}
Opened: ${safeOpened}

Timeline events:
${(events ?? []).map(e => `- ${sanitizeForPrompt(e.event_type).toUpperCase()} on ${e.event_date}: ${sanitizeForPrompt(e.title)}`).join('\n') || 'None recorded'}

Document requests:
${(requests ?? []).map(r => `- ${sanitizeForPrompt(r.title)} (${sanitizeForPrompt(r.status)})`).join('\n') || 'None'}

Recent messages (last 10):
${(messages ?? []).map(m => `- ${sanitizeForPrompt(m.content).slice(0, 100)}`).join('\n') || 'None'}

Write a brief, friendly case summary for the client in 3 sections:
1. Case Overview (1-2 sentences)
2. Current Status & Recent Activity (2-3 sentences)
3. What to Expect Next (1-2 sentences)

Keep it simple, avoid jargon, and be reassuring. Total length: under 150 words.`

    const openaiKey = process.env.OPENAI_API_KEY
    if (!openaiKey) {
      res.status(503).json({ error: 'Summary service is currently unavailable' })
      return
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), OPENAI_TIMEOUT_MS)

    try {
      const oaiRes = await fetch(`${OPENAI_BASE}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${openaiKey}`,
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: OPENAI_MODEL,
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 300,
          temperature: 0.7,
        }),
      })

      if (!oaiRes.ok) {
        console.error(`[client] OpenAI summary error ${oaiRes.status}`)
        throw new Error('AI service error')
      }
      const oaiData = await oaiRes.json() as { choices: { message: { content: string } }[] }
      const summary = oaiData.choices[0]?.message?.content ?? 'Unable to generate summary at this time.'
      res.json({ summary })
    } finally {
      clearTimeout(timeout)
    }
  } catch (err) { next(err) }
})
