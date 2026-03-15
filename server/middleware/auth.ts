import type { Request, Response, NextFunction } from 'express'
import { createHmac, timingSafeEqual } from 'crypto'
import { supabase } from '../lib/supabase.js'

export interface AuthRequest extends Request {
  userId: string
  userRole: string
}

const jwtSecret = process.env.SUPABASE_JWT_SECRET

// Per-process cache: once a profile has been confirmed to exist this session,
// skip the DB check on subsequent requests from the same user.
const profileEnsured = new Set<string>()

// Verify a Supabase HS256 JWT locally using the project JWT secret.
// Falls back to a Supabase network call when the secret is not configured.
function verifyJWT(token: string): { sub: string; user_metadata?: Record<string, unknown> } | null {
  if (!jwtSecret) return null
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const [header, payload, sig] = parts
  const expected = createHmac('sha256', jwtSecret).update(`${header}.${payload}`).digest('base64url')
  // Constant-time comparison (both strings are fixed-length base64url for HS256)
  try {
    if (!timingSafeEqual(Buffer.from(expected, 'ascii'), Buffer.from(sig, 'ascii'))) return null
  } catch {
    return null
  }
  try {
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
    if (decoded.exp && decoded.exp < Math.floor(Date.now() / 1000)) return null
    return decoded
  } catch {
    return null
  }
}

// Upsert a minimal profile row so FK constraints (cases.lawyer_id, etc.) are
// always satisfied. ignoreDuplicates = true means existing rows are untouched.
async function ensureProfile(userId: string, role: string): Promise<void> {
  await supabase
    .from('profiles')
    .upsert(
      { id: userId, role, default_language: 'en', plan: 'free', documents_this_month: 0, email_notifications: true },
      { onConflict: 'id', ignoreDuplicates: true },
    )
  profileEnsured.add(userId)
}

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) {
    res.status(401).json({ error: 'No authorization token provided' })
    return
  }

  let userId: string
  let userRole: string

  const local = verifyJWT(token)
  if (local) {
    // Fast path: verified locally, no network call
    userId = local.sub
    userRole = (local.user_metadata?.role as string) ?? 'lawyer'
  } else {
    // Fallback: verify via Supabase (used when SUPABASE_JWT_SECRET is not set)
    const { data: { user }, error } = await supabase.auth.getUser(token)
    if (error || !user) {
      res.status(401).json({ error: 'Invalid or expired token' })
      return
    }
    userId = user.id
    userRole = (user.user_metadata?.role as string) ?? 'lawyer'
  }

  const authReq = req as AuthRequest
  authReq.userId = userId
  authReq.userRole = userRole

  // Ensure the profile row exists before any route handler touches tables
  // that FK-reference profiles (cases, case_assignments, audit_logs, etc.)
  // Wrapped in try/catch: a failure here must never crash the server process.
  if (!profileEnsured.has(userId)) {
    try {
      await ensureProfile(userId, userRole)
    } catch (err) {
      console.error('[auth] ensureProfile failed (non-fatal):', err)
      // Don't block the request — the route will fail with a proper error
      // if it actually needs a profile row.
    }
  }

  next()
}

export function requireLawyer(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const role = (req as AuthRequest).userRole
  if (role !== 'lawyer') {
    res.status(403).json({ error: 'Forbidden: lawyer access required' })
    return
  }
  next()
}

export function requireClient(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const role = (req as AuthRequest).userRole
  if (role !== 'client') {
    res.status(403).json({ error: 'Forbidden: client access required' })
    return
  }
  next()
}
