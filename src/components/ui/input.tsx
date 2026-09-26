import * as LabelPrimitive from '@radix-ui/react-label'
import type { InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from 'react'
import { cn } from '../../lib/utils'

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        'h-9 w-full rounded-md border border-bqr-border bg-white px-3 text-sm text-bqr-ink',
        'placeholder:text-bqr-ink-faint',
        'focus:border-bqr-green focus:outline-2 focus:outline-offset-0 focus:outline-bqr-green-surface',
        'disabled:cursor-not-allowed disabled:bg-bqr-canvas disabled:opacity-60',
        className,
      )}
      {...props}
    />
  )
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        'w-full rounded-md border border-bqr-border bg-white px-3 py-2 text-sm text-bqr-ink',
        'placeholder:text-bqr-ink-faint',
        'focus:border-bqr-green focus:outline-2 focus:outline-offset-0 focus:outline-bqr-green-surface',
        className,
      )}
      {...props}
    />
  )
}

export function Field({
  label,
  htmlFor,
  error,
  hint,
  children,
  className,
}: {
  label: string
  htmlFor: string
  error?: string
  hint?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <LabelPrimitive.Label
        htmlFor={htmlFor}
        className="text-sm font-medium text-bqr-ink"
      >
        {label}
      </LabelPrimitive.Label>
      {children}
      {hint && !error && <p className="text-xs text-bqr-ink-faint">{hint}</p>}
      {error && (
        <p role="alert" className="text-xs font-medium text-bqr-crimson">
          {error}
        </p>
      )}
    </div>
  )
}
