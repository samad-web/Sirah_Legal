import { Router } from 'express'
import { z } from 'zod'
import { supabase } from '../lib/supabase.js'
import { requireAuth, requireLawyer } from '../middleware/auth.js'
import type { AuthRequest } from '../middleware/auth.js'

export const intakeFormsRouter = Router()

const formSchema = z.object({
  title: z.string().min(1).max(500),
  case_id: z.string().uuid().optional(),
  fields: z.array(z.object({
    id: z.string(),
    label: z.string(),
    type: z.enum(['text', 'email', 'tel', 'textarea', 'date']),
    required: z.boolean().optional(),
  })),
})

const submissionSchema = z.object({
  respondent_email: z.string().email().optional(),
  data: z.record(z.string(), z.unknown()),
})

// All routes below — lawyer routes use requireLawyer, public routes skip auth

// GET /api/intake-forms — lawyer lists their forms
intakeFormsRouter.get('/', requireAuth, requireLawyer, async (req, res, next) => {
  try {
    const { userId } = req as unknown as AuthRequest
    const { data, error } = await supabase
      .from('intake_forms')
      .select('*')
      .eq('lawyer_id', userId)
      .order('created_at', { ascending: false })
    if (error) throw error
    res.json(data ?? [])
  } catch (err) { next(err) }
})

// POST /api/intake-forms — lawyer creates form
intakeFormsRouter.post('/', requireAuth, requireLawyer, async (req, res, next) => {
  try {
    const { userId } = req as unknown as AuthRequest
    const body = formSchema.parse(req.body)
    const { data, error } = await supabase
      .from('intake_forms')
      .insert({ ...body, lawyer_id: userId })
      .select()
      .single()
    if (error) throw error
    res.status(201).json(data)
  } catch (err) { next(err) }
})

// PATCH /api/intake-forms/:id — lawyer updates form
intakeFormsRouter.patch('/:id', requireAuth, requireLawyer, async (req, res, next) => {
  try {
    const { userId } = req as unknown as AuthRequest
    const { id } = req.params
    const body = formSchema.partial().parse(req.body)
    const { data, error } = await supabase
      .from('intake_forms')
      .update(body)
      .eq('id', id)
      .eq('lawyer_id', userId)
      .select()
      .single()
    if (error) throw error
    if (!data) { res.status(404).json({ error: 'Form not found' }); return }
    res.json(data)
  } catch (err) { next(err) }
})

// DELETE /api/intake-forms/:id — lawyer deletes form
intakeFormsRouter.delete('/:id', requireAuth, requireLawyer, async (req, res, next) => {
  try {
    const { userId } = req as unknown as AuthRequest
    const { id } = req.params
    const { error } = await supabase
      .from('intake_forms')
      .delete()
      .eq('id', id)
      .eq('lawyer_id', userId)
    if (error) throw error
    res.json({ success: true })
  } catch (err) { next(err) }
})

// GET /api/intake-forms/:id/public — public (no auth), returns form definition
intakeFormsRouter.get('/:id/public', async (req, res, next) => {
  try {
    const { id } = req.params
    const { data, error } = await supabase
      .from('intake_forms')
      .select('id, title, fields')
      .eq('id', id)
      .single()
    if (error || !data) { res.status(404).json({ error: 'Form not found' }); return }
    res.json(data)
  } catch (err) { next(err) }
})

// POST /api/intake-forms/:id/submit — public (no auth), submits response
intakeFormsRouter.post('/:id/submit', async (req, res, next) => {
  try {
    const { id } = req.params
    const body = submissionSchema.parse(req.body)

    // Verify form exists
    const { data: form } = await supabase
      .from('intake_forms')
      .select('id')
      .eq('id', id)
      .single()
    if (!form) { res.status(404).json({ error: 'Form not found' }); return }

    const { data, error } = await supabase
      .from('intake_submissions')
      .insert({ form_id: id, ...body })
      .select()
      .single()
    if (error) throw error
    res.status(201).json(data)
  } catch (err) { next(err) }
})

// GET /api/intake-forms/:id/submissions — lawyer views submissions
intakeFormsRouter.get('/:id/submissions', requireAuth, requireLawyer, async (req, res, next) => {
  try {
    const { userId } = req as unknown as AuthRequest
    const { id } = req.params

    // Verify lawyer owns form
    const { data: form } = await supabase
      .from('intake_forms')
      .select('id')
      .eq('id', id)
      .eq('lawyer_id', userId)
      .single()
    if (!form) { res.status(404).json({ error: 'Form not found' }); return }

    const { data, error } = await supabase
      .from('intake_submissions')
      .select('*')
      .eq('form_id', id)
      .order('submitted_at', { ascending: false })
    if (error) throw error
    res.json(data ?? [])
  } catch (err) { next(err) }
})
