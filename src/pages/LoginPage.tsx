import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { login, hasStoredCredential, getAccessToken } from '../lib/auth'
import { QrCode, ShieldCheck } from 'lucide-react'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { useLocation, useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { Alert } from '../components/ui/alert'
import { Button } from '../components/ui/button'
import { Field, Input } from '../components/ui/input'

const loginSchema = z.object({
  clientId: z.string().min(1, 'Client id is required'),
  clientSecret: z.string().min(1, 'Client secret is required'),
})

type LoginForm = z.infer<typeof loginSchema>

export default function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const from =
    (location.state as { from?: string } | null)?.from ??
    '/tenants'

  const {
    register,
    handleSubmit,
    formState: { errors },
    setError,
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { clientId: '', clientSecret: '' },
  })

  const loginMutation = useMutation({
    mutationFn: (form: LoginForm) => login(form.clientId, form.clientSecret),
    onSuccess: () => navigate(from, { replace: true }),
    onError: (error: Error) => {
      setError('clientSecret', {
        message:
          error.message ||
          'Login failed — check the credential and the API connection, then try again.',
      })
    },
  })

  // Operators arriving here with a live session (e.g. manual navigation to
  // /login) go straight through.
  useEffect(() => {
    if (hasStoredCredential()) {
      getAccessToken().then((token) => {
        if (token) navigate(from, { replace: true })
      })
    }
  }, [from, navigate])

  return (
    <div className="flex min-h-svh items-center justify-center bg-bqr-canvas px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <span className="mx-auto mb-3 flex size-12 items-center justify-center rounded-lg border-b-2 border-bqr-gold bg-bqr-green text-white">
            <QrCode aria-hidden className="size-6" />
          </span>
          <h1 className="text-lg font-semibold text-bqr-ink">SBQR Manager</h1>
          <p className="text-sm text-bqr-ink-faint">
            Internal Operations Portal
            <span aria-hidden className="ml-1 inline-block size-1.5 rounded-full bg-bqr-crimson align-middle" />
          </p>
        </div>

        <form
          className="space-y-4 rounded-lg border border-bqr-border bg-white p-6 shadow-xs"
          onSubmit={handleSubmit((form) => loginMutation.mutate(form))}
          noValidate
        >
          <Field label="Client ID" htmlFor="clientId" error={errors.clientId?.message}>
            <Input
              id="clientId"
              autoComplete="username"
              placeholder="platform-bootstrap"
              {...register('clientId')}
            />
          </Field>

          <Field
            label="Client Secret"
            htmlFor="clientSecret"
            error={errors.clientSecret?.message}
          >
            <Input
              id="clientSecret"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••••••"
              {...register('clientSecret')}
            />
          </Field>

          {loginMutation.isError && !errors.clientSecret && (
            <Alert tone="danger">{(loginMutation.error as Error).message}</Alert>
          )}

          <Button type="submit" className="w-full" loading={loginMutation.isPending}>
            Sign in
          </Button>

          <p className="flex items-center justify-center gap-1.5 text-[11px] text-bqr-ink-faint">
            <ShieldCheck aria-hidden className="size-3.5" />
            OAuth2 client credentials — platform bootstrap only. The token lives in
            memory; the credential stays in this tab's session storage.
          </p>
        </form>
      </div>
    </div>
  )
}
