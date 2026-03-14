import { useState } from 'react'
import { Calendar } from 'lucide-react'
import { Button } from './Button'

interface DateConfirmModalProps {
  onConfirm: (date: string) => void
  onCancel: () => void
}

function todayISO(): string {
  const d = new Date()
  // Format as YYYY-MM-DD in local time (not UTC)
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

export function formatDisplayDate(iso: string): string {
  if (!iso) return ''
  const [year, month, day] = iso.split('-').map(Number)
  const d = new Date(year, month - 1, day)
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })
}

export function DateConfirmModal({ onConfirm, onCancel }: DateConfirmModalProps) {
  const [date, setDate] = useState(todayISO())
  const [error, setError] = useState('')

  const handleConfirm = () => {
    if (!date) {
      setError('Please select a date.')
      return
    }
    const [year, month, day] = date.split('-').map(Number)
    const d = new Date(year, month - 1, day)
    if (isNaN(d.getTime())) {
      setError('Invalid date. Please enter a valid date.')
      return
    }
    setError('')
    onConfirm(formatDisplayDate(date))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div
        className="w-[400px] bg-[#0f0f0f] border border-[rgba(201,168,76,0.3)] rounded-sm shadow-2xl"
        style={{ boxShadow: '0 0 60px rgba(201,168,76,0.08)' }}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-[rgba(201,168,76,0.15)] flex items-center gap-3">
          <Calendar size={16} className="text-[#C9A84C]" />
          <div>
            <h2
              className="text-[20px] text-[#FAF7F0]"
              style={{ fontFamily: 'Cormorant Garamond, serif', fontWeight: 400 }}
            >
              Confirm Document Date
            </h2>
            <p
              className="text-[10px] text-[rgba(201,168,76,0.6)] tracking-widest mt-0.5"
              style={{ fontFamily: 'DM Mono, monospace' }}
            >
              REQUIRED BEFORE GENERATION
            </p>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          <p
            className="text-[12px] text-[rgba(250,247,240,0.5)] mb-5 leading-relaxed"
            style={{ fontFamily: 'DM Mono, monospace' }}
          >
            Select the date to be printed in the generated document. Defaults to today's date.
          </p>

          <label
            className="block text-[11px] text-[rgba(201,168,76,0.8)] mb-2 tracking-widest"
            style={{ fontFamily: 'DM Mono, monospace' }}
          >
            DOCUMENT DATE
          </label>
          <input
            type="date"
            value={date}
            onChange={e => {
              setDate(e.target.value)
              setError('')
            }}
            className="w-full bg-[#1a1a1a] border border-[rgba(201,168,76,0.2)] rounded-sm px-3 py-2.5 text-[13px] text-[#FAF7F0] focus:outline-none focus:border-[rgba(201,168,76,0.6)] transition-colors"
            style={{ fontFamily: 'DM Mono, monospace', colorScheme: 'dark' }}
          />

          {error && (
            <p
              className="mt-2 text-[11px] text-[#f87171]"
              style={{ fontFamily: 'DM Mono, monospace' }}
            >
              {error}
            </p>
          )}

          {date && !error && (
            <p
              className="mt-2 text-[12px] text-[rgba(201,168,76,0.7)]"
              style={{ fontFamily: 'Lora, serif', fontStyle: 'italic' }}
            >
              {formatDisplayDate(date)}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[rgba(201,168,76,0.15)] flex justify-end gap-3">
          <Button variant="ghost" size="sm" onClick={onCancel}>
            CANCEL
          </Button>
          <Button variant="primary" size="sm" onClick={handleConfirm}>
            CONFIRM & GENERATE
          </Button>
        </div>
      </div>
    </div>
  )
}
