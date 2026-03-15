import { Navigate, Outlet, useLocation, NavLink } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { LayoutGrid, Folder } from 'lucide-react'
import { ClientSidebar } from './ClientSidebar'
import { useAuth } from '@/contexts/AuthContext'
import { cn } from '@/lib/utils'

const clientMobileNav = [
  { to: '/client/dashboard', icon: <LayoutGrid size={20} />, label: 'Home' },
  { to: '/client/documents', icon: <Folder size={20} />, label: 'Documents' },
]

export function ClientLayout() {
  const { user, role, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#0E0E0E]">
        <div className="text-center">
          <div className="w-8 h-8 border border-[#C9A84C] border-t-transparent animate-spin mx-auto mb-4" />
          <p className="text-[12px] text-[rgba(250,247,240,0.5)]" style={{ fontFamily: 'DM Mono, monospace' }}>
            LOADING...
          </p>
        </div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (role !== 'client') {
    return <Navigate to="/dashboard" replace />
  }

  return (
    <div className="flex h-screen bg-[#0E0E0E] overflow-hidden">
      <div className="fixed top-0 left-0 right-0 h-[1px] bg-[rgba(201,168,76,0.45)] z-50" />

      <ClientSidebar />

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
      <nav className="fixed bottom-0 left-0 right-0 md:hidden bg-[#0a0a0a] border-t border-[rgba(201,168,76,0.2)] z-50 flex">
        {clientMobileNav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cn(
                'flex-1 flex flex-col items-center justify-center py-2 gap-0.5 transition-colors',
                isActive ? 'text-[#C9A84C]' : 'text-[rgba(250,247,240,0.4)]'
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
