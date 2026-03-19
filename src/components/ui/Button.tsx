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
    'inline-flex items-center justify-center gap-2 font-medium transition-all duration-150 select-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed border focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C9A84C]'

  const variants = {
    primary: 'bg-forest border-forest text-parchment hover:bg-forest-light hover:border-forest-light',
    outline: 'bg-transparent border-gold/50 text-foreground hover:border-gold hover:bg-gold-faint',
    ghost: 'bg-transparent border-transparent text-muted hover:text-foreground hover:bg-surface-2',
    danger: 'bg-transparent border-red-400/40 text-red-400 hover:bg-red-400/10',
    gold: 'bg-gold border-gold text-[#0E0E0E] hover:bg-[#d4b558]',
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
