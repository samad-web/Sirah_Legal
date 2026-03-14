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
        className="flex items-center gap-1 text-[11px] tracking-widest text-[rgba(250,247,240,0.7)] uppercase"
        style={{ fontFamily: 'DM Mono, monospace' }}
      >
        {label}
        {required && <span className="text-[#C9A84C]">*</span>}
      </label>
      {children}
      {hint && (
        <p className="text-[10px] text-[rgba(250,247,240,0.35)]" style={{ fontFamily: 'DM Mono, monospace' }}>
          {hint}
        </p>
      )}
      {error && (
        <p className="text-[10px] text-[#f87171]" style={{ fontFamily: 'DM Mono, monospace' }}>
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
        'w-full h-9 px-3 bg-[#161616] border border-[rgba(201,168,76,0.25)] text-[#FAF7F0]',
        'text-[12px] focus:border-[rgba(201,168,76,0.7)] transition-colors',
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
          'w-full px-3 py-2 bg-[#161616] border border-[rgba(201,168,76,0.25)] text-[#FAF7F0]',
          'text-[12px] focus:border-[rgba(201,168,76,0.7)] transition-colors resize-none',
          className
        )}
        style={{ fontFamily: 'DM Mono, monospace', ...props.style }}
      />
      {showCounter && maxWords && (
        <span
          className={cn(
            'absolute bottom-2 right-2 text-[10px]',
            wordCount > maxWords ? 'text-[#f87171]' : 'text-[rgba(250,247,240,0.3)]'
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
        'w-full h-9 px-3 bg-[#161616] border border-[rgba(201,168,76,0.25)] text-[#FAF7F0]',
        'text-[12px] focus:border-[rgba(201,168,76,0.7)] transition-colors',
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
                ? 'bg-[#1B3A2D] border-[rgba(201,168,76,0.5)] text-[#F5EDD6]'
                : i < current
                ? 'border-transparent text-[rgba(250,247,240,0.5)] hover:text-[#FAF7F0] cursor-pointer'
                : 'border-transparent text-[rgba(250,247,240,0.25)] cursor-not-allowed'
            )}
            style={{ fontFamily: 'DM Mono, monospace' }}
          >
            <span
              className={cn(
                'w-5 h-5 flex items-center justify-center text-[9px] border',
                i === current ? 'border-[#C9A84C] text-[#C9A84C]' : i < current ? 'border-[rgba(201,168,76,0.4)] text-[rgba(201,168,76,0.6)]' : 'border-[rgba(250,247,240,0.2)] text-[rgba(250,247,240,0.25)]'
              )}
            >
              {String(i + 1).padStart(2, '0')}
            </span>
            {step}
          </button>
          {i < steps.length - 1 && (
            <span className="text-[rgba(250,247,240,0.2)] px-1" style={{ fontFamily: 'DM Mono, monospace' }}>
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
          ? 'bg-[#1B3A2D] border-[rgba(201,168,76,0.6)] shadow-[0_0_0_1px_rgba(201,168,76,0.2)]'
          : 'bg-[#161616] border-[rgba(201,168,76,0.2)] hover:border-[rgba(201,168,76,0.4)] hover:bg-[#1c1c1c]',
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p
            className={cn('text-[13px]', selected ? 'text-[#F5EDD6]' : 'text-[#FAF7F0]')}
            style={{ fontFamily: 'Cormorant Garamond, serif', fontWeight: 500 }}
          >
            {title}
          </p>
          {description && (
            <p
              className="text-[11px] text-[rgba(250,247,240,0.45)] mt-1"
              style={{ fontFamily: 'DM Mono, monospace' }}
            >
              {description}
            </p>
          )}
        </div>
        <span
          className={cn(
            'w-4 h-4 border mt-0.5 flex items-center justify-center shrink-0',
            selected ? 'border-[#C9A84C] bg-[#C9A84C]' : 'border-[rgba(201,168,76,0.3)]'
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
