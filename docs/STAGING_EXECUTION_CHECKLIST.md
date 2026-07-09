# Ground Control staging execution checklist

Use this as the single sequence for the staging and HSM pilot phase. Do not mark a launch gate Ready from repository presence alone.

## 1. Commit the stabilised release candidate

```powershell
npm ci
npm run check
npm run release:evidence
git add -A
git commit -m "Stabilise Ground Control for staging"
git push
```

## 2. Create the staging environment

Create a separate Vercel staging project and a Supabase project reserved for staging/pilot data. Copy `.env.staging.example` to `.env.staging.local` locally, replace every placeholder, and put the same browser variables into Vercel.

Never add `.env.staging.local` to Git.

## 3. Run the local staging preflight

```powershell
npm run preflight:staging -- --env-file .env.staging.local
```

A PASS means the repository and environment configuration are ready for remote verification. It does not prove that migrations or isolation have passed.

## 4. Apply and prove the database

Apply every file in `supabase/migrations` in filename order to the staging Supabase project.

Then run:

1. `supabase/tests/staging_schema_audit.sql`
2. `supabase/tests/rls_isolation.sql` after replacing the two placeholder UUIDs with two real staging auth users

Save the successful SQL output as launch-gate evidence. The isolation test rolls back its own temporary records.

## 5. Deploy and smoke-test staging

```powershell
$env:STAGING_URL="https://YOUR-STAGING-DOMAIN"
$env:RELEASE_ID="ground-control-staging-YYYY.MM.DD.N"
npm run smoke:staging
```

Record the HTTPS artifact against the staging deployment gate.

## 6. Complete manual staging checks

Follow `docs/STAGING_RUNBOOK.md`. Record each result separately in **Daxora Admin → Pilot & launch**. Failed evidence stays in the register; a retest is a new evidence item.

## 7. Configure Horwich St Mary’s

Confirm HSM is its own organisation and club, add the accountable pilot owner, and verify real teams, pitches, formats, Saturday/Sunday/midweek rules, fixture sources, parking assumptions and officials.

## 8. Create the isolation-test club

Create a second organisation and club using the second staging user. Confirm each user can work in their own club and cannot read, write or upload into the other club.

## 9. Run the controlled pilot

Follow `docs/HSM_CONTROLLED_PILOT.md` in order:

1. Historical replay
2. Shadow live
3. Controlled use
4. Sign-off

Keep the existing club process as fallback until controlled-use sign-off.
