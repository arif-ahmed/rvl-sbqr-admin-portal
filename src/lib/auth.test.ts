import { describe, expect, it } from 'vitest'
import { decodeScopes } from './auth'

function makeJwt(payload: object): string {
  const encode = (value: string) =>
    btoa(String.fromCodePoint(...new TextEncoder().encode(value)))
      .replaceAll('+', '-')
      .replaceAll('/', '_')
      .replaceAll('=', '')

  return `${encode('{"alg":"HS256","typ":"JWT"}')}.${encode(JSON.stringify(payload))}.signature`
}

describe('decodeScopes', () => {
  it('reads an array scope claim (the issuer\u2019s current serialization)', () => {
    const token = makeJwt({ sub: 'platform:bootstrap-admin', scope: ['admin'] })
    expect(decodeScopes(token)).toEqual(['admin'])
  })

  it('reads a space-separated scope string', () => {
    const token = makeJwt({ sub: 'client:abc', scope: 'qr:generate qr:validate' })
    expect(decodeScopes(token)).toEqual(['qr:generate', 'qr:validate'])
  })

  it('returns empty for a token without scope', () => {
    expect(decodeScopes(makeJwt({ sub: 'x' }))).toEqual([])
  })

  it('returns empty for a malformed token', () => {
    expect(decodeScopes('not-a-jwt')).toEqual([])
  })
})
