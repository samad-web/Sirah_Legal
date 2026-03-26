import { Router } from 'express'
import { z } from 'zod'
import { supabase } from '../lib/supabase.js'
import { requireAuth } from '../middleware/auth.js'
import type { AuthRequest } from '../middleware/auth.js'
import { notifyAdvocateNewMessage } from '../services/notifications.js'

export const messagesRouter = Router()

messagesRouter.use(requireAuth)

const sendMessageSchema = z.object({
  content: z.string().min(1).max(10000),
})

// Helper: verify that userId is a participant (lawyer or assigned client) for a case
async function verifyParticipant(caseId: string, userId: string): Promise<boolean> {
  const { data: asLawyer } = await supabase
    .from('cases')
    .select('id')
    .eq('id', caseId)
    .eq('lawyer_id', userId)
    .single()
  if (asLawyer) return true

  const { data: asClient } = await supabase
    .from('case_assignments')
    .select('case_id')
    .eq('case_id', caseId)
    .eq('client_id', userId)
    .single()
  return !!asClient
}

// GET /api/messages/:caseId
messagesRouter.get('/:caseId', async (req, res, next) => {
  try {
    const { userId } = req as unknown as AuthRequest
    const { caseId } = req.params

    const ok = await verifyParticipant(caseId, userId)
    if (!ok) { res.status(403).json({ error: 'Access denied' }); return }

    const { data, error } = await supabase
      .from('case_messages')
      .select('*, sender:profiles!sender_id(id, full_name, role)')
      .eq('case_id', caseId)
      .order('created_at', { ascending: true })

    if (error) throw error
    res.json(data ?? [])
  } catch (err) {
    next(err)
  }
})

// POST /api/messages/:caseId
messagesRouter.post('/:caseId', async (req, res, next) => {
  try {
    const { userId } = req as unknown as AuthRequest
    const { caseId } = req.params
    const { content } = sendMessageSchema.parse(req.body)

    const ok = await verifyParticipant(caseId, userId)
    if (!ok) { res.status(403).json({ error: 'Access denied' }); return }

    const { data, error } = await supabase
      .from('case_messages')
      .insert({ case_id: caseId, sender_id: userId, content })
      .select('*, sender:profiles!sender_id(id, full_name, role)')
      .single()

    if (error) throw error

    // Notify advocate if the sender is a client
    const { data: caseData } = await supabase
      .from('cases')
      .select('title, lawyer_id')
      .eq('id', caseId)
      .single()

    if (caseData && userId !== caseData.lawyer_id) {
      const { data: clientProfile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', userId)
        .maybeSingle()

      notifyAdvocateNewMessage(
        caseData.lawyer_id,
        clientProfile?.full_name ?? 'Your client',
        caseData.title,
        caseId,
      ).catch(() => {/* non-critical */})
    }

    res.status(201).json(data)
  } catch (err) {
    next(err)
  }
})

// PATCH /api/messages/:caseId/read
// Marks all messages in a case that were NOT sent by the current user as read
messagesRouter.patch('/:caseId/read', async (req, res, next) => {
  try {
    const { userId } = req as unknown as AuthRequest
    const { caseId } = req.params

    const ok = await verifyParticipant(caseId, userId)
    if (!ok) { res.status(403).json({ error: 'Access denied' }); return }

    const { error } = await supabase
      .from('case_messages')
      .update({ read_at: new Date().toISOString() })
      .eq('case_id', caseId)
      .neq('sender_id', userId)
      .is('read_at', null)

    if (error) throw error
    res.json({ success: true })
  } catch (err) {
    next(err)
  }
})
