// Wire types for the SBQR.Api internal-admin surface
// (source: rvl-secure-bqr-manager controllers/contracts, /openapi/v1.internal-admin.json).
// Casings below match the wire exactly — note the tenant-application DTOs use
// snake_case JsonPropertyName overrides while the rest use default camelCase.

export type TenantStatus = 'Pending' | 'Active' | 'Suspended' | 'Terminated'

export interface TenantResponse {
  tenantId: string
  institutionName: string
  institutionCode: string
  status: TenantStatus
  isActive: boolean
}

export interface PagedTenantResponse {
  items: TenantResponse[]
  page: number
  pageSize: number
  totalCount: number
  hasMore: boolean
}

export interface RegisterTenantRequest {
  institutionName: string
  institutionCode: string
}

export interface ProvisionTenantConfigurationRequest {
  isQrGenerationAllowed?: boolean
  isQrValidationAllowed?: boolean
}

export interface ProvisionTenantConfigurationResponse {
  tenantId: string
  credentialId: string
  clientId: string
  /** Shown exactly once — only the Argon2id hash is persisted server-side. */
  clientSecret: string
  expiresAt: string | null
}

export interface LifecycleReasonRequest {
  reason?: string | null
}

export interface TenantApplicationResponse {
  tenant_application_id: string
  tenant_id: string
  platform: 'ANDROID' | 'IOS'
  package_id: string
  status: string
  is_active: boolean
  created_at: string
  modified_at: string | null
}

export interface RegisterTenantApplicationRequest {
  platform: string
  package_id: string
}

export interface CryptoKeySummary {
  cryptoKeyId: string
  tenantId: string
  keyId: string
  keyVersion: number
  publicKeyPem: string
  status: string
  isActive: boolean
  createdAt: string
}

export interface PagedCryptoKeyResponse {
  items: CryptoKeySummary[]
  page: number
  pageSize: number
  totalCount: number
  hasMore: boolean
}

export interface CreateCryptoKeyRequest {
  tenantId: string
  mode: 'Generate' | 'Adopt'
  privateKeyPem?: string | null
}

export interface ValidateQrRequest {
  qrPayload: string
}

export interface ValidateQrResponse {
  verdict: string
  trustSource: string | null
  reasonCode: string | null
  institutionCode: string | null
  payloadHash: string
  recipientName: string | null
  recipientPan: string | null
  qrClassification: string
}

export interface TokenResponse {
  accessToken: string
  tokenType: string
  expiresIn: number
}
