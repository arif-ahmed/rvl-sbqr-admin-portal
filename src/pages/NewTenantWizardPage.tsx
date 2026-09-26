import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, ArrowRight, Check, KeyRound, PartyPopper } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { api, ApiError } from '../lib/api'
import type { ProvisionTenantConfigurationResponse, TenantResponse } from '../lib/types'
import { PageHeader } from '../components/layout/AppShell'
import { OneTimeSecretModal } from '../components/tenants/OneTimeSecretModal'
import { Alert } from '../components/ui/alert'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Card, CardContent } from '../components/ui/card'
import { Field, Input, Textarea } from '../components/ui/input'
import { Switch } from '../components/ui/switch'
import { cn } from '../lib/utils'

const STEPS = [
  { title: 'Profile', caption: 'Institution identity' },
  { title: 'Activation', caption: 'Pending → Active' },
  { title: 'Credentials', caption: 'OAuth2 client secret' },
  { title: 'Signing key', caption: 'Ed25519 mint / adopt' },
] as const

const profileSchema = z.object({
  institutionName: z.string().min(2, 'Institution name is required'),
  institutionCode: z
    .string()
    .regex(/^[0-9]{6}$/, 'Institution code must be exactly 6 digits'),
})

type ProfileForm = z.infer<typeof profileSchema>

export default function NewTenantWizardPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState(0)

  const [tenant, setTenant] = useState<TenantResponse | null>(null)
  const [autoActivate, setAutoActivate] = useState(true)
  const [allowGenerate, setAllowGenerate] = useState(true)
  const [allowValidate, setAllowValidate] = useState(true)
  const [credential, setCredential] = useState<ProvisionTenantConfigurationResponse | null>(null)
  const [keyMode, setKeyMode] = useState<'Generate' | 'Adopt'>('Generate')
  const [privateKeyPem, setPrivateKeyPem] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busyAction, setBusyAction] = useState<string | null>(null)

  const profileForm = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: { institutionName: '', institutionCode: '' },
  })

  const run = async <T,>(action: string, fn: () => Promise<T>): Promise<T | null> => {
    setError(null)
    setBusyAction(action)
    try {
      return await fn()
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.banner : String(caught))
      return null
    } finally {
      setBusyAction(null)
    }
  }

  const submitProfile = profileForm.handleSubmit(async (form) => {
    const created = await run('profile', () =>
      api.tenants.register({
        institutionName: form.institutionName.trim(),
        institutionCode: form.institutionCode,
      }),
    )
    if (created) {
      setTenant(created)
      setStep(1)
    }
  })

  const doActivation = async () => {
    if (!tenant) return
    if (autoActivate) {
      const activated = await run('activate', () => api.tenants.activate(tenant.tenantId))
      if (activated) setTenant(activated)
    }
    setStep(2)
  }

  const doCredentials = async () => {
    if (!tenant) return
    const provisioned = await run('credentials', () =>
      api.tenants.provisionConfiguration(tenant.tenantId, {
        isQrGenerationAllowed: allowGenerate,
        isQrValidationAllowed: allowValidate,
      }),
    )
    if (provisioned) setCredential(provisioned)
    // The one-time-secret modal's "continue" advances to the key step.
  }

  const doKey = async () => {
    if (!tenant) return
    const minted = await run('key', () =>
      api.keys.create({
        tenantId: tenant.tenantId,
        mode: keyMode,
        privateKeyPem: keyMode === 'Adopt' ? privateKeyPem.trim() : null,
      }),
    )
    if (minted) setStep(4)
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        to="/tenants"
        className="mb-3 inline-flex items-center gap-1 text-xs font-medium text-bqr-ink-faint hover:text-bqr-green-deep"
      >
        <ArrowLeft aria-hidden className="size-3.5" />
        All tenants
      </Link>

      <PageHeader
        title="FI Onboarding Wizard"
        description="Register the institution, activate, provision OAuth2 credentials, and mint its Ed25519 signing key."
      />

      {/* Stepper */}
      <ol className="mb-6 flex items-center gap-1.5">
        {STEPS.map((definition, index) => {
          const state =
            step > index ? 'done' : step === index ? 'current' : 'todo'
          return (
            <li key={definition.title} className="flex flex-1 items-center gap-1.5">
              <span
                className={cn(
                  'flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
                  state === 'done' && 'bg-bqr-green text-white',
                  state === 'current' && 'border-2 border-bqr-green text-bqr-green-deep',
                  state === 'todo' && 'border border-bqr-border text-bqr-ink-faint',
                )}
              >
                {state === 'done' ? <Check aria-hidden className="size-3.5" /> : index + 1}
              </span>
              <span className="hidden min-w-0 sm:block">
                <span
                  className={cn(
                    'block truncate text-xs font-medium',
                    state === 'todo' ? 'text-bqr-ink-faint' : 'text-bqr-ink',
                  )}
                >
                  {definition.title}
                </span>
                <span className="block truncate text-[10px] text-bqr-ink-faint">{definition.caption}</span>
              </span>
              {index < STEPS.length - 1 && <span aria-hidden className="h-px flex-1 bg-bqr-border" />}
            </li>
          )
        })}
      </ol>

      {error && (
        <Alert tone="danger" className="mb-4" title="The API rejected this step">
          {error}
        </Alert>
      )}

      {/* Step 1 — Profile */}
      {step === 0 && (
        <Card>
          <CardContent className="space-y-4">
            <Field
              label="Institution name"
              htmlFor="institutionName"
              error={profileForm.formState.errors.institutionName?.message}
            >
              <Input
                id="institutionName"
                placeholder="e.g. Dhaka Bank PLC"
                {...profileForm.register('institutionName')}
              />
            </Field>
            <Field
              label="Institution code"
              htmlFor="institutionCode"
              hint="6-digit NPSB institution code."
              error={profileForm.formState.errors.institutionCode?.message}
            >
              <Input
                id="institutionCode"
                inputMode="numeric"
                placeholder="902601"
                {...profileForm.register('institutionCode')}
              />
            </Field>
          </CardContent>
          <div className="flex justify-end border-t border-bqr-border px-5 py-3">
            <Button loading={busyAction === 'profile'} onClick={submitProfile}>
              Create tenant <ArrowRight aria-hidden className="size-4" />
            </Button>
          </div>
        </Card>
      )}

      {/* Step 2 — Activation */}
      {step === 1 && tenant && (
        <Card>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              <Badge tone="gold">{tenant.status}</Badge>
              <span className="text-sm text-bqr-ink-soft">{tenant.institutionName}</span>
            </div>
            <label className="flex items-start gap-3 rounded-md border border-bqr-border bg-bqr-canvas p-3">
              <Switch checked={autoActivate} onCheckedChange={setAutoActivate} />
              <span>
                <span className="block text-sm font-medium text-bqr-ink">
                  Activate immediately
                </span>
                <span className="block text-xs text-bqr-ink-faint">
                  Moves the tenant from Pending to Active via POST /activate. Leave off to
                  keep it Pending until the trust-store preconditions are verified.
                </span>
              </span>
            </label>
          </CardContent>
          <div className="flex justify-between border-t border-bqr-border px-5 py-3">
            <Button variant="outline" onClick={() => setStep(0)}>
              <ArrowLeft aria-hidden className="size-4" /> Back
            </Button>
            <Button loading={busyAction === 'activate'} onClick={doActivation}>
              Continue <ArrowRight aria-hidden className="size-4" />
            </Button>
          </div>
        </Card>
      )}

      {/* Step 3 — Credentials */}
      {step === 2 && tenant && (
        <Card>
          <CardContent className="space-y-4">
            <p className="text-sm text-bqr-ink-soft">
              Provisions the FI's OAuth2 client credential — the secret is displayed{' '}
              <strong>exactly once</strong> after minting.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex items-start gap-3 rounded-md border border-bqr-border bg-bqr-canvas p-3">
                <Switch checked={allowGenerate} onCheckedChange={setAllowGenerate} />
                <span>
                  <span className="block text-sm font-medium text-bqr-ink">QR generation</span>
                  <span className="block text-xs text-bqr-ink-faint">scope qr:generate</span>
                </span>
              </label>
              <label className="flex items-start gap-3 rounded-md border border-bqr-border bg-bqr-canvas p-3">
                <Switch checked={allowValidate} onCheckedChange={setAllowValidate} />
                <span>
                  <span className="block text-sm font-medium text-bqr-ink">QR validation</span>
                  <span className="block text-xs text-bqr-ink-faint">scope qr:validate</span>
                </span>
              </label>
            </div>
          </CardContent>
          <div className="flex justify-between border-t border-bqr-border px-5 py-3">
            <Button variant="outline" onClick={() => setStep(1)}>
              <ArrowLeft aria-hidden className="size-4" /> Back
            </Button>
            <Button
              disabled={!(tenant.status === 'Pending' || tenant.status === 'Active')}
              loading={busyAction === 'credentials'}
              onClick={doCredentials}
            >
              Provision credential <KeyRound aria-hidden className="size-4" />
            </Button>
          </div>
        </Card>
      )}

      {/* One-time secret gates entry to step 4 */}
      {credential && (
        <OneTimeSecretModal
          result={credential}
          onAcknowledged={() => {
            setCredential(null)
            setStep(3)
          }}
        />
      )}

      {/* Step 4 — Signing key */}
      {step === 3 && tenant && (
        <Card>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              {(['Generate', 'Adopt'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setKeyMode(mode)}
                  className={cn(
                    'flex-1 rounded-md border px-3 py-2.5 text-left transition-colors',
                    keyMode === mode
                      ? 'border-bqr-green bg-bqr-green-subtle'
                      : 'border-bqr-border bg-white hover:bg-bqr-canvas',
                  )}
                >
                  <span className="block text-sm font-medium text-bqr-ink">
                    {mode === 'Generate' ? 'Generate keypair' : 'Adopt external key'}
                  </span>
                  <span className="block text-xs text-bqr-ink-faint">
                    {mode === 'Generate'
                      ? 'Platform mints a fresh Ed25519 keypair (HSM/vault custody).'
                      : 'FI-supplied Ed25519 private key PEM (requires a pre-seeded institution public key).'}
                  </span>
                </button>
              ))}
            </div>

            {keyMode === 'Adopt' && (
              <Field
                label="Private key PEM"
                htmlFor="privateKeyPem"
                hint="The public half must already exist in the trust directory (POST /v1/admin/institutions)."
              >
                <Textarea
                  id="privateKeyPem"
                  rows={6}
                  className="font-mono text-xs"
                  placeholder={'-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----'}
                  value={privateKeyPem}
                  onChange={(event) => setPrivateKeyPem(event.target.value)}
                />
              </Field>
            )}
          </CardContent>
          <div className="flex justify-between border-t border-bqr-border px-5 py-3">
            <Button variant="outline" onClick={() => setStep(2)}>
              <ArrowLeft aria-hidden className="size-4" /> Back
            </Button>
            <Button
              loading={busyAction === 'key'}
              disabled={keyMode === 'Adopt' && !privateKeyPem.trim()}
              onClick={doKey}
            >
              {keyMode === 'Generate' ? 'Mint Ed25519 key' : 'Adopt key'}
            </Button>
          </div>
        </Card>
      )}

      {/* Done */}
      {step === 4 && tenant && (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
            <span className="flex size-11 items-center justify-center rounded-full bg-bqr-green-subtle text-bqr-green-deep">
              <PartyPopper aria-hidden className="size-5" />
            </span>
            <p className="text-base font-semibold text-bqr-ink">
              {tenant.institutionName} is onboarded
            </p>
            <p className="max-w-md text-sm text-bqr-ink-soft">
              Credential issued, signing key active. The public half is published to the
              NPSB trust directory by the platform.
            </p>
            <div className="mt-2 flex gap-2">
              <Button onClick={() => navigate(`/tenants/${tenant.tenantId}`)}>
                Open tenant 360° <ArrowRight aria-hidden className="size-4" />
              </Button>
              <Button variant="outline" onClick={() => navigate('/tenants')}>
                Back to directory
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
