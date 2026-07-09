# Daxora Ground Control — staging readiness pass 1

This patch adds repository and environment preflight evidence for the production-like staging phase.

## Install

Extract this folder into the Ground Control project root, or run from the project root:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\daxora-staging-readiness-pass-1\apply-staging-readiness.ps1
npm run check
```

## Configure later, without committing secrets

Copy `.env.staging.example` to `.env.staging.local` and replace all placeholders with the dedicated staging Vercel/Supabase values.

Then run:

```powershell
npm run preflight:staging -- --env-file .env.staging.local
```

A successful preflight means the repository and configuration are ready for remote verification. It does not claim that staging is deployed or that migrations and tenant isolation have passed.

Follow `docs/STAGING_EXECUTION_CHECKLIST.md` for the remaining order.
