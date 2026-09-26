# SBQR Manager — Admin Portal

Internal operations frontend for the [rvl-secure-bqr-manager](https://github.com/Relief-Validation/rvl-secure-bqr-manager)
platform (Bangladesh Bank BanglaQR P2P): tenant (FI) lifecycle, OAuth2 credential
provisioning, Ed25519 key custody, and a live EMVCo QR inspector.

**Frontend-only repo.** The backend is consumed as-is — `SBQR.Api` serves pure API
and keeps zero portal-specific code.

## Stack

- Vite + React 19 + TypeScript
- Tailwind CSS v4 with the BanglaQR palette (Bangladesh Green `#006A4E`, Crimson `#D90429`, Taka Gold `#D97706`)
- Radix UI primitives (hand-rolled shadcn-style components in `src/components/ui`)
- `@tanstack/react-query` v5, `react-hook-form` + `zod`, `lucide-react`
- Vitest (+ Testing Library) for units

## Architecture notes

- **Same-origin only.** The app issues relative requests (`/v1/...`) — no absolute API
  base URL exists in the bundle and the API needs no CORS:
  - **dev** — the Vite server proxy (see `vite.config.ts`) forwards `/v1` and `/openapi`
    to `SBQR_API_URL` (default `http://localhost:5001`, the local SBQR.Api);
  - **prod** — `vercel.json` rewrites forward the same prefixes to the deployed API
    host (same pattern as `rvl-sbqr-app-emulator`). **Replace the
    `SBQR-API-HOST-PLACEHOLDER` destination before the first deploy.**
- **Auth = direct client-credentials.** Login posts to the public
  `POST /v1/oauth/token`. The access token lives in memory (10-min TTL) and is silently
  re-minted from the credential kept in `sessionStorage`; logout wipes both. Only
  `admin`-scoped credentials (platform bootstrap) may sign in — the portal rejects
  others at login.
- **QR validation scope.** `POST /v1/qr/validate` requires `qr:validate` (tenant FI
  credentials), which the bootstrap login lacks. The inspector decodes locally
  (TLV + CRC) unconditionally and explains the 403 when server validation is attempted.

## Develop

Prerequisites: Node 20/22+, and the API running locally (rvl-secure-bqr-manager:
`dotnet run --project src/Host/SBQR.Api`, or its docker-compose).

```bash
npm install
npm run dev          # http://localhost:5174, proxying /v1 to SBQR.Api
```

Login with the platform bootstrap credential (`client_id` `platform-bootstrap`; mint a
secret in the API repo with `dotnet run -- --generate-bootstrap-secret`, hash seeded via
user-secrets/.env).

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Vite dev server (proxied API) |
| `npm run build` | `tsc -b` + production bundle to `dist/` |
| `npm run preview` | Serve the built bundle (proxied API) |
| `npm run test` | Vitest unit tests |
| `npm run lint` | oxlint |

## Screens

- `/login` — operator sign-in (OAuth2 client credential)
- `/tenants` — paged tenant directory with status filters
- `/tenants/new` — 4-step FI onboarding wizard (profile → activation → credential with
  one-time secret → Ed25519 key mint/adopt)
- `/tenants/:id` — tenant 360°: lifecycle actions, credential provisioning, mobile-app
  allow-list, active signing key
- `/crypto-keys` — key custody hub: active key, rotate, adopt external key, history
- `/inspector` — BanglaQR TLV parser + CRC verification + server validation

## Related

- Backend: `rvl-secure-bqr-manager` (SBQR.Api — internal-admin OpenAPI doc at `/docs/internal-admin`)
- Design spec: `rvl-sbqr-docs/internal-ops-portal-nextjs-spec.md`
