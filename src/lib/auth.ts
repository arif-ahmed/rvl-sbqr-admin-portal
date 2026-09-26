// Portal authentication — direct OAuth2 client-credentials against the
// public POST /v1/oauth/token endpoint (the API has no interactive-user
// auth; SBQR.Api stays a pure API with zero portal-specific surface).
//
// Token handling model (agreed):
//   - the access token lives in MEMORY only (10-minute TTL);
//   - the credential is persisted in sessionStorage so expiring tokens can
//     be silently re-minted without bouncing the operator to /login every
//     10 minutes; closing the tab clears it;
//   - logout wipes both.
//
// The credential the operator enters is expected to be the platform
// bootstrap credential (scope `admin`). Tenant FI credentials also work for
// login but their tokens lack `admin`, so the admin screens will answer
// 403 — `currentScopes()` lets the shell surface that immediately.

import type { TokenResponse } from './types'

const CREDENTIAL_KEY = 'sbqr.portal.credential'

export class InvalidCredentialError extends Error {
  constructor(message = 'Invalid client credentials') {
    super(message)
    this.name = 'InvalidCredentialError'
  }
}

interface Credential {
  clientId: string
  clientSecret: string
}

interface TokenState {
  token: string
  expiresAt: number // epoch ms
  scopes: string[]
}

let tokenState: TokenState | null = null
let mintInFlight: Promise<string | null> | null = null

export function storedClientId(): string | null {
  const credential = readCredential()
  return credential?.clientId ?? null
}

export function hasStoredCredential(): boolean {
  return readCredential() !== null
}

/** Scopes carried by the current in-memory token (empty before first mint). */
export function currentScopes(): string[] {
  return tokenState?.scopes ?? []
}

export async function login(clientId: string, clientSecret: string): Promise<void> {
  const token = await mintToken(clientId, clientSecret)
  // Reject before persisting when the credential cannot administer anything.
  if (!token.scopes.includes('admin')) {
    throw new InvalidCredentialError(
      'This credential is valid but has no admin scope — the portal requires the platform bootstrap credential.',
    )
  }
  sessionStorage.setItem(CREDENTIAL_KEY, JSON.stringify({ clientId, clientSecret } satisfies Credential))
  tokenState = token
}

export async function logout(): Promise<void> {
  sessionStorage.removeItem(CREDENTIAL_KEY)
  tokenState = null
}

/**
 * Resolve a usable access token: returns the in-memory token while valid,
 * otherwise silently re-mints from the stored credential. Null means "not
 * authenticated" — callers should send the operator to /login.
 */
export async function getAccessToken(): Promise<string | null> {
  if (tokenState && Date.now() < tokenState.expiresAt - RETRY_SLACK_MS) {
    return tokenState.token
  }

  const credential = readCredential()
  if (!credential) {
    return null
  }

  // Coalesce concurrent callers (react-query refetches fire in bursts) into
  // one token mint; on a rejected credential drop everything and bail.
  mintInFlight ??= mintToken(credential.clientId, credential.clientSecret)
    .then((token) => {
      tokenState = token
      return token.token
    })
    .catch(() => {
      sessionStorage.removeItem(CREDENTIAL_KEY)
      tokenState = null
      return null
    })
    .finally(() => {
      mintInFlight = null
    })

  return mintInFlight
}

/** Force the next getAccessToken() to re-mint (used after an API 401). */
export function invalidateToken(): void {
  tokenState = null
}

const RETRY_SLACK_MS = 30_000

function readCredential(): Credential | null {
  try {
    const raw = sessionStorage.getItem(CREDENTIAL_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<Credential>
    if (typeof parsed.clientId !== 'string' || typeof parsed.clientSecret !== 'string') {
      return null
    }
    return { clientId: parsed.clientId, clientSecret: parsed.clientSecret }
  } catch {
    return null
  }
}

async function mintToken(clientId: string, clientSecret: string): Promise<TokenState> {
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret,
  })

  const response = await fetch('/v1/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })

  if (response.status === 401 || response.status === 400) {
    throw new InvalidCredentialError()
  }
  if (!response.ok) {
    throw new Error(`Token endpoint returned ${response.status}`)
  }

  const payload = (await response.json()) as TokenResponse
  return {
    token: payload.accessToken,
    expiresAt: Date.now() + payload.expiresIn * 1000,
    scopes: decodeScopes(payload.accessToken),
  }
}

/** Read the `scope` claim from the JWT payload (array or space-separated). */
export function decodeScopes(accessToken: string): string[] {
  const segments = accessToken.split('.')
  if (segments.length !== 3) return []
  try {
    const payload = JSON.parse(new TextDecoder().decode(decodeBase64Url(segments[1]))) as {
      scope?: string | string[]
    }
    if (Array.isArray(payload.scope)) return payload.scope
    if (typeof payload.scope === 'string') {
      return payload.scope.split(' ').filter((scope) => scope.length > 0)
    }
    return []
  } catch {
    return []
  }
}

function decodeBase64Url(value: string): Uint8Array {
  const base64 = value.replaceAll('-', '+').replaceAll('_', '/')
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=')
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index++) {
    bytes[index] = binary.charCodeAt(index)
  }
  return bytes
}
