import React from 'react'
import { cn } from '@/lib/utils'

interface FormFieldProps {
  label: string
  required?: boolean
  error?: string
  children: React.ReactNode
  hint?: string
}

export function FormField({ label, required, error, children, hint }: FormFieldProps) {
  return (
    <div className="space-y-1.5">
      <label
        className="flex items-center gap-1 text-[11px] tracking-widest text-muted uppercase"
        style={{ fontFamily: 'DM Mono, monospace' }}
      >
        {label}
        {required && <span className="text-gold">*</span>}
      </label>
      {children}
      {hint && (
        <p className="text-[10px] text-muted/70" style={{ fontFamily: 'DM Mono, monospace' }}>
          {hint}
        </p>
      )}
      {error && (
        <p className="text-[10px] text-red-400" style={{ fontFamily: 'DM Mono, monospace' }}>
          {error}
        </p>
      )}
    </div>
  )
}

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  className?: string
}

export function Input({ className, ...props }: InputProps) {
  return (
    <input
      {...props}
      className={cn(
        'w-full h-9 px-3 bg-surface-2 border border-border text-foreground',
        'text-[12px] focus:border-gold/70 transition-colors',
        className
      )}
      style={{ fontFamily: 'DM Mono, monospace', ...props.style }}
    />
  )
}

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  className?: string
  showCounter?: boolean
  maxWords?: number
}

export function Textarea({ className, showCounter, maxWords, value, ...props }: TextareaProps) {
  const wordCount = value ? String(value).trim().split(/\s+/).filter(Boolean).length : 0
  return (
    <div className="relative">
      <textarea
        {...props}
        value={value}
        className={cn(
          'w-full px-3 py-2 bg-surface-2 border border-border text-foreground',
          'text-[12px] focus:border-gold/70 transition-colors resize-none',
          className
        )}
        style={{ fontFamily: 'DM Mono, monospace', ...props.style }}
      />
      {showCounter && maxWords && (
        <span
          className={cn(
            'absolute bottom-2 right-2 text-[10px]',
            wordCount > maxWords ? 'text-red-400' : 'text-muted/60'
          )}
          style={{ fontFamily: 'DM Mono, monospace' }}
        >
          {wordCount}/{maxWords}
        </span>
      )}
    </div>
  )
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  options: { value: string; label: string }[]
  placeholder?: string
}

export function Select({ options, placeholder, className, ...props }: SelectProps) {
  return (
    <select
      {...props}
      className={cn(
        'w-full h-9 px-3 bg-surface-2 border border-border text-foreground',
        'text-[12px] focus:border-gold/70 transition-colors',
        className
      )}
      style={{ fontFamily: 'DM Mono, monospace', ...props.style }}
    >
      {placeholder && <option value="">{placeholder}</option>}
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  )
}

interface ProgressStepsProps {
  steps: string[]
  current: number
  onStepClick?: (index: number) => void
}

export function ProgressSteps({ steps, current, onStepClick }: ProgressStepsProps) {
  return (
    <div className="flex items-center gap-0">
      {steps.map((step, i) => (
        <React.Fragment key={i}>
          <button
            onClick={() => onStepClick?.(i)}
            disabled={i > current}
            className={cn(
              'flex items-center gap-2 px-3 py-1.5 text-[11px] border transition-all',
              i === current
                ? 'bg-forest border-gold-dim text-parchment'
                : i < current
                ? 'border-transparent text-muted hover:text-foreground cursor-pointer'
                : 'border-transparent text-muted/50 cursor-not-allowed'
            )}
            style={{ fontFamily: 'DM Mono, monospace' }}
          >
            <span
              className={cn(
                'w-5 h-5 flex items-center justify-center text-[9px] border',
                i === current
                  ? 'border-gold text-gold'
                  : i < current
                  ? 'border-gold/40 text-gold/60'
                  : 'border-muted/40 text-muted/50'
              )}
            >
              {String(i + 1).padStart(2, '0')}
            </span>
            {step}
          </button>
          {i < steps.length - 1 && (
            <span className="text-muted/40 px-1" style={{ fontFamily: 'DM Mono, monospace' }}>
              →
            </span>
          )}
        </React.Fragment>
      ))}
    </div>
  )
}

interface SelectionCardProps {
  selected: boolean
  onClick: () => void
  title: string
  description?: string
  className?: string
}

export function SelectionCard({ selected, onClick, title, description, className }: SelectionCardProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'text-left w-full p-4 border transition-all duration-150',
        selected
          ? 'bg-forest border-gold/60 shadow-[0_0_0_1px_rgba(201,168,76,0.2)]'
          : 'bg-surface-2 border-border hover:border-gold/40 hover:bg-surface-3',
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p
            className={cn('text-[13px]', selected ? 'text-parchment' : 'text-foreground')}
            style={{ fontFamily: 'Cormorant Garamond, serif', fontWeight: 500 }}
          >
            {title}
          </p>
          {description && (
            <p
              className="text-[11px] text-muted mt-1"
              style={{ fontFamily: 'DM Mono, monospace' }}
            >
              {description}
            </p>
          )}
        </div>
        <span
          className={cn(
            'w-4 h-4 border mt-0.5 flex items-center justify-center shrink-0',
            selected ? 'border-gold bg-gold' : 'border-gold/30'
          )}
        >
          {selected && (
            <svg width="8" height="6" viewBox="0 0 8 6" fill="none">
              <path d="M1 3L3 5L7 1" stroke="#0E0E0E" strokeWidth="1.5" strokeLinecap="square" />
            </svg>
          )}
        </span>
      </div>
    </button>
  )
}
