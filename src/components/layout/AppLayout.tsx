import { Navigate, Outlet, useLocation, NavLink } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { LayoutGrid, Folder, PenLine, Users, Settings } from 'lucide-react'
import { Sidebar } from './Sidebar'
import { useAuth } from '@/contexts/AuthContext'
import { cn } from '@/lib/utils'

const mobileNavItems = [
  { to: '/dashboard', icon: <LayoutGrid size={20} />, label: 'Home' },
  { to: '/draft/notice', icon: <PenLine size={20} />, label: 'Draft' },
  { to: '/documents', icon: <Folder size={20} />, label: 'Docs' },
  { to: '/clients', icon: <Users size={20} />, label: 'Clients' },
  { to: '/settings', icon: <Settings size={20} />, label: 'Settings' },
]

export function AppLayout() {
  const { user, role, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="text-center">
          <div className="w-8 h-8 border border-gold border-t-transparent animate-spin mx-auto mb-4" />
          <p className="text-[12px] text-muted" style={{ fontFamily: 'DM Mono, monospace' }}>
            LOADING...
          </p>
        </div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (role === 'client') {
    return <Navigate to="/client/dashboard" replace />
  }

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Persistent gold top line */}
      <div className="fixed top-0 left-0 right-0 h-[1px] bg-gold/45 z-50" />

      <Sidebar />

      <main className="flex-1 overflow-hidden relative">
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ x: 20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -20, opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="h-full overflow-y-auto pb-16 md:pb-0"
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Mobile bottom navigation */}
      <nav className="fixed bottom-0 left-0 right-0 md:hidden bg-surface border-t border-border z-50 flex">
        {mobileNavItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cn(
                'flex-1 flex flex-col items-center justify-center py-2 gap-0.5 transition-colors',
                isActive ? 'text-gold' : 'text-muted/80'
              )
            }
          >
            {item.icon}
            <span className="text-[9px]" style={{ fontFamily: 'DM Mono, monospace' }}>
              {item.label}
            </span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
