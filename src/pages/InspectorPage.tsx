import { useMutation } from '@tanstack/react-query'
import { ScanLine } from 'lucide-react'
import { useMemo, useState } from 'react'
import { api, ApiError } from '../lib/api'
import { decodeTlv, type TlvNode } from '../lib/banglaqr'
import type { ValidateQrResponse } from '../lib/types'
import { PageHeader } from '../components/layout/AppShell'
import { Alert } from '../components/ui/alert'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { Textarea } from '../components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table'
import { cn } from '../lib/utils'

export default function InspectorPage() {
  const [raw, setRaw] = useState('')
  const [validated, setValidated] = useState<ValidateQrResponse | null>(null)
  const [scopeNotice, setScopeNotice] = useState(false)

  // Client-side decode is instant and unconditional — it never leaves the
  // browser and works without any token scope.
  const decoded = useMemo(() => (raw.trim() ? decodeTlv(raw) : null), [raw])

  const validateMutation = useMutation({
    mutationFn: () => api.qr.validate({ qrPayload: raw.trim() }),
    onSuccess: (result) => {
      setScopeNotice(false)
      setValidated(result)
    },
    onError: (error: ApiError) => {
      // The bootstrap admin token carries scope `admin` only; qr:validate
      // belongs to tenant FI credentials. Explain instead of alarming.
      setScopeNotice(error.status === 403)
      setValidated(null)
    },
  })

  return (
    <div>
      <PageHeader
        title="BanglaQR Inspector"
        description="Live EMVCo TLV parser with CCITT-16 CRC verification and (scope-permitting) server-side Ed25519 signature validation."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Raw payload</CardTitle>
              <CardDescription>Paste a static or dynamic BanglaQR string.</CardDescription>
            </div>
            <ScanLine aria-hidden className="size-5 text-bqr-ink-faint" />
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              aria-label="QR payload"
              rows={6}
              className="font-mono text-xs"
              placeholder="00020101021126…6304ABCD"
              value={raw}
              onChange={(event) => {
                setRaw(event.target.value)
                setValidated(null)
                setScopeNotice(false)
              }}
            />
            <div className="flex items-center gap-2">
              <Button
                disabled={!raw.trim()}
                loading={validateMutation.isPending}
                onClick={() => validateMutation.mutate()}
              >
                Validate server-side
              </Button>
              {raw && (
                <Button variant="ghost" onClick={() => { setRaw(''); setValidated(null) }}>
                  Clear
                </Button>
              )}
            </div>
            <p className="text-[11px] text-bqr-ink-faint">
              Decoding is local. Server validation calls POST /v1/qr/validate, which needs a
              qr:validate-scoped credential (tenant FI client).
            </p>
          </CardContent>
        </Card>

        <div className="space-y-4">
          {decoded && !decoded.ok && (
            <Alert tone="danger" title="Cannot decode payload">
              {decoded.error}
            </Alert>
          )}

          {decoded?.ok && (
            <>
              {decoded.crc ? (
                decoded.crc.valid ? (
                  <Alert tone="success" title="CRC valid">
                    Tag 63 CCITT-16 checksum matches ({decoded.crc.computed}).
                  </Alert>
                ) : (
                  <Alert tone="danger" title="CRC mismatch">
                    Embedded {decoded.crc.embedded || '(empty)'} · recomputed{' '}
                    {decoded.crc.computed}. The payload was modified or truncated.
                  </Alert>
                )
              ) : (
                <Alert tone="warning" title="No CRC tag">
                  Tag 63 is absent — non-conformant for a BanglaQR payload.
                </Alert>
              )}

              {validated && (
                <Card>
                  <CardHeader>
                    <CardTitle>Server verdict</CardTitle>
                    <VerdictBadge verdict={validated.verdict} />
                  </CardHeader>
                  <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
                    <Fact label="Verdict" value={validated.verdict} />
                    <Fact label="Reason code" value={validated.reasonCode ?? '—'} />
                    <Fact label="Institution" value={validated.institutionCode ?? '—'} />
                    <Fact label="Trust source" value={validated.trustSource ?? '—'} />
                    <Fact label="Recipient" value={validated.recipientName ?? '—'} />
                    <Fact label="PAN / account" value={validated.recipientPan ?? '—'} />
                    <Fact label="Classification" value={validated.qrClassification} />
                    <Fact label="Payload hash" value={validated.payloadHash} mono />
                  </CardContent>
                </Card>
              )}

              {scopeNotice && (
                <Alert tone="warning" title="Server validation unavailable with this login">
                  POST /v1/qr/validate requires scope <code className="font-mono">qr:validate</code>,
                  which tenant FI credentials carry and the platform bootstrap credential does
                  not. The local decode above remains fully functional.
                </Alert>
              )}
            </>
          )}
        </div>
      </div>

      {decoded?.ok && decoded.tags.length > 0 && (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle>Decoded tags</CardTitle>
            <CardDescription>
              Top-level TLV; template tags (26/80/81) expand one nesting level.
            </CardDescription>
          </CardHeader>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">Tag</TableHead>
                <TableHead>Name</TableHead>
                <TableHead className="w-16">Len</TableHead>
                <TableHead>Value</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {decoded.tags.flatMap((tag) => [tag, ...(tag.children ?? [])]).map((node, index) => (
                <TlvRow key={`${node.id}-${index}`} node={node} />
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  )
}

function TlvRow({ node }: { node: TlvNode }) {
  const nested = (node.children?.length ?? 0) > 0
  return (
    <TableRow className={cn(nested && 'bg-bqr-canvas/60')}>
      <TableCell className="font-mono text-xs font-semibold text-bqr-green-deep">
        {node.id}
      </TableCell>
      <TableCell className={cn('text-xs', nested && 'pl-8 text-bqr-ink-faint')}>
        {node.name}
      </TableCell>
      <TableCell className="font-mono text-xs">{node.length}</TableCell>
      <TableCell className="max-w-md font-mono text-xs break-all">{node.value || '—'}</TableCell>
    </TableRow>
  )
}

function VerdictBadge({ verdict }: { verdict: string }) {
  const tone =
    verdict === 'Valid' ? 'green' : verdict === 'Rejected' ? 'crimson' : 'gold'
  return <Badge tone={tone}>{verdict}</Badge>
}

function Fact({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-xs text-bqr-ink-faint">{label}</p>
      <p className={cn('break-all text-bqr-ink', mono && 'font-mono text-xs')}>{value}</p>
    </div>
  )
}
