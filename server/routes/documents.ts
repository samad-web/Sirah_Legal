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
  limit: z.coerce.number().int().min(1).max(500).optional().default(20),
  search: z.string().max(200).optional(),
})

export const documentsRouter = Router()

documentsRouter.use(requireAuth)

// GET /api/documents/similar?type=notice&limit=5&caseId=...
// Returns recent documents of the same type, optionally filtered by case
documentsRouter.get('/similar', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as AuthRequest).userId
    const docType = req.query.type as string | undefined
    const caseId = req.query.caseId as string | undefined
    const limit = Math.min(Number(req.query.limit ?? 5), 10)

    if (!docType) {
      res.status(400).json({ error: 'type query parameter is required' })
      return
    }

    // If caseId is provided, get documents linked to that case
    if (caseId) {
      const { data: caseDocIds } = await supabase
        .from('case_documents')
        .select('document_id')
        .eq('case_id', caseId)

      if (caseDocIds && caseDocIds.length > 0) {
        const ids = caseDocIds.map(r => r.document_id)
        const { data, error } = await supabase
          .from('documents')
          .select('id, title, type, language, created_at, status')
          .eq('user_id', userId)
          .eq('type', docType)
          .in('id', ids)
          .order('created_at', { ascending: false })
          .limit(limit)

        if (error) {
          console.error('[documents] GET /similar case-linked error:', error.message)
          res.status(500).json({ error: 'Failed to fetch similar documents' })
          return
        }

        res.json({ documents: data ?? [], source: 'case' })
        return
      }
    }

    // Fallback: get recent documents of the same type
    const { data, error } = await supabase
      .from('documents')
      .select('id, title, type, language, created_at, status')
      .eq('user_id', userId)
      .eq('type', docType)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      console.error('[documents] GET /similar error:', error.message)
      res.status(500).json({ error: 'Failed to fetch similar documents' })
      return
    }

    res.json({ documents: data ?? [], source: 'recent' })
  } catch (err) {
    console.error('[documents] GET /similar unexpected error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// GET /api/documents?page=1&limit=20
documentsRouter.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
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
      // Sanitize FTS operators to prevent search injection — strip special postgres tsquery chars
      const safeSearch = search.replace(/[&|!():*<>\\]/g, ' ').trim()
      if (safeSearch) {
        query = query.textSearch('search_vector', safeSearch, { type: 'websearch' })
      }
    }

    const { data, error, count } = await query

    if (error) {
      console.error('[documents] GET / error:', error.message)
      res.status(500).json({ error: 'Failed to fetch documents' })
      return
    }

    res.json({ data: data ?? [], total: count ?? 0, page, limit })
  } catch (err) {
    console.error('[documents] GET / unexpected error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
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
    console.error('[documents] POST / error:', error.message)
    res.status(500).json({ error: 'Failed to create document' })
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

  // Snapshot current content before update (for versioning)
  const { data: currentDoc } = await supabase
    .from('documents')
    .select('content')
    .eq('id', id)
    .eq('user_id', userId)
    .single()

  const { data, error } = await supabase
    .from('documents')
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .single()

  if (error) {
    console.error('[documents] PATCH error:', error.message)
    res.status(500).json({ error: 'Failed to update document' })
    return
  }

  // Save version snapshot if content changed
  if (parsed.data.content && currentDoc && parsed.data.content !== currentDoc.content) {
    const { data: maxVersion } = await supabase
      .from('document_versions')
      .select('version_number')
      .eq('document_id', id)
      .order('version_number', { ascending: false })
      .limit(1)
      .single()

    const nextVersion = ((maxVersion?.version_number ?? 0) as number) + 1
    await supabase.from('document_versions').insert({
      document_id: id,
      content: currentDoc.content,
      version_number: nextVersion,
      created_by: userId,
    })
  }

  res.json(data)
})

// GET /api/documents/:id/versions
documentsRouter.get('/:id/versions', async (req: Request, res: Response): Promise<void> => {
  const userId = (req as AuthRequest).userId
  const { id } = req.params

  const { data: doc } = await supabase.from('documents').select('id').eq('id', id).eq('user_id', userId).single()
  if (!doc) { res.status(404).json({ error: 'Document not found' }); return }

  const { data, error } = await supabase
    .from('document_versions')
    .select('id, version_number, created_at, created_by')
    .eq('document_id', id)
    .order('version_number', { ascending: false })

  if (error) {
    console.error('[documents] GET versions error:', error.message)
    res.status(500).json({ error: 'Failed to fetch versions' })
    return
  }
  res.json(data ?? [])
})

// GET /api/documents/:id/versions/:versionId
documentsRouter.get('/:id/versions/:versionId', async (req: Request, res: Response): Promise<void> => {
  const userId = (req as AuthRequest).userId
  const { id, versionId } = req.params

  const { data: doc } = await supabase.from('documents').select('id').eq('id', id).eq('user_id', userId).single()
  if (!doc) { res.status(404).json({ error: 'Document not found' }); return }

  const { data, error } = await supabase
    .from('document_versions')
    .select('*')
    .eq('id', versionId)
    .eq('document_id', id)
    .single()

  if (error || !data) { res.status(404).json({ error: 'Version not found' }); return }
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
    console.error('[documents] DELETE error:', error.message)
    res.status(500).json({ error: 'Failed to delete document' })
    return
  }

  res.json({ success: true })
})
