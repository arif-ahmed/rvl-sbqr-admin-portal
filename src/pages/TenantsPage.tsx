import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, Plus, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, ApiError } from '../lib/api'
import { TENANT_STATUS_STYLES } from '../lib/format'
import { Alert } from '../components/ui/alert'
import { PageHeader } from '../components/layout/AppShell'
import { Button } from '../components/ui/button'
import { Card, EmptyState } from '../components/ui/card'
import { Input } from '../components/ui/input'
import {
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table'
import { cn } from '../lib/utils'

const STATUS_FILTERS = ['All', 'Active', 'Pending', 'Suspended', 'Terminated'] as const
const PAGE_SIZE = 20

export default function TenantsPage() {
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_FILTERS)[number]>('All')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  const isStatusFilter = statusFilter !== 'All'
  const queryParams = useMemo(
    () => ({
      status: isStatusFilter ? statusFilter : undefined,
      page,
      pageSize: PAGE_SIZE,
    }),
    [isStatusFilter, statusFilter, page],
  )

  const tenantsQuery = useQuery({
    queryKey: ['tenants', queryParams],
    queryFn: () => api.tenants.list(queryParams),
  })

  // Client-side narrowing on top of the server-side status filter — the API
  // has no name/code contains-filter yet, so search matches the current page
  // (kept honest by the page-size cap and the empty-state hint).
  const rows = useMemo(() => {
    const items = tenantsQuery.data?.items ?? []
    const needle = search.trim().toLowerCase()
    if (!needle) return items
    return items.filter(
      (tenant) =>
        tenant.institutionName.toLowerCase().includes(needle) ||
        tenant.institutionCode.toLowerCase().includes(needle),
    )
  }, [tenantsQuery.data, search])

  const data = tenantsQuery.data
  const error = tenantsQuery.error as ApiError | null

  return (
    <div>
      <PageHeader
        title="Tenants"
        description="Financial institutions onboarded to the BanglaQR P2P platform."
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {STATUS_FILTERS.map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => {
                setStatusFilter(status)
                setPage(1)
              }}
              className={cn(
                'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                statusFilter === status
                  ? 'border-bqr-green bg-bqr-green text-white'
                  : 'border-bqr-border bg-white text-bqr-ink-soft hover:bg-bqr-canvas',
              )}
            >
              {status}
            </button>
          ))}
        </div>

        <div className="relative ml-auto w-full sm:w-64">
          <Search
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-bqr-ink-faint"
          />
          <Input
            aria-label="Search this page by name or code"
            placeholder="Filter page by name or code…"
            className="pl-8"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>

        <Link
          to="/tenants/new"
          className="inline-flex h-9 items-center gap-2 rounded-md bg-bqr-green px-4 text-sm font-medium text-white transition-colors hover:bg-bqr-green-deep"
        >
          <Plus aria-hidden className="size-4" />
          Onboard FI
        </Link>
      </div>

      {error && (
        <Alert tone="danger" title={`Failed to load tenants (${error.status})`}>
          {error.banner}
          {error.correlationId && (
            <> Correlation id: <code className="font-mono text-xs">{error.correlationId}</code></>
          )}
        </Alert>
      )}

      <Card>
        {tenantsQuery.isPending ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-10 w-full" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            title={search ? 'No tenants on this page match the filter' : 'No tenants yet'}
            description={
              search
                ? 'Clear the search box or move to another page.'
                : 'Onboard the first financial institution to begin.'
            }
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Institution</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Soft-deleted</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((tenant) => (
                <TableRow key={tenant.tenantId}>
                  <TableCell className="font-medium text-bqr-ink">
                    <Link
                      to={`/tenants/${tenant.tenantId}`}
                      className="hover:text-bqr-green-deep hover:underline"
                    >
                      {tenant.institutionName}
                    </Link>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{tenant.institutionCode}</TableCell>
                  <TableCell>
                    <span
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium',
                        TENANT_STATUS_STYLES[tenant.status].badge,
                      )}
                    >
                      <span
                        aria-hidden
                        className={cn('size-1.5 rounded-full', TENANT_STATUS_STYLES[tenant.status].dot)}
                      />
                      {tenant.status}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs">{tenant.isActive ? 'No' : 'Yes'}</TableCell>
                  <TableCell className="text-right">
                    <Link
                      to={`/tenants/${tenant.tenantId}`}
                      className="text-xs font-medium text-bqr-green-deep hover:underline"
                    >
                      Open →
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {data && (
          <div className="flex items-center justify-between border-t border-bqr-border px-4 py-2.5">
            <p className="text-xs text-bqr-ink-faint">
              Page {data.page} of {Math.max(1, Math.ceil(data.totalCount / data.pageSize))} ·{' '}
              {data.totalCount} tenant{data.totalCount === 1 ? '' : 's'}
            </p>
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1 || tenantsQuery.isFetching}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
              >
                <ChevronLeft aria-hidden className="size-4" />
                Prev
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={!data.hasMore || tenantsQuery.isFetching}
                onClick={() => setPage((current) => current + 1)}
              >
                Next
                <ChevronRight aria-hidden className="size-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
