import { useMutation } from '@tanstack/react-query'
import { KeyRound, LogOut, QrCode, Building2 } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { Link, Navigate, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { getAccessToken, hasStoredCredential, logout, storedClientId } from '../../lib/auth'
import { cn } from '../../lib/utils'
import { Button } from '../ui/button'

const NAV_ITEMS = [
  { to: '/tenants', label: 'Tenants', icon: Building2 },
  { to: '/crypto-keys', label: 'Crypto Keys', icon: KeyRound },
  { to: '/inspector', label: 'Inspector', icon: QrCode },
] as const

export function AppShell() {
  const navigate = useNavigate()
  const clientId = storedClientId()

  const logoutMutation = useMutation({
    mutationFn: logout,
    onSettled: () => navigate('/login', { replace: true }),
  })

  return (
    <div className="flex min-h-svh flex-col">
      {/* Institutional green bar with the Taka-gold rule underneath —
          the spec's BanglaQR identity treatment. */}
      <header className="border-b-2 border-bqr-gold bg-bqr-green text-white">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-6 px-4">
          <Link to="/tenants" className="flex items-center gap-2.5">
            <span className="flex size-7 items-center justify-center rounded bg-white/10">
              <QrCode aria-hidden className="size-4.5" />
            </span>
            <span className="leading-tight">
              <span className="block text-sm font-semibold tracking-wide">SBQR Manager</span>
              <span className="block text-[11px] text-bqr-green-surface/80">
                Internal Operations Portal
                <span aria-hidden className="ml-1 inline-block size-1.5 rounded-full bg-bqr-crimson align-middle" />
              </span>
            </span>
          </Link>

          <nav aria-label="Primary" className="hidden items-center gap-1 sm:flex">
            {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-bqr-green-deep text-white'
                      : 'text-bqr-green-surface/80 hover:bg-bqr-green-deep/60 hover:text-white',
                  )
                }
              >
                <Icon aria-hidden className="size-4" />
                {label}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-3">
            {clientId && (
              <span
                title="Signed-in credential"
                className="hidden font-mono text-xs text-bqr-green-surface/80 md:inline"
              >
                {clientId}
              </span>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="text-bqr-green-surface/80 hover:bg-bqr-green-deep/60 hover:text-white"
              loading={logoutMutation.isPending}
              onClick={() => logoutMutation.mutate()}
            >
              <LogOut aria-hidden className="size-4" />
              Sign out
            </Button>
          </div>
        </div>

        {/* Mobile nav — the desktop bar hides it below sm. */}
        <nav aria-label="Primary mobile" className="flex items-center gap-1 px-4 pb-2 sm:hidden">
          {NAV_ITEMS.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  'rounded-md px-2.5 py-1 text-xs font-medium',
                  isActive ? 'bg-bqr-green-deep text-white' : 'text-bqr-green-surface/80',
                )
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        <Outlet />
      </main>

      <footer className="border-t border-bqr-border py-3">
        <p className="mx-auto max-w-6xl px-4 text-[11px] text-bqr-ink-faint">
          SBQR internal operations — organization use only. API: <code className="font-mono">/v1</code> (same-origin).
        </p>
      </footer>
    </div>
  )
}

/**
 * Gate for authenticated routes. A stored credential (sessionStorage) is
 * proof of a prior login; the mount probe silently re-mints the 10-minute
 * token so the first query fires with a valid Bearer. No credential (or a
 * dead credential) sends the operator to /login, preserving the intended
 * destination for post-login redirect.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const location = useLocation()
  const [state, setState] = useState<'checking' | 'authed' | 'anonymous'>(
    hasStoredCredential() ? 'checking' : 'anonymous',
  )

  useEffect(() => {
    if (!hasStoredCredential()) return
    let cancelled = false
    getAccessToken().then((token) => {
      if (!cancelled) setState(token ? 'authed' : 'anonymous')
    })
    return () => {
      cancelled = true
    }
  }, [])

  if (state === 'anonymous') {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }
  if (state === 'checking') {
    return (
      <div className="flex min-h-svh items-center justify-center bg-bqr-canvas">
        <p className="text-sm text-bqr-ink-faint">Restoring session…</p>
      </div>
    )
  }
  return children
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string
  description?: string
  actions?: ReactNode
}) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold text-bqr-ink">{title}</h1>
        {description && <p className="mt-0.5 text-sm text-bqr-ink-faint">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  )
}
