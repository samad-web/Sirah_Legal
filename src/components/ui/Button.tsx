import React from 'react'
import { cn } from '@/lib/utils'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'outline' | 'ghost' | 'danger' | 'gold'
  size?: 'sm' | 'md' | 'lg' | 'xl'
  loading?: boolean
  icon?: React.ReactNode
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  children,
  className,
  disabled,
  ...props
}: ButtonProps) {
  const base =
    'inline-flex items-center justify-center gap-2 font-medium transition-all duration-150 select-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed border'

  const variants = {
    primary: 'bg-[#1B3A2D] border-[#1B3A2D] text-[#F5EDD6] hover:bg-[#2a5842] hover:border-[#2a5842]',
    outline: 'bg-transparent border-[rgba(201,168,76,0.5)] text-[#FAF7F0] hover:border-[#C9A84C] hover:bg-[rgba(201,168,76,0.05)]',
    ghost: 'bg-transparent border-transparent text-[rgba(250,247,240,0.6)] hover:text-[#FAF7F0] hover:bg-[#161616]',
    danger: 'bg-transparent border-[rgba(248,113,113,0.4)] text-[#f87171] hover:bg-[rgba(248,113,113,0.1)]',
    gold: 'bg-[#C9A84C] border-[#C9A84C] text-[#0E0E0E] hover:bg-[#d4b558]',
  }

  const sizes = {
    sm: 'h-7 px-3 text-[11px]',
    md: 'h-9 px-4 text-[12px]',
    lg: 'h-11 px-6 text-[13px]',
    xl: 'h-13 px-8 text-[15px]',
  }

  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={cn(base, variants[variant], sizes[size], className)}
      style={{ fontFamily: 'DM Mono, monospace', ...props.style }}
    >
      {loading ? (
        <>
          <span className="w-3.5 h-3.5 border border-current border-t-transparent animate-spin" />
          {children}
        </>
      ) : (
        <>
          {icon && <span>{icon}</span>}
          {children}
        </>
      )}
    </button>
  )
}
