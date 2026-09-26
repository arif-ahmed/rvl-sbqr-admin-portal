import { AlertCircle, CheckCircle2, Info, TriangleAlert } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '../../lib/utils'

type Tone = 'info' | 'success' | 'warning' | 'danger'

const TONES: Record<Tone, { wrapper: string; icon: ReactNode }> = {
  info: {
    wrapper: 'border-bqr-green-surface bg-bqr-green-subtle text-bqr-green-deep',
    icon: <Info className="size-4 shrink-0" />,
  },
  success: {
    wrapper: 'border-bqr-green-surface bg-bqr-green-subtle text-bqr-green-deep',
    icon: <CheckCircle2 className="size-4 shrink-0" />,
  },
  warning: {
    wrapper: 'border-amber-200 bg-bqr-gold-subtle text-amber-800',
    icon: <TriangleAlert className="size-4 shrink-0" />,
  },
  danger: {
    wrapper: 'border-bqr-crimson-surface bg-bqr-crimson-subtle text-bqr-crimson-deep',
    icon: <AlertCircle className="size-4 shrink-0" />,
  },
}

export function Alert({
  tone = 'info',
  title,
  children,
  className,
}: {
  tone?: Tone
  title?: string
  children: ReactNode
  className?: string
}) {
  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      className={cn('flex items-start gap-2.5 rounded-md border px-3.5 py-3 text-sm', TONES[tone].wrapper, className)}
    >
      {TONES[tone].icon}
      <div className="space-y-0.5">
        {title && <p className="font-semibold">{title}</p>}
        <div className="[&_a]:underline">{children}</div>
      </div>
    </div>
  )
}
