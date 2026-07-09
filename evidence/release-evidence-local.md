# Ground Control release evidence

- **Generated:** 2026-07-09T09:31:27.438Z
- **Environment:** local
- **Release:** stabilisation-pass-1
- **Result:** PASS
- **Git:** 6bb7cc9 (main)
- **Node:** v22.16.0

## Automated release checks

- **Lint:** PASS (1s)
- **Regression tests:** PASS (14s)
- **Production build:** PASS (6s)

## Repository safety checks

- **No environment secret files tracked by Git:** PASS — No .env or .env.*.local files are tracked.
- **No server-only secret names referenced by browser source:** PASS — Browser source does not reference service-role or Stripe server secrets.
- **Deployment environment examples present:** PASS — .env.example, .env.production.example, .env.staging.example, .env.edge.example

## Recording in Ground Control

Record this run against the **Automated lint, test and production-build evidence recorded** launch gate. Upload this folder as a CI artifact or link the relevant GitHub Actions run, then store that HTTPS link in the structured evidence register.
