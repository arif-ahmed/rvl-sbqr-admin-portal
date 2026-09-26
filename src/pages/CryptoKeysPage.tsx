import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Copy, KeyRound, RefreshCw, Upload } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api, ApiError } from '../lib/api'
import { formatDateTime } from '../lib/format'
import { PageHeader } from '../components/layout/AppShell'
import { Alert } from '../components/ui/alert'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle, EmptyState } from '../components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../components/ui/dialog'
import { Field, Textarea } from '../components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select'
import {
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table'

export default function CryptoKeysPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  // The URL is the single source of truth for the selected tenant — the
  // Select writes ?tenantId=... and this derives straight from it (also
  // keeps /crypto-keys?tenantId=... deep links from the tenant page live).
  const tenantId = searchParams.get('tenantId') ?? ''

  const onTenantChange = (next: string) => {
    const params = new URLSearchParams(searchParams)
    if (next) params.set('tenantId', next)
    else params.delete('tenantId')
    setSearchParams(params, { replace: true })
  }

  const tenantsQuery = useQuery({
    queryKey: ['tenants', { page: 1, pageSize: 100 }],
    queryFn: () => api.tenants.list({ page: 1, pageSize: 100 }),
  })

  const activeKeyQuery = useQuery({
    queryKey: ['activeKey', tenantId],
    queryFn: () => api.keys.active(tenantId),
    enabled: tenantId !== '',
    retry: false,
  })

  const historyQuery = useQuery({
    queryKey: ['keyHistory', tenantId],
    queryFn: () => api.keys.history(tenantId),
    enabled: tenantId !== '',
  })

  const queryClient = useQueryClient()
  const [error, setError] = useState<string | null>(null)
  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['activeKey', tenantId] })
    void queryClient.invalidateQueries({ queryKey: ['keyHistory', tenantId] })
    void queryClient.invalidateQueries({ queryKey: ['keys'] })
  }

  const rotateMutation = useMutation({
    mutationFn: () => api.keys.rotate(tenantId),
    onSuccess: invalidate,
    onError: (mutationError: ApiError) => setError(mutationError.banner),
  })

  const [adopting, setAdopting] = useState(false)
  const [pem, setPem] = useState('')
  const adoptMutation = useMutation({
    mutationFn: () => api.keys.create({ tenantId, mode: 'Adopt', privateKeyPem: pem.trim() }),
    onSuccess: () => {
      invalidate()
      setAdopting(false)
      setPem('')
    },
    onError: (mutationError: ApiError) => setError(mutationError.banner),
  })

  const tenants = tenantsQuery.data?.items ?? []
  const activeKey = activeKeyQuery.data
  const noKey = (activeKeyQuery.error as ApiError | null)?.status === 404

  return (
    <div>
      <PageHeader
        title="Crypto Keys"
        description="Ed25519 signing-key custody: active key, zero-downtime rotation, and version history."
      />

      <div className="mb-4 w-full max-w-md">
        <Field label="Tenant" htmlFor="key-tenant">
          <Select value={tenantId} onValueChange={onTenantChange}>
            <SelectTrigger id="key-tenant">
              <SelectValue placeholder="Select a tenant…" />
            </SelectTrigger>
            <SelectContent>
              {tenants.map((tenant) => (
                <SelectItem key={tenant.tenantId} value={tenant.tenantId}>
                  {tenant.institutionName} ({tenant.institutionCode})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>

      {!tenantId ? (
        <Card>
          <EmptyState
            title="Pick a tenant"
            description="Select the institution whose signing keys you want to manage."
          />
        </Card>
      ) : (
        <div className="space-y-4">
          {error && <Alert tone="danger">{error}</Alert>}

          <Card>
            <CardHeader>
              <div>
                <CardTitle>Active key</CardTitle>
                <CardDescription>
                  The public half published to the NPSB trust directory; used to verify
                  this FI's QR signatures.
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Button size="sm" loading={rotateMutation.isPending} onClick={() => rotateMutation.mutate()}>
                  <RefreshCw aria-hidden className="size-4" />
                  Rotate
                </Button>
                <Button size="sm" variant="outline" onClick={() => setAdopting(true)}>
                  <Upload aria-hidden className="size-4" />
                  Adopt external key
                </Button>
              </div>
            </CardHeader>

            {activeKeyQuery.isPending ? (
              <CardContent>
                <Skeleton className="h-24 w-full" />
              </CardContent>
            ) : noKey ? (
              <EmptyState
                title="No active key"
                description="This tenant has no signing key yet — mint one from the onboarding wizard or adopt an external key."
              />
            ) : activeKey ? (
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-4">
                  <div>
                    <p className="text-xs text-bqr-ink-faint">Key id</p>
                    <p className="font-mono text-xs break-all text-bqr-ink">{activeKey.keyId}</p>
                  </div>
                  <div>
                    <p className="text-xs text-bqr-ink-faint">Version</p>
                    <p className="text-sm font-semibold text-bqr-ink">v{activeKey.keyVersion}</p>
                  </div>
                  <div>
                    <p className="text-xs text-bqr-ink-faint">Status</p>
                    <Badge tone={activeKey.isActive ? 'green' : 'slate'}>{activeKey.status}</Badge>
                  </div>
                  <div>
                    <p className="text-xs text-bqr-ink-faint">Created</p>
                    <p className="text-sm text-bqr-ink">{formatDateTime(activeKey.createdAt)}</p>
                  </div>
                </div>
                <PemViewer pem={activeKey.publicKeyPem} />
              </CardContent>
            ) : (
              <CardContent>
                <Alert tone="danger">{(activeKeyQuery.error as ApiError)?.banner}</Alert>
              </CardContent>
            )}
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Version history</CardTitle>
              <CardDescription>
                Older versions are retired but retained for verifying previously issued QR
                payloads.
              </CardDescription>
            </CardHeader>
            {historyQuery.isPending ? (
              <CardContent>
                <Skeleton className="h-20 w-full" />
              </CardContent>
            ) : (historyQuery.data?.items ?? []).length === 0 ? (
              <EmptyState title="No key versions yet" />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Version</TableHead>
                    <TableHead>Key id</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(historyQuery.data?.items ?? []).map((key) => (
                    <TableRow key={key.cryptoKeyId}>
                      <TableCell className="font-medium text-bqr-ink">v{key.keyVersion}</TableCell>
                      <TableCell className="font-mono text-xs">{key.keyId}</TableCell>
                      <TableCell>
                        {key.isActive ? (
                          <Badge tone="green">Active</Badge>
                        ) : (
                          <Badge tone="slate">{key.status}</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-xs">{formatDateTime(key.createdAt)}</TableCell>
                      <TableCell className="text-right">
                        <Link
                          to={`/tenants/${key.tenantId}`}
                          className="text-xs font-medium text-bqr-green-deep hover:underline"
                        >
                          Tenant →
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>
        </div>
      )}

      {/* Rotate confirmation is inline via the button; adopt has a dialog. */}
      <AdoptKeyDialog
        open={adopting}
        tenantId={tenantId}
        pem={pem}
        onPemChange={setPem}
        onClose={() => setAdopting(false)}
        busy={adoptMutation.isPending}
        onSubmit={() => adoptMutation.mutate()}
      />
    </div>
  )
}

function PemViewer({ pem }: { pem: string }) {
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    if (!copied) return
    const timer = window.setTimeout(() => setCopied(false), 2000)
    return () => window.clearTimeout(timer)
  }, [copied])

  return (
    <div>
      <p className="mb-1 flex items-center gap-1.5 text-xs text-bqr-ink-faint">
        <KeyRound aria-hidden className="size-3.5" />
        Public key (PEM)
      </p>
      <div className="relative">
        <pre className="overflow-x-auto rounded-md border border-bqr-border bg-bqr-canvas p-3 pr-12 font-mono text-xs text-bqr-ink">
          {pem}
        </pre>
        <Button
          variant="outline"
          size="sm"
          className="absolute top-2 right-2"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(pem)
              setCopied(true)
            } catch {
              /* clipboard unavailable — value stays selectable */
            }
          }}
        >
          {copied ? <Check aria-hidden className="size-3.5 text-bqr-green" /> : <Copy aria-hidden className="size-3.5" />}
          {copied ? 'Copied' : 'Copy'}
        </Button>
      </div>
    </div>
  )
}

function AdoptKeyDialog({
  open,
  tenantId,
  pem,
  onPemChange,
  onClose,
  busy,
  onSubmit,
}: {
  open: boolean
  tenantId: string
  pem: string
  onPemChange: (value: string) => void
  onClose: () => void
  busy: boolean
  onSubmit: () => void
}) {
  return (
    <AdoptDialogShell open={open} onClose={onClose}>
      <Field
        label="Ed25519 private key PEM"
        htmlFor="adopt-pem"
        hint={`Adopt requires the institution's public key to be pre-seeded in the trust directory (POST /v1/admin/institutions) for tenant ${tenantId}.`}
      >
        <Textarea
          id="adopt-pem"
          rows={7}
          className="font-mono text-xs"
          placeholder={'-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----'}
          value={pem}
          onChange={(event) => onPemChange(event.target.value)}
        />
      </Field>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button disabled={!pem.trim()} loading={busy} onClick={onSubmit}>
          <Upload aria-hidden className="size-4" />
          Adopt key
        </Button>
      </div>
    </AdoptDialogShell>
  )
}

function AdoptDialogShell({
  open,
  onClose,
  children,
}: {
  open: boolean
  onClose: () => void
  children: ReactNode
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => (!next ? onClose() : undefined)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adopt external key</DialogTitle>
          <DialogDescription>
            For FIs that keep their Ed25519 private key in an external HSM. The platform
            wraps and vaults the supplied key; rotation afterwards stays server-side.
          </DialogDescription>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  )
}
