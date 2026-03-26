import { createContext, useContext, useState, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react'
import { cn } from '@/lib/utils'

type ToastType = 'success' | 'error' | 'info'

interface Toast {
  id: string
  type: ToastType
  message: string
  action?: { label: string; onClick: () => void }
}

interface ToastContextType {
  toast: (message: string, type?: ToastType, action?: Toast['action']) => void
  success: (message: string, action?: Toast['action']) => void
  error: (message: string, action?: Toast['action']) => void
  info: (message: string, action?: Toast['action']) => void
}

const ToastContext = createContext<ToastContextType | undefined>(undefined)

const ICONS: Record<ToastType, React.ReactNode> = {
  success: <CheckCircle2 size={16} className="text-[#86efac] shrink-0" />,
  error: <AlertCircle size={16} className="text-red-400 shrink-0" />,
  info: <Info size={16} className="text-[#93c5fd] shrink-0" />,
}

const BORDER_COLORS: Record<ToastType, string> = {
  success: 'border-l-[#86efac]',
  error: 'border-l-red-400',
  info: 'border-l-[#93c5fd]',
}

let idCounter = 0

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  const removeToast = useCallback((id: string) => {
    const timer = timers.current.get(id)
    if (timer) clearTimeout(timer)
    timers.current.delete(id)
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const addToast = useCallback((message: string, type: ToastType = 'info', action?: Toast['action']) => {
    const id = `toast-${++idCounter}`
    setToasts(prev => [...prev.slice(-4), { id, type, message, action }]) // max 5

    const timer = setTimeout(() => removeToast(id), action ? 6000 : 4000)
    timers.current.set(id, timer)
  }, [removeToast])

  const contextValue: ToastContextType = {
    toast: addToast,
    success: useCallback((msg, action) => addToast(msg, 'success', action), [addToast]),
    error: useCallback((msg, action) => addToast(msg, 'error', action), [addToast]),
    info: useCallback((msg, action) => addToast(msg, 'info', action), [addToast]),
  }

  return (
    <ToastContext.Provider value={contextValue}>
      {children}

      {/* Toast container */}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none"
      >
        <AnimatePresence mode="popLayout">
          {toasts.map(t => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, x: 60, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className={cn(
                'pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-lg',
                'bg-[#1a1a1a] border border-[#2a2a2a] border-l-2 shadow-xl',
                'max-w-sm min-w-[280px]',
                BORDER_COLORS[t.type],
              )}
            >
              {ICONS[t.type]}
              <div className="flex-1 min-w-0">
                <p className="text-sm text-[#FAF7F0]/90" style={{ fontFamily: 'Lora, serif' }}>
                  {t.message}
                </p>
                {t.action && (
                  <button
                    onClick={() => { t.action!.onClick(); removeToast(t.id) }}
                    className="mt-1 text-xs text-[#C9A84C] hover:underline"
                    style={{ fontFamily: 'DM Mono, monospace' }}
                  >
                    {t.action.label}
                  </button>
                )}
              </div>
              <button
                onClick={() => removeToast(t.id)}
                className="shrink-0 text-[#FAF7F0]/30 hover:text-[#FAF7F0]/60 transition-colors"
                aria-label="Dismiss"
              >
                <X size={14} />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextType {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}
