import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Bell, Check, FileText, MessageSquare, Folder, Calendar, Briefcase, CheckCheck } from 'lucide-react'
import {
  getClientNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from '@/lib/api-additions'
import type { ClientNotification } from '@/lib/api-additions'

const TYPE_ICON: Record<ClientNotification['type'], React.ReactNode> = {
  message:     <MessageSquare size={13} />,
  document:    <FileText size={13} />,
  request:     <Folder size={13} />,
  reminder:    <Calendar size={13} />,
  'case-update': <Briefcase size={13} />,
}

const TYPE_COLOR: Record<ClientNotification['type'], string> = {
  message:       'text-[#93c5fd]',
  document:      'text-[#86efac]',
  request:       'text-[#fbbf24]',
  reminder:      'text-[#f9a8d4]',
  'case-update': 'text-gold',
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export function NotificationBell() {
  const [notifications, setNotifications] = useState<ClientNotification[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  const unread = notifications.filter(n => !n.read_at).length

  useEffect(() => {
    let mounted = true
    const load = async () => {
      try {
        const data = await getClientNotifications()
        if (mounted) setNotifications(data)
      } catch {}
    }
    load()
    // Poll every 60 seconds for new notifications
    const interval = setInterval(load, 60000)
    return () => { mounted = false; clearInterval(interval) }
  }, [])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const handleMarkRead = async (n: ClientNotification) => {
    if (n.read_at) return
    try {
      await markNotificationRead(n.id)
      setNotifications(prev => prev.map(x => x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x))
    } catch {}
  }

  const handleMarkAllRead = async () => {
    setLoading(true)
    try {
      await markAllNotificationsRead()
      setNotifications(prev => prev.map(x => ({ ...x, read_at: x.read_at ?? new Date().toISOString() })))
    } catch {}
    setLoading(false)
  }

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setOpen(o => !o)}
        className="relative w-9 h-9 flex items-center justify-center text-muted hover:text-foreground hover:bg-surface-2 border border-transparent hover:border-border/50 transition-all"
        title="Notifications"
      >
        <Bell size={17} />
        {unread > 0 && (
          <span className="absolute top-1 right-1 w-4 h-4 flex items-center justify-center bg-gold text-[#0E0E0E] text-[9px] font-bold rounded-none"
            style={{ fontFamily: 'DM Mono, monospace' }}>
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="absolute left-0 top-full mt-2 w-[320px] bg-surface border border-border shadow-2xl z-50"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/50">
              <span className="text-[11px] tracking-widest text-muted" style={{ fontFamily: 'DM Mono, monospace' }}>
                NOTIFICATIONS
              </span>
              {unread > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  disabled={loading}
                  className="flex items-center gap-1 text-[10px] text-gold/70 hover:text-gold transition-colors disabled:opacity-40"
                  style={{ fontFamily: 'DM Mono, monospace' }}
                >
                  <CheckCheck size={11} /> MARK ALL READ
                </button>
              )}
            </div>

            {/* List */}
            <div className="max-h-[360px] overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <Bell size={22} className="text-muted/20 mb-2" />
                  <p className="text-[12px] text-muted" style={{ fontFamily: 'Cormorant Garamond, serif' }}>
                    No notifications yet.
                  </p>
                </div>
              ) : (
                notifications.map(n => (
                  <button
                    key={n.id}
                    onClick={() => handleMarkRead(n)}
                    className={`w-full flex items-start gap-3 px-4 py-3 text-left border-b border-border/30 last:border-0 transition-colors hover:bg-surface-2 ${!n.read_at ? 'bg-forest/20' : ''}`}
                  >
                    <span className={`mt-0.5 shrink-0 ${TYPE_COLOR[n.type]}`}>
                      {TYPE_ICON[n.type]}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className={`text-[12px] leading-snug ${n.read_at ? 'text-muted' : 'text-foreground'}`}
                        style={{ fontFamily: 'Lora, serif' }}>
                        {n.title}
                      </p>
                      {n.body && (
                        <p className="text-[10px] text-muted/70 mt-0.5 truncate" style={{ fontFamily: 'DM Mono, monospace' }}>
                          {n.body}
                        </p>
                      )}
                      <p className="text-[9px] text-muted/50 mt-1" style={{ fontFamily: 'DM Mono, monospace' }}>
                        {timeAgo(n.created_at)}
                      </p>
                    </div>
                    {!n.read_at && (
                      <span className="w-1.5 h-1.5 rounded-full bg-gold shrink-0 mt-1.5" />
                    )}
                  </button>
                ))
              )}
            </div>

            {notifications.length > 0 && (
              <div className="px-4 py-2 border-t border-border/30">
                <p className="text-[9px] text-muted/40 text-center" style={{ fontFamily: 'DM Mono, monospace' }}>
                  {unread === 0 ? 'ALL CAUGHT UP' : `${unread} UNREAD`}
                </p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
