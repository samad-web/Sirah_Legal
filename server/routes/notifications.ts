import { Router } from 'express'
import type { Response } from 'express'
import { requireAuth } from '../middleware/auth.js'
import type { AuthRequest } from '../middleware/auth.js'
import { supabase } from '../lib/supabase.js'

export const notificationsRouter = Router()

notificationsRouter.use(requireAuth)

// GET /api/notifications?limit=20&offset=0
notificationsRouter.get('/', async (req, res: Response): Promise<void> => {
  try {
    const userId = (req as unknown as AuthRequest).userId
    const limit = Math.min(Number(req.query.limit ?? 20), 50)
    const offset = Number(req.query.offset ?? 0)

    const { data, error, count } = await supabase
      .from('notifications')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      console.error('[notifications] GET / error:', error.message)
      res.status(500).json({ error: 'Failed to fetch notifications' })
      return
    }

    const { count: unreadCount } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('read', false)

    res.json({
      notifications: data ?? [],
      total: count ?? 0,
      unread_count: unreadCount ?? 0,
    })
  } catch (err) {
    console.error('[notifications] GET / unexpected error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// GET /api/notifications/unread-count
notificationsRouter.get('/unread-count', async (req, res: Response): Promise<void> => {
  try {
    const userId = (req as unknown as AuthRequest).userId

    const { count, error } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('read', false)

    if (error) {
      res.status(500).json({ error: 'Failed to fetch unread count' })
      return
    }

    res.json({ unread_count: count ?? 0 })
  } catch (err) {
    console.error('[notifications] GET /unread-count error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// PATCH /api/notifications/read-all — must be before /:id to avoid param collision
notificationsRouter.patch('/read-all', async (req, res: Response): Promise<void> => {
  try {
    const userId = (req as unknown as AuthRequest).userId

    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_id', userId)
      .eq('read', false)

    if (error) {
      console.error('[notifications] PATCH /read-all error:', error.message)
      res.status(500).json({ error: 'Failed to update notifications' })
      return
    }

    res.json({ updated: true })
  } catch (err) {
    console.error('[notifications] PATCH /read-all error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// PATCH /api/notifications/:id/read
notificationsRouter.patch('/:id/read', async (req, res: Response): Promise<void> => {
  try {
    const userId = (req as unknown as AuthRequest).userId
    const { id } = req.params

    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', id)
      .eq('user_id', userId)

    if (error) {
      console.error('[notifications] PATCH /:id/read error:', error.message)
      res.status(500).json({ error: 'Failed to update notification' })
      return
    }

    res.json({ updated: true })
  } catch (err) {
    console.error('[notifications] PATCH /:id/read error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})
