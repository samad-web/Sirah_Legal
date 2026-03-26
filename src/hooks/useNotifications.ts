import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

interface Notification {
  id: string
  type: string
  title: string
  body: string
  link: string | null
  read: boolean
  created_at: string
}

interface NotificationsState {
  notifications: Notification[]
  unreadCount: number
  loading: boolean
  markRead: (id: string) => Promise<void>
  markAllRead: () => Promise<void>
  refetch: () => Promise<void>
}

async function getToken(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Not authenticated')
  return session.access_token
}

async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await getToken()
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init.headers as Record<string, string> ?? {}),
    },
  })
  if (!res.ok) throw new Error(`API error ${res.status}`)
  return res.json() as Promise<T>
}

export function useNotifications(userId: string | null): NotificationsState {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)

  const fetchNotifications = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    try {
      const data = await apiFetch<{
        notifications: Notification[]
        unread_count: number
      }>('/notifications?limit=20')
      setNotifications(data.notifications)
      setUnreadCount(data.unread_count)
    } catch {
      // silent — non-critical
    } finally {
      setLoading(false)
    }
  }, [userId])

  // Real-time unread count via Supabase Realtime
  useEffect(() => {
    if (!userId) return

    fetchNotifications()

    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          setNotifications((prev) => [payload.new as Notification, ...prev])
          setUnreadCount((prev) => prev + 1)
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId, fetchNotifications])

  const markRead = useCallback(async (id: string) => {
    await apiFetch(`/notifications/${id}/read`, { method: 'PATCH' })
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
    )
    setUnreadCount((prev) => Math.max(0, prev - 1))
  }, [])

  const markAllRead = useCallback(async () => {
    await apiFetch('/notifications/read-all', { method: 'PATCH' })
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
    setUnreadCount(0)
  }, [])

  return { notifications, unreadCount, loading, markRead, markAllRead, refetch: fetchNotifications }
}
