import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, KeyRound, Plus } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api, ApiError } from '../lib/api'
import { formatDateTime, TENANT_STATUS_STYLES } from '../lib/format'
import { PageHeader } from '../components/layout/AppShell'
import { LifecycleActions } from '../components/tenants/LifecycleActions'
import { OneTimeSecretModal } from '../components/tenants/OneTimeSecretModal'
import { Alert } from '../components/ui/alert'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
} from '../components/ui/card'
import { Skeleton } from '../components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs'
import { cn } from '../lib/utils'

export default function TenantDetailPage() {
  const { id = '' } = useParams()

  const tenantQuery = useQuery({
    queryKey: ['tenant', id],
    queryFn: () => api.tenants.get(id),
    enabled: /^[0-9a-f-]{36}$/i.test(id),
  })

  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return <Alert tone="danger">Invalid tenant id.</Alert>
  }

  if (tenantQuery.isPending) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }

  if (tenantQuery.isError) {
    const error = tenantQuery.error as ApiError
    return (
      <div className="space-y-4">
        <Link to="/tenants" className="text-sm text-bqr-green-deep hover:underline">
          ← Back to tenants
        </Link>
        <Alert tone="danger" title={`Failed to load tenant (${error.status})`}>
          {error.banner}
        </Alert>
      </div>
    )
  }

  const tenant = tenantQuery.data

  return (
    <div>
      <Link
        to="/tenants"
        className="mb-3 inline-flex items-center gap-1 text-xs font-medium text-bqr-ink-faint hover:text-bqr-green-deep"
      >
        <ArrowLeft aria-hidden className="size-3.5" />
        All tenants
      </Link>

      <PageHeader
        title={tenant.institutionName}
        description={`Code ${tenant.institutionCode} · ${tenant.tenantId}`}
        actions={<LifecycleActions tenant={tenant} />}
      />

      <div className="mb-5 flex items-center gap-2">
        <span
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold',
            TENANT_STATUS_STYLES[tenant.status].badge,
          )}
        >
          <span aria-hidden className={cn('size-2 rounded-full', TENANT_STATUS_STYLES[tenant.status].dot)} />
          {tenant.status}
        </span>
        {!tenant.isActive && <Badge tone="slate">soft-deleted</Badge>}
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="key">Signing key</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <OverviewTab tenantId={tenant.tenantId} status={tenant.status} />
        </TabsContent>
        <TabsContent value="key">
          <KeyTab tenantId={tenant.tenantId} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function OverviewTab({ tenantId, status }: { tenantId: string; status: string }) {
  const queryClient = useQueryClient()
  const [provisioned, setProvisioned] = useState<Awaited<ReturnType<typeof api.tenants.provisionConfiguration>> | null>(null)

  const provisionMutation = useMutation({
    mutationFn: () =>
      api.tenants.provisionConfiguration(tenantId, {
        isQrGenerationAllowed: true,
        isQrValidationAllowed: true,
      }),
    onSuccess: (result) => setProvisioned(result),
    onSettled: () =>
      void queryClient.invalidateQueries({ queryKey: ['tenant', tenantId] }),
  })

  const mayProvision = status === 'Pending' || status === 'Active'

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div>
            <CardTitle>FI client configuration</CardTitle>
            <CardDescription>
              OAuth2 client credential used by the FI backend at POST /v1/oauth/token.
              Capabilities mint the qr:generate / qr:validate scopes.
            </CardDescription>
          </div>
          <Button
            size="sm"
            disabled={!mayProvision}
            title={mayProvision ? undefined : 'Only Pending/Active tenants can provision'}
            loading={provisionMutation.isPending}
            onClick={() => provisionMutation.mutate()}
          >
            <Plus aria-hidden className="size-4" />
            Provision credential
          </Button>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <div>
            <p className="text-xs text-bqr-ink-faint">QR generation</p>
            <p className="text-sm font-medium text-bqr-ink">Allowed (default)</p>
          </div>
          <div>
            <p className="text-xs text-bqr-ink-faint">QR validation</p>
            <p className="text-sm font-medium text-bqr-ink">Allowed (default)</p>
          </div>
          <div>
            <p className="text-xs text-bqr-ink-faint">Secret storage</p>
            <p className="text-sm font-medium text-bqr-ink">Argon2id hash — shown once at mint</p>
          </div>
        </CardContent>
        {provisionMutation.isError && (
          <CardContent>
            <Alert tone="danger">{(provisionMutation.error as ApiError).banner}</Alert>
          </CardContent>
        )}
      </Card>

      {provisioned && (
        <OneTimeSecretModal result={provisioned} onAcknowledged={() => setProvisioned(null)} />
      )}
    </div>
  )
}

function KeyTab({ tenantId }: { tenantId: string }) {
  const activeKeyQuery = useQuery({
    queryKey: ['activeKey', tenantId],
    queryFn: () => api.keys.active(tenantId),
    // 404 = no key minted yet — a normal state, not an error state.
    retry: false,
  })

  if (activeKeyQuery.isPending) {
    return <Skeleton className="h-40 w-full" />
  }

  if (activeKeyQuery.isError) {
    const error = activeKeyQuery.error as ApiError
    if (error.status === 404) {
      return (
        <Card>
          <EmptyState
            title="No active signing key"
            description="This tenant has no Ed25519 key yet. Mint one from the onboarding wizard or the Crypto Keys hub."
          />
        </Card>
      )
    }
    return <Alert tone="danger">{error.banner}</Alert>
  }

  const key = activeKeyQuery.data

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Active Ed25519 signing key</CardTitle>
          <CardDescription>
            The public half published to the NPSB trust directory. Rotate from the{' '}
            <Link to={`/crypto-keys?tenantId=${tenantId}`} className="text-bqr-green-deep underline">
              Crypto Keys hub
            </Link>
            .
          </CardDescription>
        </div>
        <Badge tone="green">v{key.keyVersion} · Active</Badge>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <p className="text-xs text-bqr-ink-faint">Key id</p>
            <p className="font-mono text-xs break-all text-bqr-ink">{key.keyId}</p>
          </div>
          <div>
            <p className="text-xs text-bqr-ink-faint">Version</p>
            <p className="text-sm font-medium text-bqr-ink">v{key.keyVersion}</p>
          </div>
          <div>
            <p className="text-xs text-bqr-ink-faint">Created</p>
            <p className="text-sm font-medium text-bqr-ink">{formatDateTime(key.createdAt)}</p>
          </div>
        </div>
        <div>
          <p className="mb-1 flex items-center gap-1.5 text-xs text-bqr-ink-faint">
            <KeyRound aria-hidden className="size-3.5" />
            Public key (PEM)
          </p>
          <pre className="overflow-x-auto rounded-md border border-bqr-border bg-bqr-canvas p-3 font-mono text-xs text-bqr-ink">
            {key.publicKeyPem}
          </pre>
        </div>
      </CardContent>
    </Card>
  )
}
