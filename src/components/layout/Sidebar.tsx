import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutGrid,
  FileText,
  PenLine,
  ShieldCheck,
  MapPin,
  Folder,
  Settings,
  LogOut,
  ChevronRight,
  Scale,
  Users,
  Sun,
  Moon,
  CalendarDays,
  MessageSquare,
  Library,
  Calculator,
  Search,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useTheme } from '@/contexts/ThemeContext'
import { cn } from '@/lib/utils'
import { NotificationBell } from '@/components/NotificationBell'

interface NavItem {
  to: string
  icon: React.ReactNode
  label: string
}

const navItems: NavItem[] = [
  { to: '/dashboard', icon: <LayoutGrid size={18} />, label: 'Dashboard' },
  { to: '/calendar', icon: <CalendarDays size={18} />, label: 'Calendar' },
  { to: '/messages', icon: <MessageSquare size={18} />, label: 'Messages' },
  { to: '/draft/notice', icon: <FileText size={18} />, label: 'Draft Notice' },
  { to: '/draft/contract', icon: <PenLine size={18} />, label: 'Draft Contract' },
  { to: '/review/contract', icon: <ShieldCheck size={18} />, label: 'Review Contract' },
  { to: '/draft/title-report', icon: <MapPin size={18} />, label: 'Title Report' },
  { to: '/documents', icon: <Folder size={18} />, label: 'Documents' },
  { to: '/clients', icon: <Users size={18} />, label: 'Manage Clients' },
  { to: '/clauses', icon: <Library size={18} />, label: 'Clause Library' },
  { to: '/stamp-duty', icon: <Calculator size={18} />, label: 'Stamp Duty' },
  { to: '/ecourts', icon: <Search size={18} />, label: 'eCourts' },
]

export function Sidebar() {
  const [expanded, setExpanded] = useState(false)
  const { signOut, profile } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  return (
    <motion.aside
      initial={false}
      animate={{ width: expanded ? 240 : 64 }}
      transition={{ duration: 0.25, ease: 'easeInOut' }}
      className="relative hidden md:flex flex-col h-screen bg-surface border-r border-border overflow-hidden shrink-0 z-10"
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
    >
      {/* Logo */}
      <div className="flex items-center h-14 px-[20px] border-b border-border/70">
        <Scale size={22} className="text-gold shrink-0" />
        <AnimatePresence>
          {expanded && (
            <motion.span
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.15 }}
              className="ml-3 text-foreground text-lg font-medium tracking-wide whitespace-nowrap"
              style={{ fontFamily: 'Cormorant Garamond, serif' }}
            >
              LexDraft
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 space-y-1 px-2">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cn(
                'flex items-center h-9 px-[10px] group transition-all duration-150 relative nav-hover-gold',
                'border border-transparent',
                isActive
                  ? 'bg-forest border-gold-dim text-parchment'
                  : 'text-muted hover:text-foreground hover:bg-surface-2'
              )
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <span className="absolute left-0 top-0 bottom-0 w-[2px] bg-gold" />
                )}
                <span className="shrink-0">{item.icon}</span>
                <AnimatePresence>
                  {expanded && (
                    <motion.span
                      initial={{ opacity: 0, x: -6 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -6 }}
                      transition={{ duration: 0.12 }}
                      className="ml-3 text-[12px] whitespace-nowrap"
                      style={{ fontFamily: 'DM Mono, monospace' }}
                    >
                      {item.label}
                    </motion.span>
                  )}
                </AnimatePresence>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Bottom */}
      <div className="border-t border-border/70 py-2 px-2 space-y-1">
        {/* Notification Bell */}
        <div className="flex items-center h-9 px-[10px]">
          <NotificationBell />
          <AnimatePresence>
            {expanded && (
              <motion.span
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -6 }}
                transition={{ duration: 0.12 }}
                className="ml-3 text-[12px] text-muted whitespace-nowrap"
                style={{ fontFamily: 'DM Mono, monospace' }}
              >
                Notifications
              </motion.span>
            )}
          </AnimatePresence>
        </div>

        <NavLink
          to="/settings"
          className={({ isActive }) =>
            cn(
              'flex items-center h-9 px-[10px] transition-all duration-150',
              'border border-transparent',
              isActive
                ? 'bg-forest border-gold-dim text-parchment'
                : 'text-muted hover:text-foreground hover:bg-surface-2'
            )
          }
        >
          <Settings size={18} className="shrink-0" />
          <AnimatePresence>
            {expanded && (
              <motion.span
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -6 }}
                transition={{ duration: 0.12 }}
                className="ml-3 text-[12px] whitespace-nowrap"
                style={{ fontFamily: 'DM Mono, monospace' }}
              >
                Settings
              </motion.span>
            )}
          </AnimatePresence>
        </NavLink>

        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          className="w-full flex items-center h-9 px-[10px] text-muted hover:text-foreground hover:bg-surface-2 transition-all duration-150 border border-transparent"
        >
          {theme === 'dark'
            ? <Sun size={18} className="shrink-0" />
            : <Moon size={18} className="shrink-0" />}
          <AnimatePresence>
            {expanded && (
              <motion.span
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -6 }}
                transition={{ duration: 0.12 }}
                className="ml-3 text-[12px] whitespace-nowrap"
                style={{ fontFamily: 'DM Mono, monospace' }}
              >
                {theme === 'dark' ? 'LIGHT MODE' : 'DARK MODE'}
              </motion.span>
            )}
          </AnimatePresence>
        </button>

        <button
          onClick={handleSignOut}
          className="w-full flex items-center h-9 px-[10px] text-muted/80 hover:text-red-400 hover:bg-surface-3 transition-all duration-150 border border-transparent"
        >
          <LogOut size={18} className="shrink-0" />
          <AnimatePresence>
            {expanded && (
              <motion.span
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -6 }}
                transition={{ duration: 0.12 }}
                className="ml-3 text-[12px] whitespace-nowrap"
                style={{ fontFamily: 'DM Mono, monospace' }}
              >
                Sign Out
              </motion.span>
            )}
          </AnimatePresence>
        </button>

        {/* Profile hint */}
        <AnimatePresence>
          {expanded && profile && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="px-[10px] py-2 border-t border-border/40 mt-1"
            >
              <p className="text-[11px] text-muted truncate" style={{ fontFamily: 'DM Mono, monospace' }}>
                {profile.full_name || 'Advocate'}
              </p>
              {profile.bar_council_no && (
                <p className="text-[10px] text-gold/60 truncate mt-0.5" style={{ fontFamily: 'DM Mono, monospace' }}>
                  {profile.bar_council_no}
                </p>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Expand hint */}
      <AnimatePresence>
        {!expanded && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.3 }}
            exit={{ opacity: 0 }}
            className="absolute right-1 top-1/2 -translate-y-1/2"
          >
            <ChevronRight size={12} className="text-gold" />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.aside>
  )
}
