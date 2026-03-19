import { motion, AnimatePresence } from 'framer-motion'
import { AlertTriangle } from 'lucide-react'
import { Button } from './Button'

interface ConfirmDialogProps {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'DELETE',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.75)' }}
          onClick={e => e.target === e.currentTarget && onCancel()}
        >
          <motion.div
            initial={{ scale: 0.95, y: 12 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, y: 12 }}
            transition={{ duration: 0.15 }}
            className="w-full max-w-sm bg-[#0E0E0E] border border-[rgba(201,168,76,0.25)] p-6"
          >
            <div className="flex items-start gap-3 mb-4">
              <AlertTriangle size={16} className="text-[#f87171] shrink-0 mt-0.5" />
              <div>
                <p className="text-[14px] text-[#FAF7F0] mb-1" style={{ fontFamily: 'Cormorant Garamond, serif' }}>
                  {title}
                </p>
                <p className="text-[11px] text-[rgba(250,247,240,0.45)]" style={{ fontFamily: 'DM Mono, monospace' }}>
                  {message}
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[rgba(201,168,76,0.1)]">
              <Button variant="ghost" size="sm" onClick={onCancel}>
                CANCEL
              </Button>
              <Button variant="danger" size="sm" onClick={onConfirm}>
                {confirmLabel}
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
