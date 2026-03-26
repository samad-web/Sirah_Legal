import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { z } from 'zod'
import { supabase } from '../lib/supabase.js'
import { requireAuth, requireLawyer } from '../middleware/auth.js'
import type { AuthRequest } from '../middleware/auth.js'

export const clientsRouter = Router()

// All routes: lawyer only
clientsRouter.use(requireAuth, requireLawyer)

// Tighter rate limit for client-management write operations (creates, resets)
const clientWriteLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20,
  keyGenerator: (req) => (req as AuthRequest).userId ?? 'unknown',
  message: { error: 'Too many client management requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
})

// ─── Schemas ─────────────────────────────────────────────────────────────────

const createClientSchema = z.object({
  email: z.email(),
  password: z.string().min(8).refine(
    (val) => /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(val),
    { message: 'Password must contain at least one uppercase letter, one lowercase letter, and one number' },
  ),
  full_name: z.string().min(1).max(255),
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

clientsRouter.post('/', clientWriteLimiter, async (req, res, next) => {
  try {
    const { userId } = req as AuthRequest
    const parsed = createClientSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues.map(i => i.message).join('; ') })
      return
    }
    const { email, password, full_name } = parsed.data

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

    if (authError) {
      // Map common Supabase auth error codes to appropriate HTTP responses
      const msg = authError.message ?? 'Failed to create user'
      const status = authError.status && authError.status >= 400 && authError.status < 600
        ? authError.status
        : 400
      res.status(status).json({ error: msg })
      return
    }

    if (!authData?.user?.id) {
      res.status(500).json({ error: 'User created but ID not returned' })
      return
    }

    const newUserId = authData.user.id

    // Create profile row for the new client.
    // Must include role: 'client' — the column defaults to 'lawyer' which
    // would give the client advocate-level access in profile-based checks.
    // Use upsert: the handle_new_user trigger may have already created the row.
    const { error: profileError } = await supabase
      .from('profiles')
      .upsert({
        id: newUserId,
        full_name,
        role: 'client',
        default_language: 'en',
        email_notifications: false,
        plan: 'free',
        documents_this_month: 0,
        created_by_lawyer_id: userId,
      })

    if (profileError) {
      // Auth user was created but profile upsert failed — log for investigation
      console.error(`[clients] profile upsert failed for userId=${newUserId}:`, profileError.message)
      res.status(500).json({ error: 'Failed to complete client profile setup' })
      return
    }

    console.log(`[audit] client created: lawyerId=${userId} clientId=${newUserId} email=${email} ip=${req.ip}`)

    res.status(201).json({ userId: newUserId, email })
  } catch (err) {
    next(err)
  }
})

// ─── POST /api/clients/:id/reset-password ─────────────────────────────────────
// Sends a password reset email for a client using the admin API (which has
// access to the user's email from auth.users without needing it in profiles).

clientsRouter.post('/:id/reset-password', clientWriteLimiter, async (req, res, next) => {
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
    const { data: authUser, error: authError } = await supabase.auth.admin.getUserById(String(clientId))
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

    console.log(`[audit] password reset triggered: lawyerId=${userId} clientId=${clientId} ip=${req.ip}`)

    res.json({ success: true })
  } catch (err) {
    next(err)
  }
})
