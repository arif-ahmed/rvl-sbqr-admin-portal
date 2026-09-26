// Client-side BanglaQR / EMVCo QRCPS TLV codec for the inspector screen.
// Pure functions — no DOM, no fetch — so the codec is fully unit-testable.
//
// Reference: Bangladesh Bank BanglaQR P2P specification (see
// rvl-secure-bqr-manager docs/bb-banglaqr-p2p-specification.md):
//   - TLV: 2-char numeric id, 2-char numeric length, then that many chars;
//   - CRC: CCITT-FALSE (poly 0x1021, init 0xFFFF) over everything up to and
//     including tag 63's ID + length ("6304"), hex-encoded uppercase.

export interface TlvNode {
  id: string
  name: string
  length: number
  value: string
  children?: TlvNode[]
}

export interface DecodeResult {
  ok: boolean
  error?: string
  tags: TlvNode[]
  /** Present only when tag 63 exists; the recomputed vs. embedded CRC pair. */
  crc?: {
    embedded: string
    computed: string
    valid: boolean
  }
}

/** Tags that carry nested TLV templates. */
const TEMPLATE_TAGS = new Set(['26', '27', '28', '29', '80', '81'])

const TAG_NAMES: Record<string, string> = {
  '00': 'Payload Format Indicator',
  '01': 'Point of Initiation Method',
  '26': 'Merchant Account Information (BB P2P)',
  '27': 'Merchant Account Information (future)',
  '28': 'Merchant Account Information (future)',
  '29': 'Merchant Account Information (future)',
  '51': 'Merchant Server / Phone',
  '52': 'Merchant Category Code',
  '53': 'Transaction Currency',
  '54': 'Transaction Amount',
  '55': 'Tip or Convenience Indicator',
  '58': 'Country Code',
  '59': 'Recipient Name',
  '60': 'Merchant City',
  '61': 'Postal Code / Additional Data',
  '62': 'Additional Data Template',
  '63': 'CRC (Tag 63)',
  '80': 'Signature Part 1 (under bd.org.bb.npsb)',
  '81': 'Signature Part 2 (under bd.org.bb.npsb)',
}

// Sub-tag names inside the BB template (tag 26) and signature parts.
const SUBTAG_NAMES: Record<string, string> = {
  '00': 'Globally Unique Identifier (bd.org.bb.npsb)',
  '01': 'Institution Type (00 Bank, 01 NBFI, 02 MFS, 03 PSP, 04 PSO)',
  '02': 'Institution Code',
  '03': 'Recipient PAN / Account',
  '04': 'MOBILE / Account hint',
}

export function tagName(id: string, nested = false): string {
  if (nested) return SUBTAG_NAMES[id] ?? `Sub-tag ${id}`
  return TAG_NAMES[id] ?? `Tag ${id}`
}

export function decodeTlv(payload: string): DecodeResult {
  const input = payload.trim()
  if (input.length === 0) {
    return { ok: false, error: 'Empty payload', tags: [] }
  }

  // TLV ids and lengths are two numeric chars each; VALUES are alphanumeric
  // (recipient names, city, GUIDs) — charset is validated per field, not on
  // the whole payload.
  const tags: TlvNode[] = []
  let offset = 0
  while (offset < input.length) {
    const remaining = input.length - offset
    if (remaining < 4) {
      return {
        ok: false,
        error: `Truncated header at offset ${offset}: expected id+length (4 chars), found ${remaining}`,
        tags,
      }
    }

    const id = input.slice(offset, offset + 2)
    const lengthText = input.slice(offset + 2, offset + 4)
    if (!/^\d{2}$/.test(id) || !/^\d{2}$/.test(lengthText)) {
      return {
        ok: false,
        error: `Non-numeric id/length at offset ${offset} ("${id}"+"${lengthText}")`,
        tags,
      }
    }

    const length = Number(lengthText)
    offset += 4

    if (offset + length > input.length) {
      return {
        ok: false,
        error: `Tag ${id} declares ${length} chars but only ${input.length - offset} remain`,
        tags,
      }
    }

    const value = input.slice(offset, offset + length)
    offset += length

    tags.push({
      id,
      name: tagName(id),
      length,
      value,
      // Templates parse as nested TLV only when their value is structural
      // (numeric sub-fields); a malformed template degrades to a flat value.
      children: TEMPLATE_TAGS.has(id) && parseNested(value).length > 0 ? parseNested(value) : undefined,
    })
  }

  let crc: DecodeResult['crc']
  const crcTag = tags.find((tag) => tag.id === '63')
  if (crcTag) {
    // CRC is computed over everything through tag 63's "id + length" — i.e.
    // the payload with the 4-char CRC value blanked out.
    const throughLength = input.slice(0, input.length - 4)
    const computed = crc16(throughLength)
    crc = {
      embedded: crcTag.value,
      computed,
      valid: computed === crcTag.value.toUpperCase(),
    }
  }

  return { ok: true, tags, crc }
}

function parseNested(value: string): TlvNode[] {
  const nodes: TlvNode[] = []
  let offset = 0
  while (offset + 4 <= value.length) {
    const id = value.slice(offset, offset + 2)
    const lengthText = value.slice(offset + 2, offset + 4)
    if (!/^\d{2}$/.test(id) || !/^\d{2}$/.test(lengthText)) break
    const length = Number(lengthText)
    offset += 4
    if (offset + length > value.length) break
    nodes.push({
      id,
      name: tagName(id, true),
      length,
      value: value.slice(offset, offset + length),
    })
    offset += length
  }
  return nodes
}

/** CRC-16/CCITT-FALSE (poly 0x1021, init 0xFFFF, no reflection, XOR-out 0). */
export function crc16(input: string): string {
  let crc = 0xffff
  for (let index = 0; index < input.length; index++) {
    crc ^= input.charCodeAt(index) << 8
    for (let bit = 0; bit < 8; bit++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0')
}

/** Build a spec-shaped payload (used by tests to construct valid vectors). */
export function buildPayload(fields: Array<[string, string]>, withCrc = true): string {
  let payload = fields.map(([id, value]) => `${id}${String(value.length).padStart(2, '0')}${value}`).join('')
  if (withCrc) {
    payload += '6304'
    payload += crc16(payload)
  }
  return payload
}
