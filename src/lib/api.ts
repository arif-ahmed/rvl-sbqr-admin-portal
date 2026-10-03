// Typed API client over the SBQR.Api internal-admin surface. All requests
// are same-origin relative paths — the Vite dev proxy (dev) and the
// vercel.json rewrites (prod) forward them to the API host, so no CORS and
// no absolute base URL is ever baked into the bundle.
//
// Errors surface as ApiError carrying the RFC 7807 problem details the API
// already returns (title / detail / errors) plus the X-Correlation-Id the
// correlation middleware stamps on every response.

import { getAccessToken, invalidateToken } from './auth'
import type {
  CreateCryptoKeyRequest,
  CryptoKeySummary,
  LifecycleReasonRequest,
  PagedCryptoKeyResponse,
  PagedTenantResponse,
  ProvisionTenantConfigurationRequest,
  ProvisionTenantConfigurationResponse,
  RegisterTenantRequest,
  TenantResponse,
  ValidateQrRequest,
  ValidateQrResponse,
} from './types'

export class ApiError extends Error {
  readonly status: number
  readonly title: string
  readonly detail?: string
  readonly errors?: Record<string, string[]>
  readonly correlationId?: string

  constructor(init: {
    status: number
    title: string
    detail?: string
    errors?: Record<string, string[]>
    correlationId?: string
  }) {
    super(init.detail || init.title)
    this.name = 'ApiError'
    this.status = init.status
    this.title = init.title
    this.detail = init.detail
    this.errors = init.errors
    this.correlationId = init.correlationId
  }

  /** One-line message suitable for inline banners. */
  get banner(): string {
    const fieldErrors = this.errors
      ? Object.values(this.errors)
          .flat()
          .join(' ')
      : undefined
    return [this.detail, fieldErrors].filter(Boolean).join(' — ') || this.title
  }
}

async function request(path: string, init: RequestInit = {}, retry = true): Promise<Response> {
  const token = await getAccessToken()
  if (!token) {
    throw new ApiError({ status: 401, title: 'Not authenticated' })
  }

  const headers = new Headers(init.headers)
  headers.set('Authorization', `Bearer ${token}`)
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  const response = await fetch(path, { ...init, headers })

  // Expired token between mint and use, or the credential was rotated: force
  // one re-mint and retry once before giving up.
  if (response.status === 401 && retry) {
    invalidateToken()
    return request(path, init, false)
  }

  if (!response.ok) {
    throw await toApiError(response)
  }

  return response
}

async function toApiError(response: Response): Promise<ApiError> {
  let title = `Request failed (${response.status})`
  let detail: string | undefined
  let errors: Record<string, string[]> | undefined

  try {
    const body = (await response.json()) as {
      title?: string
      detail?: string
      errors?: Record<string, string[]>
    }
    title = body.title ?? title
    detail = body.detail
    errors = body.errors
  } catch {
    // Non-JSON error body — keep the generic title.
  }

  return new ApiError({
    status: response.status,
    title,
    detail,
    errors,
    correlationId: response.headers.get('X-Correlation-Id') ?? undefined,
  })
}

function json<T>(response: Response): Promise<T> {
  return response.json() as Promise<T>
}

// ---------------------------------------------------------------------------
// Tenants
// ---------------------------------------------------------------------------

export interface TenantListParams {
  status?: string
  isActive?: boolean
  page?: number
  pageSize?: number
}

export const api = {
  tenants: {
    list: (params: TenantListParams = {}) =>
      request(`/v1/admin/tenants?${new URLSearchParams(cleanParams(params))}`).then(
        json<PagedTenantResponse>,
      ),
    get: (tenantId: string) =>
      request(`/v1/admin/tenants/${tenantId}`).then(json<TenantResponse>),
    register: (body: RegisterTenantRequest) =>
      request('/v1/admin/tenants', { method: 'POST', body: JSON.stringify(body) }).then(
        json<TenantResponse>,
      ),
    activate: (tenantId: string) =>
      request(`/v1/admin/tenants/${tenantId}/activate`, { method: 'POST' }).then(
        json<TenantResponse>,
      ),
    suspend: (tenantId: string, body: LifecycleReasonRequest) =>
      request(`/v1/admin/tenants/${tenantId}/suspend`, {
        method: 'POST',
        body: JSON.stringify(body),
      }).then(json<TenantResponse>),
    reactivate: (tenantId: string) =>
      request(`/v1/admin/tenants/${tenantId}/reactivate`, { method: 'POST' }).then(
        json<TenantResponse>,
      ),
    terminate: (tenantId: string, body: LifecycleReasonRequest) =>
      request(`/v1/admin/tenants/${tenantId}/terminate`, {
        method: 'POST',
        body: JSON.stringify(body),
      }).then(json<TenantResponse>),
    provisionConfiguration: (tenantId: string, body: ProvisionTenantConfigurationRequest = {}) =>
      request(`/v1/admin/tenants/${tenantId}/tenant-configuration`, {
        method: 'POST',
        body: JSON.stringify(body),
      }).then(json<ProvisionTenantConfigurationResponse>),
  },

  keys: {
    list: (page = 1, pageSize = 20) =>
      request(`/v1/crypto-keys?${new URLSearchParams({ page: String(page), pageSize: String(pageSize) })}`).then(
        json<PagedCryptoKeyResponse>,
      ),
    active: (tenantId: string) =>
      request(`/v1/crypto-keys/${tenantId}/active`).then(json<CryptoKeySummary>),
    history: (tenantId: string, page = 1, pageSize = 50) =>
      request(`/v1/crypto-keys/${tenantId}?${new URLSearchParams({ page: String(page), pageSize: String(pageSize) })}`).then(
        json<PagedCryptoKeyResponse>,
      ),
    create: (body: CreateCryptoKeyRequest) =>
      request('/v1/crypto-keys', { method: 'POST', body: JSON.stringify(body) }).then(
        json<CryptoKeySummary>,
      ),
    rotate: (tenantId: string) =>
      request(`/v1/crypto-keys/${tenantId}`, { method: 'PUT' }).then(json<CryptoKeySummary>),
  },

  qr: {
    // NOTE: requires scope `qr:validate` (a tenant FI credential), which the
    // bootstrap admin login lacks — the inspector treats 403 as informational.
    validate: (body: ValidateQrRequest) =>
      request('/v1/qr/validate', { method: 'POST', body: JSON.stringify(body) }).then(
        json<ValidateQrResponse>,
      ),
  },
} as const

function cleanParams(params: object): Record<string, string> {
  const cleaned: Record<string, string> = {}
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue
    cleaned[key] = String(value)
  }
  return cleaned
}
