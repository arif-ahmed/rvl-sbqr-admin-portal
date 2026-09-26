import { Check, Copy, Download, TriangleAlert } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { ProvisionTenantConfigurationResponse } from '../../lib/types'
import { Alert } from '../ui/alert'
import { Button } from '../ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog'

/**
 * Gold-bordered modal displaying a freshly provisioned OAuth2 client
 * credential. The secret crosses the wire exactly once (the API persists
 * only its Argon2id hash) — the operator must copy/download it here.
 */
export function OneTimeSecretModal({
  result,
  onAcknowledged,
}: {
  result: ProvisionTenantConfigurationResponse
  onAcknowledged: () => void
}) {
  const [copied, setCopied] = useState<'none' | 'id' | 'secret' | 'both'>('none')

  useEffect(() => {
    if (copied === 'none') return
    const timer = window.setTimeout(() => setCopied('none'), 2000)
    return () => window.clearTimeout(timer)
  }, [copied])

  const copy = async (value: string, which: 'id' | 'secret') => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied((current) => (current === 'none' ? which : 'both'))
    } catch {
      // Clipboard permission denied — the values remain selectable for
      // manual copy; nothing else to do.
    }
  }

  const download = () => {
    const file = new Blob(
      [
        `SBQR FI OAuth2 client credential\r\n` +
          `tenant      : ${result.tenantId}\r\n` +
          `client_id   : ${result.clientId}\r\n` +
          `client_secret (SHOWN ONCE): ${result.clientSecret}\r\n` +
          `issued      : ${new Date().toISOString()}\r\n` +
          `token url   : POST /v1/oauth/token (grant_type=client_credentials)\r\n`,
      ],
      { type: 'text/plain' },
    )
    const url = URL.createObjectURL(file)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `sbqr-fi-credential-${result.clientId}.txt`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  return (
    <Dialog open onOpenChange={(open) => (!open ? onAcknowledged() : undefined)}>
      <DialogContent className="border-2 border-bqr-gold">
        <DialogHeader>
          <DialogTitle>FI client credential — shown once</DialogTitle>
          <DialogDescription>
            Store the secret in the FI's vault now. The platform keeps only an Argon2id
            hash; it can never be displayed again.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="rounded-md border border-bqr-border bg-bqr-canvas p-3">
            <p className="mb-1 text-xs font-medium text-bqr-ink-faint">client_id</p>
            <div className="flex items-center justify-between gap-2">
              <code className="font-mono text-sm break-all text-bqr-ink">{result.clientId}</code>
              <Button variant="outline" size="sm" onClick={() => copy(result.clientId, 'id')}>
                {copied === 'id' || copied === 'both' ? (
                  <Check aria-hidden className="size-3.5 text-bqr-green" />
                ) : (
                  <Copy aria-hidden className="size-3.5" />
                )}
                Copy
              </Button>
            </div>
          </div>

          <div className="rounded-md border border-bqr-border bg-bqr-canvas p-3">
            <p className="mb-1 text-xs font-medium text-bqr-ink-faint">client_secret</p>
            <div className="flex items-center justify-between gap-2">
              <code className="font-mono text-sm break-all text-bqr-ink">
                {result.clientSecret}
              </code>
              <Button variant="outline" size="sm" onClick={() => copy(result.clientSecret, 'secret')}>
                {copied === 'secret' || copied === 'both' ? (
                  <Check aria-hidden className="size-3.5 text-bqr-green" />
                ) : (
                  <Copy aria-hidden className="size-3.5" />
                )}
                Copy
              </Button>
            </div>
          </div>

          <Alert tone="warning">
            <span className="inline-flex items-center gap-1.5">
              <TriangleAlert aria-hidden className="size-3.5" />
              Losing this secret means re-provisioning the credential. Rotation is a
              future flow — re-provisioning while an active configuration exists returns
              409.
            </span>
          </Alert>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={download}>
            <Download aria-hidden className="size-4" />
            Download
          </Button>
          <Button variant="gold" onClick={onAcknowledged}>
            I stored it — continue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
