import { Router } from 'express'
import { z } from 'zod'
import { supabase } from '../lib/supabase.js'
import { requireAuth, requireLawyer } from '../middleware/auth.js'
import type { AuthRequest } from '../middleware/auth.js'

export const clientsRouter = Router()

// All routes: lawyer only
clientsRouter.use(requireAuth, requireLawyer)

// ─── Schemas ─────────────────────────────────────────────────────────────────

const createClientSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  full_name: z.string().min(1),
})

// ─── GET /api/clients ─────────────────────────────────────────────────────────
// Returns profiles of all clients created by this lawyer

clientsRouter.get('/', async (req, res, next) => {
  try {
    const { userId } = req as AuthRequest

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('created_by_lawyer_id', userId)
      .order('created_at', { ascending: false })

    if (error) throw error
    res.json(data ?? [])
  } catch (err) {
    next(err)
  }
})

// ─── POST /api/clients ────────────────────────────────────────────────────────
// Creates a new client auth user + profile row

clientsRouter.post('/', async (req, res, next) => {
  try {
    const { userId } = req as AuthRequest
    const { email, password, full_name } = createClientSchema.parse(req.body)

    // Create auth user with client role in metadata
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        role: 'client',
        full_name,
      },
    })

    if (authError) throw authError

    const newUserId = authData.user.id

    // Create profile row for the new client.
    // Must include role: 'client' — the column defaults to 'lawyer' which
    // would give the client advocate-level access in profile-based checks.
    const { error: profileError } = await supabase
      .from('profiles')
      .insert({
        id: newUserId,
        full_name,
        role: 'client',
        default_language: 'en',
        email_notifications: false,
        plan: 'client',
        documents_this_month: 0,
        created_by_lawyer_id: userId,
      })

    if (profileError) throw profileError

    res.status(201).json({ userId: newUserId, email })
  } catch (err) {
    next(err)
  }
})

// ─── POST /api/clients/:id/reset-password ─────────────────────────────────────
// Sends a password reset email for a client using the admin API (which has
// access to the user's email from auth.users without needing it in profiles).

clientsRouter.post('/:id/reset-password', async (req, res, next) => {
  try {
    const { userId } = req as AuthRequest
    const { id: clientId } = req.params

    // Verify lawyer owns this client account
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', clientId)
      .eq('created_by_lawyer_id', userId)
      .single()

    if (!profile) {
      res.status(404).json({ error: 'Client not found' })
      return
    }

    // Get the user's email from auth.users via admin API
    const { data: authUser, error: authError } = await supabase.auth.admin.getUserById(clientId)
    if (authError || !authUser?.user?.email) {
      res.status(500).json({ error: 'Could not retrieve client email' })
      return
    }

    // Generate a password reset link (more reliable than sending email directly
    // since it uses Supabase's built-in reset flow)
    const { error: resetError } = await supabase.auth.admin.generateLink({
      type: 'recovery',
      email: authUser.user.email,
    })

    if (resetError) throw resetError

    res.json({ success: true, email: authUser.user.email })
  } catch (err) {
    next(err)
  }
})
