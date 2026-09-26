import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Ban, CheckCircle2, Play, ShieldAlert, ShieldX } from 'lucide-react'
import { useState } from 'react'
import { api, ApiError } from '../../lib/api'
import type { TenantResponse } from '../../lib/types'
import { Alert } from '../ui/alert'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel_Button,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '../ui/alert-dialog'
import { Button } from '../ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog'
import { Field, Textarea } from '../ui/input'

/**
 * Lifecycle action bar for one tenant, following the aggregate's state
 * machine: Pending → Active, Active ⇄ Suspended, any → Terminated (one-way).
 * Suspend/Terminate require an audit reason; every action refreshes the
 * tenant + list caches through react-query invalidation.
 */
export function LifecycleActions({ tenant }: { tenant: TenantResponse }) {
  const queryClient = useQueryClient()
  const [dialog, setDialog] = useState<'none' | 'suspend' | 'terminate'>('none')

  // Reason text lives in the dialogs; lifted here so the mutation can read it.
  const [reasons, setReasons] = useState<Record<string, string>>({})
  const reasonFor = (action: string) => reasons[action]?.trim() || null
  const setReason = (action: string, value: string) =>
    setReasons((current) => ({ ...current, [action]: value }))

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['tenant', tenant.tenantId] })
    void queryClient.invalidateQueries({ queryKey: ['tenants'] })
    void queryClient.invalidateQueries({ queryKey: ['applications', tenant.tenantId] })
    void queryClient.invalidateQueries({ queryKey: ['activeKey', tenant.tenantId] })
  }

  const actionMutation = useMutation({
    mutationFn: async (action: 'activate' | 'reactivate' | 'suspend' | 'terminate') => {
      switch (action) {
        case 'activate':
          return api.tenants.activate(tenant.tenantId)
        case 'reactivate':
          return api.tenants.reactivate(tenant.tenantId)
        case 'suspend':
          return api.tenants.suspend(tenant.tenantId, { reason: reasonFor('suspend') })
        case 'terminate':
          return api.tenants.terminate(tenant.tenantId, { reason: reasonFor('terminate') })
      }
    },
    onSuccess: invalidate,
    onSettled: () => setDialog('none'),
  })

  const busy = actionMutation.isPending
  const error = actionMutation.error as ApiError | null
  const canActivate = tenant.status === 'Pending'
  const canSuspend = tenant.status === 'Active' || tenant.status === 'Pending'
  const canReactivate = tenant.status === 'Suspended'
  const canTerminate = tenant.status !== 'Terminated'

  return (
    <div className="flex flex-wrap items-center gap-2">
      {canActivate && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="primary" size="sm">
              <Play aria-hidden className="size-4" />
              Activate
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogTitle>Activate {tenant.institutionName}?</AlertDialogTitle>
            <AlertDialogDescription>
              Moves the tenant from Pending to Active. Credential and signing-key state are
              independent and unaffected.
            </AlertDialogDescription>
            <AlertDialogFooter>
              <AlertDialogCancel_Button>Cancel</AlertDialogCancel_Button>
              <AlertDialogAction
                loading={busy}
                onClick={(event) => {
                  event.preventDefault()
                  actionMutation.mutate('activate')
                }}
              >
                Activate
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {canReactivate && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="primary" size="sm">
              <CheckCircle2 aria-hidden className="size-4" />
              Reactivate
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogTitle>Reactivate {tenant.institutionName}?</AlertDialogTitle>
            <AlertDialogDescription>
              Moves the tenant from Suspended back to Active and reinstates its suspended
              client credentials and signing key.
            </AlertDialogDescription>
            <AlertDialogFooter>
              <AlertDialogCancel_Button>Cancel</AlertDialogCancel_Button>
              <AlertDialogAction
                loading={busy}
                onClick={(event) => {
                  event.preventDefault()
                  actionMutation.mutate('reactivate')
                }}
              >
                Reactivate
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {canSuspend && (
        <>
          <Button variant="outline" size="sm" className="text-bqr-crimson-deep" onClick={() => setDialog('suspend')}>
            <Ban aria-hidden className="size-4" />
            Suspend
          </Button>
          <Dialog open={dialog === 'suspend'} onOpenChange={(open) => !open && setDialog('none')}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Suspend {tenant.institutionName}?</DialogTitle>
                <DialogDescription>
                  All tenant API tokens start returning 401 and the signing key is
                  suspended. Reversible via Reactivate.
                </DialogDescription>
              </DialogHeader>
              <Field
                label="Audit reason (required)"
                htmlFor="suspend-reason"
                error={
                  reasons.suspend !== undefined && !reasons.suspend.trim()
                    ? 'A reason is required for the audit trail.'
                    : undefined
                }
              >
                <Textarea
                  id="suspend-reason"
                  rows={3}
                  value={reasons.suspend ?? ''}
                  onChange={(event) => setReason('suspend', event.target.value)}
                  placeholder="e.g. compliance hold pending VAPT remediation"
                />
              </Field>
              {error && <Alert tone="danger">{error.banner}</Alert>}
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialog('none')}>
                  Cancel
                </Button>
                <Button
                  variant="danger"
                  loading={busy}
                  disabled={!(reasons.suspend ?? '').trim()}
                  onClick={() => actionMutation.mutate('suspend')}
                >
                  Suspend tenant
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      )}

      {canTerminate && (
        <>
          <Button variant="outline" size="sm" className="text-bqr-crimson-deep" onClick={() => setDialog('terminate')}>
            <ShieldX aria-hidden className="size-4" />
            Terminate
          </Button>
          <Dialog open={dialog === 'terminate'} onOpenChange={(open) => !open && setDialog('none')}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="text-bqr-crimson-deep">
                  Terminate {tenant.institutionName}?
                </DialogTitle>
                <DialogDescription>
                  This is a one-way terminal action: the tenant is soft-deleted
                  (isActive=false), and its credentials and signing keys are suspended
                  permanently. Reactivation is impossible.
                </DialogDescription>
              </DialogHeader>
              <Field
                label="Audit reason (required)"
                htmlFor="terminate-reason"
                error={
                  reasons.terminate !== undefined && !reasons.terminate.trim()
                    ? 'A reason is required for the audit trail.'
                    : undefined
                }
              >
                <Textarea
                  id="terminate-reason"
                  rows={3}
                  value={reasons.terminate ?? ''}
                  onChange={(event) => setReason('terminate', event.target.value)}
                  placeholder="e.g. FI exited the NPSB scheme"
                />
              </Field>
              {error && <Alert tone="danger">{error.banner}</Alert>}
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialog('none')}>
                  Cancel
                </Button>
                <Button
                  variant="danger"
                  loading={busy}
                  disabled={!(reasons.terminate ?? '').trim()}
                  onClick={() => actionMutation.mutate('terminate')}
                >
                  <ShieldAlert aria-hidden className="size-4" />
                  Terminate permanently
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  )
}
