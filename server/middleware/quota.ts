import type { Request, Response, NextFunction } from 'express'
import { supabase } from '../lib/supabase.js'
import type { AuthRequest } from './auth.js'

// Per-plan monthly document limits (Infinity = unlimited)
const PLAN_LIMITS: Record<string, number> = {
  free: 5,
  solo: 50,
  pro: Infinity,
  premium: Infinity,
  firm: Infinity,
}

export async function enforceQuota(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const { userId, userRole } = req as AuthRequest

  // Clients do not generate documents
  if (userRole === 'client') {
    res.status(403).json({ error: 'Forbidden: client accounts cannot generate documents' })
    return
  }

  try {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('plan, documents_this_month')
      .eq('id', userId)
      .single()

    if (error || !profile) {
      // Fail open — quota check failure must not block the user
      next()
      return
    }

    const plan = (profile.plan as string) ?? 'free'
    const limit = PLAN_LIMITS[plan] ?? PLAN_LIMITS.free
    const used = (profile.documents_this_month as number) ?? 0

    if (used >= limit) {
      res.status(402).json({
        error: `Monthly quota exceeded. Your ${plan} plan allows ${limit} document${limit !== 1 ? 's' : ''} per month. Upgrade your plan to continue.`,
        quota: { plan, used, limit },
      })
      return
    }
  } catch (err) {
    // Never crash the request over a quota check
    console.error('[quota] check failed (non-fatal):', err)
  }

  next()
}
