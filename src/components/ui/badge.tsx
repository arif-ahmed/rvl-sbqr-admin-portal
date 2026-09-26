import type { HTMLAttributes } from 'react'
import { cn } from '../../lib/utils'

type Tone = 'green' | 'gold' | 'crimson' | 'slate' | 'outline'

const TONES: Record<Tone, string> = {
  green: 'bg-bqr-green-subtle text-bqr-green-deep border-bqr-green-surface',
  gold: 'bg-bqr-gold-subtle text-bqr-gold border-amber-200',
  crimson: 'bg-bqr-crimson-subtle text-bqr-crimson-deep border-bqr-crimson-surface',
  slate: 'bg-slate-100 text-slate-500 border-slate-200',
  outline: 'bg-white text-bqr-ink-soft border-bqr-border',
}

export function Badge({
  tone = 'outline',
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium',
        TONES[tone],
        className,
      )}
      {...props}
    />
  )
}
