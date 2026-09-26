import type { TenantStatus } from './types'

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export const TENANT_STATUS_STYLES: Record<TenantStatus, { badge: string; dot: string }> = {
  Active: {
    badge: 'bg-bqr-green-subtle text-bqr-green-deep border-bqr-green-surface',
    dot: 'bg-bqr-green',
  },
  Pending: {
    badge: 'bg-bqr-gold-subtle text-bqr-gold border-amber-200',
    dot: 'bg-bqr-gold',
  },
  Suspended: {
    badge: 'bg-bqr-crimson-subtle text-bqr-crimson-deep border-bqr-crimson-surface',
    dot: 'bg-bqr-crimson',
  },
  Terminated: {
    badge: 'bg-slate-100 text-slate-500 border-slate-200',
    dot: 'bg-slate-400',
  },
}
