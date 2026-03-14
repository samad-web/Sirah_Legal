import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Sidebar } from './Sidebar'
import { ClientSidebar } from './ClientSidebar'
import { useAuth } from '@/contexts/AuthContext'

export function AppLayout() {
  const { user, loading, isClient } = useAuth()
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

  return (
    <div className="flex h-screen bg-[#0E0E0E] overflow-hidden">
      {/* Persistent gold top line */}
      <div className="fixed top-0 left-0 right-0 h-[1px] bg-[rgba(201,168,76,0.45)] z-50" />

      {isClient ? <ClientSidebar /> : <Sidebar />}

      <main className="flex-1 overflow-hidden relative">
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ x: 20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -20, opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="h-full overflow-y-auto"
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  )
}
