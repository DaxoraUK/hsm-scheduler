# Ground Control production-like staging runbook

## Purpose

Staging must behave like production without containing live production secrets or relying on developer-only browser configuration. A green local build is not enough to close a launch gate.

## Required environments

- **Local development:** developer machine and development data only.
- **Staging:** separate Supabase project, staging domain, staging authentication redirects, staging storage and test billing configuration.
- **Production:** created only after the staging gates and controlled pilot are accepted.

## Pre-deployment checks

1. Confirm `.env`, `.env.local` and environment-specific local files are not tracked by Git.
2. Rotate credentials previously committed to repository history.
3. Apply all migrations to the staging Supabase project only.
4. Confirm `VITE_APP_ENVIRONMENT=staging`.
5. Assign a unique `VITE_APP_RELEASE` value.
6. Enable sanitised client monitoring.
7. Run `npm run release:evidence` and retain the generated artifact.
8. Push only after the release evidence result is PASS.

## Deployment

The included `vercel.json` provides the Vite build, SPA fallback and baseline security headers. Configure these values in the staging hosting project:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_APP_ENVIRONMENT=staging`
- `VITE_APP_RELEASE`
- `VITE_MONITORING_ENABLED=true`
- `VITE_OPEN_METEO_PROXY_URL` when the server-side weather proxy exists

Never place a Supabase service-role key, Stripe secret or webhook secret in a `VITE_` variable.

## Post-deployment smoke test

Run:

```powershell
$env:STAGING_URL="https://YOUR-STAGING-DOMAIN"
$env:RELEASE_ID="ground-control-staging-YYYY.MM.DD.N"
npm run smoke:staging
```

The smoke test checks HTTPS, the application mount point, example placeholders and baseline security headers. Upload the `.release-evidence` output as a protected CI artifact or to an approved internal evidence location. Record the resulting HTTPS link against the **Staging smoke test passed over HTTPS** gate.

## Manual staging checks

Record a separate structured evidence item for each result:

- Sign in, refresh and sign out.
- Password recovery redirect.
- Direct page refresh and SPA fallback.
- Desktop, tablet and phone navigation.
- Fixture import and failure handling.
- Saturday, Sunday and midweek schedule build.
- Pitch closure and manual validation.
- Officials conflict detection.
- Parking pressure and recommendation evidence.
- Schedule lock, optimiser, save and reload.
- Reports print/PDF and CSV.
- Funding project, upload, signed document link and evidence snapshot.
- Read-only permission rejection.
- Cross-club read/write/storage rejection.
- Client error appears in Platform Admin with no private fixture/player data.

## Gate discipline

A launch gate can be marked **Ready** only when the latest definitive structured evidence for that gate is a pass. Failed evidence remains in the append-only register. A retest creates a new record; it does not overwrite the failure.
