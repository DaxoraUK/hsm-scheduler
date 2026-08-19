# League Operations v3.7 — Staging rollout

## Prerequisite

League Operations v3.6 must already be present, including:

`supabase/migrations/202607140007_league_discipline_compliance_case_management.sql`

## Automated rollout

Extract the release package and double-click:

`DOUBLE-CLICK-THIS-INSTALL-AND-DEPLOY.cmd`

The installer backs up the affected files, verifies payload hashes, runs the full repository check, creates release evidence, pushes the linked Supabase migration, commits the release and pushes `staging` to GitHub.

## Staging acceptance

### Access and privacy

1. Sign in as owner or administrator and confirm **Registrations & eligibility** is visible.
2. Assign a user the **Registration secretary** role and confirm that user can access registrations but not unrelated administrative settings.
3. Sign in as fixtures, results, officials, discipline and viewer roles and confirm the league-wide player register is absent.
4. Sign in through two different club portals and confirm each club sees only its own players, registrations, dispensations and team sheets.
5. Confirm a club viewer cannot submit or change registration data.

### Applications

1. Submit a new registration from a club portal.
2. Confirm it appears in the registration command queue.
3. Return it for correction with a reason.
4. Resubmit it from the club portal.
5. Approve it and confirm it appears in the approved register.
6. Attempt a duplicate name and date of birth and confirm the warning count increases without silently creating an unrelated identity.

### Rules and eligibility

1. Create a division age rule.
2. Create a registration-deadline rule.
3. Submit a player who fails each rule and confirm the reason is clear.
4. Approve a dispensation and confirm the relevant rule is bypassed only for the configured player, team and date range.
5. Add an active person suspension through Discipline and confirm the player becomes ineligible.

### Team sheets

1. Select a published fixture and one of its participating teams.
2. Confirm only approved registrations for that team appear.
3. Submit an eligible team sheet and confirm validation passes.
4. Create a controlled eligibility failure and confirm the team sheet is stored as failed with the player-level reason.
5. Confirm the failure appears in both the registration command queue and the main League Operations command centre.

### Reports

1. Export the player-registration register.
2. Export the eligibility-exceptions register.
3. Confirm dates, clubs, teams, decisions and statuses match the on-screen records.

### Deployment evidence

After the installer finishes:

```powershell
cd C:\Development\hsm-scheduler
git status
git log -1 --oneline
git fetch origin staging
git rev-parse HEAD
git rev-parse origin/staging
npx supabase migration list --linked
```

The two Git hashes must match and migration `202607140008` must be present locally and remotely. Check Vercel **Deployments → Preview** for the new `staging` build.

## Rollback boundary

Do not manually delete the new tables after clubs have entered player data. Application rollback and database-data rollback are separate decisions. Before any production rollback, export affected registration records and agree the retention approach.

## Next phase

After staging acceptance, proceed to **v3.8 League Analytics and Reports** using the now-complete fixtures, results, officials, discipline and registration datasets.
