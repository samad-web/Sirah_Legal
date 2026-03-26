import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { AlertTriangle, X } from 'lucide-react'

interface ExportDisclaimerProps {
  open: boolean
  onConfirm: () => void
  onCancel: () => void
  format: 'PDF' | 'DOCX'
}

export function ExportDisclaimer({ open, onConfirm, onCancel, format }: ExportDisclaimerProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={onCancel}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={e => e.stopPropagation()}
            className="w-full max-w-md bg-[#161616] border border-[rgba(201,168,76,0.3)] shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-[rgba(201,168,76,0.15)]">
              <div className="flex items-center gap-2">
                <AlertTriangle size={16} className="text-[#fbbf24]" />
                <h3
                  className="text-[16px] text-[#FAF7F0]"
                  style={{ fontFamily: 'Cormorant Garamond, serif', fontWeight: 500 }}
                >
                  Before you export
                </h3>
              </div>
              <button onClick={onCancel} className="text-[rgba(250,247,240,0.3)] hover:text-[#FAF7F0] transition-colors">
                <X size={16} />
              </button>
            </div>

            {/* Body */}
            <div className="px-5 py-5 space-y-4">
              <div className="p-4 border border-[#fbbf24]/20 bg-[#fbbf24]/5">
                <p className="text-[13px] text-[#FAF7F0]/80 leading-relaxed" style={{ fontFamily: 'Lora, serif' }}>
                  This document was generated with AI assistance. It <strong className="text-[#fbbf24]">must be reviewed
                  and approved by a qualified advocate</strong> before use, filing, or sending to any party.
                </p>
              </div>
              <p className="text-[11px] text-[rgba(250,247,240,0.4)]" style={{ fontFamily: 'DM Mono, monospace' }}>
                By proceeding, you confirm that you have reviewed the document and accept responsibility for its contents.
              </p>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-[rgba(201,168,76,0.15)]">
              <button
                onClick={onCancel}
                className="px-4 py-2 text-[12px] text-[rgba(250,247,240,0.5)] border border-[rgba(250,247,240,0.1)] hover:bg-[rgba(250,247,240,0.05)] transition-colors"
                style={{ fontFamily: 'DM Mono, monospace' }}
              >
                Cancel
              </button>
              <button
                onClick={onConfirm}
                className="px-4 py-2 text-[12px] text-[#0a0a0a] bg-[#C9A84C] hover:bg-[#d4b65c] transition-colors font-medium"
                style={{ fontFamily: 'DM Mono, monospace' }}
              >
                I understand — Download {format}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/** Hook to manage the disclaimer flow before export */
export function useExportDisclaimer() {
  const [state, setState] = useState<{ open: boolean; format: 'PDF' | 'DOCX'; action: (() => void) | null }>({
    open: false,
    format: 'PDF',
    action: null,
  })

  const requestExport = (format: 'PDF' | 'DOCX', action: () => void) => {
    setState({ open: true, format, action })
  }

  const confirm = () => {
    state.action?.()
    setState({ open: false, format: 'PDF', action: null })
  }

  const cancel = () => {
    setState({ open: false, format: 'PDF', action: null })
  }

  return { ...state, requestExport, confirm, cancel }
}
