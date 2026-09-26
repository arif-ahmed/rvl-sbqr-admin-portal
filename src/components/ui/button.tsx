import { Loader2 } from 'lucide-react'
import type { ButtonHTMLAttributes } from 'react'
import { cn } from '../../lib/utils'

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'gold'
type Size = 'sm' | 'md' | 'lg'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
}

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-bqr-green text-white hover:bg-bqr-green-deep active:bg-bqr-green-darkest',
  secondary: 'bg-bqr-green-surface text-bqr-green-deep hover:bg-bqr-green-subtle border border-bqr-green-surface',
  outline: 'border border-bqr-border bg-white text-bqr-ink hover:bg-bqr-canvas',
  ghost: 'text-bqr-ink-soft hover:bg-bqr-canvas hover:text-bqr-ink',
  danger: 'bg-bqr-crimson text-white hover:bg-bqr-crimson-deep',
  gold: 'bg-bqr-gold text-white hover:bg-amber-700',
}

const SIZES: Record<Size, string> = {
  sm: 'h-8 px-3 text-xs gap-1.5',
  md: 'h-9 px-4 text-sm gap-2',
  lg: 'h-11 px-6 text-sm gap-2',
}

export function Button({
  className,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center rounded-md font-medium transition-colors',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-bqr-green',
        'disabled:pointer-events-none disabled:opacity-50',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Loader2 aria-hidden className="size-4 animate-spin" />}
      {children}
    </button>
  )
}
