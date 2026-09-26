import { describe, expect, it } from 'vitest'
import { buildPayload, crc16, decodeTlv } from './banglaqr'

// The canonical EMVCo sample payload carries CRC "63EB" for this prefix
// (000201010212...6304) — but rather than pinning one memorized vector, the
// strongest cheap invariant is: our builder and our verifier agree, and a
// single-digit tamper breaks them. Known-answer test for crc16 uses the
// widely published CCITT-FALSE vector for "123456789" = 0x29B1.
describe('crc16 (CCITT-FALSE)', () => {
  it('matches the published known answer for "123456789"', () => {
    expect(crc16('123456789')).toBe('29B1')
  })

  it('is sensitive to a single character change', () => {
    expect(crc16('000201010211')).not.toBe(crc16('000201010212'))
  })
})

describe('decodeTlv', () => {
  it('decodes a spec-shaped static BanglaQR payload with valid CRC', () => {
    const payload = buildPayload([
      ['00', '01'],
      ['01', '11'],
      ['26', buildPayload([['00', 'bd.org.bb.npsb'], ['01', '00'], ['02', '902601'], ['03', '2101001234567890123']], false)],
      ['52', '4829'],
      ['53', '050'],
      ['58', 'BD'],
      ['59', 'DHAKA BANK PLC'],
      ['60', 'DHAKA'],
    ])

    const result = decodeTlv(payload)

    expect(result.ok).toBe(true)
    expect(result.error).toBeUndefined()
    expect(result.crc?.valid).toBe(true)

    const byId = new Map(result.tags.map((tag) => [tag.id, tag]))
    expect(byId.get('00')?.value).toBe('01')
    expect(byId.get('01')?.value).toBe('11') // static
    expect(byId.get('52')?.value).toBe('4829') // P2P MCC
    expect(byId.get('59')?.value).toBe('DHAKA BANK PLC')

    const template = byId.get('26')
    expect(template?.children).toBeDefined()
    const subById = new Map(template?.children?.map((child) => [child.id, child]) ?? [])
    expect(subById.get('00')?.value).toBe('bd.org.bb.npsb')
    expect(subById.get('03')?.value).toBe('2101001234567890123')
  })

  it('flags a tampered payload as CRC-invalid', () => {
    const payload = buildPayload([
      ['00', '01'],
      ['59', 'DHAKA BANK PLC'],
    ])
    // Keep "6304", corrupt only the 4-char CRC value.
    const tampered = payload.slice(0, -4) + 'FFFF'
    expect(decodeTlv(tampered).crc?.valid).toBe(false)
  })

  it('reports truncation instead of throwing', () => {
    const result = decodeTlv('0002010102')
    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/remain|Truncated/i)
  })

  it('rejects garbage (non-TLV) input', () => {
    expect(decodeTlv('hello world!!').ok).toBe(false)
  })

  it('treats an empty payload as an error', () => {
    expect(decodeTlv('   ').error).toBe('Empty payload')
  })
})
