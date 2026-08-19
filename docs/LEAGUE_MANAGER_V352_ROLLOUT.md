# League Operations v3.5.2 — Rollout

## Installation order

1. Install the v3.5.2 source payload.
2. Run the full repository check.
3. Commit the release files.
4. Generate commit-specific release evidence.
5. Apply the linked Supabase migration.
6. Push `staging` to GitHub.
7. Confirm the Vercel Preview deployment uses the same commit.

The packaged double-click installer performs this sequence and writes a full log to the Windows Desktop.

## Database change

The migration is:

```text
supabase/migrations/202607140006_league_schedule_assurance_and_v352_ux.sql
```

It:

- adds `league_divisions.extra_home_rotation_offset`;
- updates the league season/division settings RPC;
- adds server-side schedule structure assurance;
- combines structure and operational validation;
- makes publication use the combined result.

## Staging acceptance

After deployment:

1. Open **League Manager → League Structure → Divisions**.
2. Set a test division to three meetings per pairing.
3. Confirm the odd-meeting cycle setting is visible.
4. Open **Fixtures → Schedule builder**.
5. Confirm the Competition-format assurance row shows the correct fixtures per team and total fixtures.
6. Generate the full league programme.
7. Confirm no pairing is missing or duplicated.
8. Search for a club, team, ground and official from the League Manager search bar.
9. Change a registry field and attempt to leave without saving; confirm the warning appears.
10. Validate the stored draft on the server.
11. Publish only after both browser and server validation pass.

## Manual verification commands

```powershell
cd C:\Development\hsm-scheduler

npx supabase migration list --linked
npx supabase db push --linked

npm run check

$env:RELEASE_ENVIRONMENT="staging"
$env:RELEASE_ID=(git rev-parse --short HEAD)
npm run release:evidence

git fetch origin staging
git rev-parse HEAD
git rev-parse origin/staging
```

The final two hashes must match.

## Rollback

The installer creates a timestamped backup under:

```text
C:\Development\hsm-scheduler\.daxora-backups
```

Before a successful push, a failed install restores the affected source files. Once the database migration and Git push have completed, rollback should be handled as a new corrective migration and a new Git commit rather than rewriting published history.
