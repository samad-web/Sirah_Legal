import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell } from 'lucide-react'
import { useNotifications } from '@/hooks/useNotifications'
import { useAuth } from '@/contexts/AuthContext'
import { cn } from '@/lib/utils'

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export function NotificationBell() {
  const { user } = useAuth()
  const { notifications, unreadCount, loading, markRead, markAllRead } =
    useNotifications(user?.id ?? null)
  const [open, setOpen] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  const handleNotificationClick = async (n: (typeof notifications)[0]) => {
    if (!n.read) await markRead(n.id)
    if (n.link) {
      navigate(n.link)
      setOpen(false)
    }
  }

  return (
    <div ref={panelRef} className="relative">
      <button
        aria-label={`Notifications — ${unreadCount} unread`}
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="relative p-2 rounded-md hover:bg-[#1e1e1e] transition-colors"
      >
        <Bell size={18} className="text-[#FAF7F0]/60" />
        {unreadCount > 0 && (
          <span
            aria-hidden="true"
            className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-[#C9A84C] text-[#0a0a0a] text-[9px] font-bold flex items-center justify-center"
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Notifications"
          className="absolute right-0 top-10 w-80 bg-[#161616] border border-[#2a2a2a] rounded-xl shadow-2xl z-50 overflow-hidden"
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#2a2a2a]">
            <h2 className="text-sm font-semibold text-[#FAF7F0]">Notifications</h2>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="text-xs text-[#C9A84C] hover:underline"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-[360px] overflow-y-auto">
            {loading && notifications.length === 0 && (
              <p className="text-center text-xs text-[#FAF7F0]/40 py-8">Loading...</p>
            )}

            {!loading && notifications.length === 0 && (
              <div className="py-12 text-center">
                <p className="text-[#FAF7F0]/30 text-sm">You're all caught up</p>
              </div>
            )}

            {notifications.map((n) => (
              <button
                key={n.id}
                onClick={() => handleNotificationClick(n)}
                className={cn(
                  'w-full text-left px-4 py-3 border-b border-[#2a2a2a] last:border-0',
                  'hover:bg-[#1e1e1e] transition-colors',
                  !n.read ? 'border-l-2 border-l-[#C9A84C]' : 'border-l-2 border-l-transparent',
                )}
              >
                <p className={cn('text-sm font-medium', n.read ? 'text-[#FAF7F0]/60' : 'text-[#FAF7F0]')}>
                  {n.title}
                </p>
                <p className="text-xs text-[#FAF7F0]/40 mt-0.5 line-clamp-2">{n.body}</p>
                <p className="text-[10px] text-[#FAF7F0]/25 mt-1">
                  {timeAgo(n.created_at)}
                </p>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
