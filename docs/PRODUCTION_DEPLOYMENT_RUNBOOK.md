# Ground Control Production Deployment Runbook

## Release prerequisites

Do not deploy a paid production release until:

- `npm run check` and `npm run test:coverage` pass;
- all Supabase migrations are applied in order;
- production Row Level Security verification passes;
- a restorable database backup exists;
- required legal documents are published and reviewed;
- Stripe test-mode checkout, portal and webhooks pass;
- a support owner and incident contact are assigned;
- critical and high-severity launch defects are closed.

## Environment separation

Use separate development/staging and production configuration. Production must provide:

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_APP_ENVIRONMENT=production
VITE_APP_RELEASE=
VITE_MONITORING_ENABLED=true
VITE_OPEN_METEO_PROXY_URL=
```

Keep Stripe secrets and the Supabase service-role key only in server-side Edge Function secrets.

## Build

```powershell
npm ci
npm run check
npm run test:coverage
npm run build
```

Deploy only the generated `dist` output through a host that supports HTTPS and single-page-application route fallback.

## Pre-release verification

- Sign in as a normal club owner.
- Sign in as a viewer and verify read-only behaviour.
- Verify a second club cannot be accessed.
- Complete one harmless settings save.
- Import or create fixtures and build Saturday, Sunday and midweek schedules.
- Verify parking, weather, analytics and reports.
- Print or save the Matchday Operations Pack.
- Verify mobile navigation.
- Test temporary offline mode without refreshing.
- Verify Daxora Admin cannot open operational data without approved support access.

## Release decision

Record the release identifier, deployment time, migration set, operator, smoke-test result and accepted risks in the launch-gate evidence.

## Rollback

Rollback must be a deliberate release action, not an improvised file replacement.

1. Pause new onboarding or checkout.
2. Record an incident and affected release.
3. Redeploy the last known-good application build.
4. Do not reverse a database migration unless a tested down-migration or restore plan exists.
5. Verify club access, RLS and data integrity after rollback.
