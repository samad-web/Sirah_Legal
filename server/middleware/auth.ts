import type { Request, Response, NextFunction } from 'express'
import { createHmac, timingSafeEqual } from 'crypto'
import { supabase } from '../lib/supabase.js'

export interface AuthRequest extends Request {
  userId: string
  userRole: string
}

const jwtSecret = process.env.SUPABASE_JWT_SECRET
const supabaseUrl = process.env.SUPABASE_URL
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY

// Per-process role cache: avoids a DB round-trip on every request.
// Populated on first request per user; evicted on server restart.
// Role changes in the DB take effect after server restart (acceptable trade-off).
const roleCache = new Map<string, string>()

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

// Fetch the authoritative role from the profiles table and ensure the row
// exists. The role in JWT user_metadata is user-writable and cannot be trusted
// for authorization decisions. Returns the DB role, falling back to jwtRole if
// the DB is unavailable.
async function getAuthorizedRole(userId: string, jwtRole: string): Promise<string> {
  // Cache hit: avoid a DB call on every request
  const cached = roleCache.get(userId)
  if (cached !== undefined) return cached

  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single()

    if (profile?.role) {
      const role = profile.role as string
      roleCache.set(userId, role)
      return role
    }

    // Profile doesn't exist yet — create it and use the JWT role as the initial role
    await supabase.from('profiles').insert({
      id: userId,
      role: jwtRole,
      default_language: 'en',
      plan: 'free',
      documents_this_month: 0,
      email_notifications: true,
    })
    roleCache.set(userId, jwtRole)
    return jwtRole
  } catch (err) {
    console.error('[auth] getAuthorizedRole failed, falling back to JWT role:', err)
    return jwtRole
  }
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
  let jwtRole: string

  const local = verifyJWT(token)
  if (local) {
    // Fast path: verified locally, no network call
    userId = local.sub
    jwtRole = (local.user_metadata?.role as string) ?? 'lawyer'
  } else {
    // Fallback: verify via Supabase Auth REST API using the anon key.
    // The service-role client's auth.getUser() does NOT work for user JWT
    // verification — Supabase's /auth/v1/user endpoint requires the project
    // anon key as `apikey`, not the service-role key.
    if (!supabaseUrl || !supabaseAnonKey) {
      res.status(401).json({ error: 'Server auth misconfiguration' })
      return
    }
    let authUser: { id: string; user_metadata?: Record<string, unknown> } | null = null
    try {
      const resp = await fetch(`${supabaseUrl}/auth/v1/user`, {
        headers: {
          apikey: supabaseAnonKey,
          Authorization: `Bearer ${token}`,
        },
      })
      if (resp.ok) {
        authUser = await resp.json() as { id: string; user_metadata?: Record<string, unknown> }
      }
    } catch {
      // network error — fall through to 401
    }
    if (!authUser?.id) {
      res.status(401).json({ error: 'Invalid or expired token' })
      return
    }
    userId = authUser.id
    jwtRole = (authUser.user_metadata?.role as string) ?? 'lawyer'
  }

  // Resolve the authoritative role from the DB (JWT metadata is user-writable
  // and must not be used for authorization decisions).
  const userRole = await getAuthorizedRole(userId, jwtRole)

  const authReq = req as AuthRequest
  authReq.userId = userId
  authReq.userRole = userRole

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
