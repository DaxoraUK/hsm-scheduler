# League Operations v3.6 rollout and staging acceptance

## Required baseline

Install v3.6 only after the v3.5.2 schedule-assurance release is present. The repository must contain:

`supabase/migrations/202607140006_league_schedule_assurance_and_v352_ux.sql`

The installer targets the `staging` branch and stops when unrelated working-tree changes are present.

## Automated deployment order

The packaged installer performs these steps:

1. Verify the repository, branch and remote relationship.
2. Back up every affected existing file.
3. Copy and SHA-256 verify the v3.6 payload.
4. Run lint, all regression tests and the production build.
5. Stage only the declared v3.6 files.
6. Commit the release and generate commit-specific release evidence.
7. Verify linked Supabase migrations and run `npx supabase db push --linked`.
8. Push `staging` to GitHub and verify the remote commit.

Supabase is advanced before GitHub is pushed, so Vercel cannot deploy a frontend that expects database objects which were not created.

## Staging acceptance

After deployment, verify these scenarios in staging.

### Access isolation

- Owner, administrator and discipline officer can see **Discipline & compliance**.
- Fixture secretary, officials secretary, results secretary and viewer cannot see it.
- A direct discipline URL redirects an unauthorised league role to the command centre.
- Club portal users only see cases connected to their club.
- A confidential case never appears in the club portal.

### Case lifecycle

- Create a case with a respondent club and response deadline.
- Add a charge and a league-confidential note.
- Add a club-visible event and a secure HTTPS evidence link.
- Move the case through response, hearing, decision and closure states.
- Confirm all changes appear in the audit history.

### Club portal

- Submit a formal club response.
- Confirm the case moves from awaiting response to decision pending.
- Acknowledge the decision.
- Add evidence through an HTTP or HTTPS URL.
- Submit an appeal after a decision and review it as a discipline officer.

### Sanctions

- Record a fine and confirm due-date queues and reporting totals.
- Mark the fine paid.
- Record an active points deduction against a team.
- Confirm the league table reflects the linked adjustment.
- Revoke or serve the sanction and confirm the table adjustment is revoked.

### Command and reports

- Confirm overdue responses and fines appear in the main command centre.
- Confirm the discipline officer receives discipline-first queue ordering.
- Export the case-register CSV.
- Export the club-compliance CSV.

## Manual database verification

```powershell
cd C:\Development\hsm-scheduler

npx supabase migration list --linked
npx supabase db push --linked
```

The remote migration list should include:

`202607140007`

## Manual Git fallback

```powershell
cd C:\Development\hsm-scheduler

git add src/lib/league/leagueDisciplineEngine.js
git add src/components/league/LeagueDisciplineWorkspace.jsx
git add src/components/league/LeagueClubDisciplinePanel.jsx
git add src/components/league/LeagueClubPortalPage.jsx
git add src/components/league/LeagueCommandCentreWorkspace.jsx
git add src/lib/league/leagueCommandCentre.js
git add src/pages/LeagueManagerPage.jsx
git add src/lib/supabase.js
git add supabase/migrations/202607140007_league_discipline_compliance_case_management.sql
git add tests/regression/league-manager-discipline-v36.test.js
git add docs/LEAGUE_MANAGER_V36_DISCIPLINE_COMPLIANCE_CASE_MANAGEMENT.md
git add docs/LEAGUE_MANAGER_V36_ROLLOUT.md

git diff --cached --check
git commit -m "Add League Operations v3.6 discipline and compliance case management"

$env:RELEASE_ENVIRONMENT="staging"
$env:RELEASE_ID=(git rev-parse --short HEAD)
npm run release:evidence

npx supabase migration list --linked
npx supabase db push --linked

git push origin staging
```

## Recovery behaviour

Before Supabase advances, any installation failure restores the backed-up project files and removes the local release commit. After Supabase succeeds, the installer preserves the local commit if GitHub push fails and prints the exact push command; rolling back application code after the database migration would be less safe than completing the push.
