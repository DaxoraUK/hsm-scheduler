# League Operations v3.8 — Rollout and Acceptance

## Upgrade baseline

Apply this release only after League Operations v3.7 and migration `202607140008_league_registrations_eligibility_player_administration.sql` are present.

The v3.8 migration is:

```text
202607140009_league_analytics_reports.sql
```

## Automated installer

Extract the full release package, then double-click:

```text
DOUBLE-CLICK-THIS-INSTALL-AND-DEPLOY.cmd
```

The installer targets `C:\Development\hsm-scheduler` by default and asks for another folder only when that repository is not found.

It performs:

1. Branch and remote-state checks.
2. Working-tree isolation checks.
3. Backup of every affected file.
4. Payload copy and SHA-256 verification.
5. Lint, all regression tests and production build.
6. Exact-file Git staging and commit.
7. Commit-specific release evidence.
8. Linked Supabase migration verification and `db push`.
9. Push to `origin/staging`.
10. Remote commit verification for the Vercel trigger.

The command window remains open and a full transcript is written to the Desktop.

## Staging acceptance

### Deployment evidence

Run or confirm:

```powershell
cd C:\Development\hsm-scheduler
npx supabase migration list --linked
npm run release:evidence
git fetch origin staging
git rev-parse HEAD
git rev-parse origin/staging
```

The two Git hashes must match. Vercel should show a new Preview deployment for `staging`.

### Access and privacy

Test with each role:

- Owner/admin: all aggregate datasets and report management available.
- Discipline officer: discipline aggregates available; report-definition management unavailable unless also admin/owner.
- Registration secretary: registration aggregates available; report-definition management unavailable unless also admin/owner.
- Fixture/results/officials/viewer roles: general operational analytics available; discipline and registration sections explicitly marked restricted.
- Club portal user: no access to the internal league analytics workspace.

Confirm no player names, dates of birth, confidential case notes or evidence documents appear in exports.

### Executive dashboard

Using real staging data, confirm:

- Fixtures due excludes future fixtures.
- Verified results match the displayed completion figure.
- Missing results match the Results queue.
- Official gaps match the Match Officials workspace.
- Club acknowledgement and change-request totals match Club Operations.
- Restricted datasets are labelled restricted rather than reported as zero.

### Division and date filters

- Select each division and confirm sporting order is correct.
- Set a date range and confirm all views and exports change consistently.
- Refresh the browser and confirm filters persist.
- Clear the filters and confirm league-wide figures return.

### Club scorecards

Select at least three clubs and reconcile:

- Due fixtures and completed results
- Publication acknowledgements
- Open change requests
- Registration issues
- Discipline cases and fines where authorised
- Operational score components

The score must be treated as an attention indicator, not a sanction or sporting ranking.

### Reports

Generate and inspect:

- Executive HTML board pack
- Competition CSV and HTML
- Club scorecard CSV and HTML
- Match-official CSV and HTML
- Governance CSV and HTML
- Funding-evidence CSV and HTML

Open the HTML reports and use browser Print / Save as PDF. Confirm filenames include league, season, report type and date.

### Report schedules and snapshots

As owner/admin:

1. Save a monthly executive report definition.
2. Add one or more valid recipient addresses.
3. Confirm it appears in Scheduled packs.
4. Run it manually.
5. Confirm a snapshot appears in history.
6. Confirm last-run and next-due dates update.
7. Delete a test definition.
8. Confirm all actions appear in the audit trail.

Do not expect automatic email delivery in v3.8. That requires the later delivery worker.

## Rollback behaviour

Before Supabase advances, any installer failure restores the previous files and removes a local release commit created by the run.

After Supabase succeeds, the installer does not roll the database backwards automatically. If the later Git push fails, the local commit and database migration remain valid; run:

```powershell
git push origin staging
```

## Exact manual Git fallback

```powershell
cd C:\Development\hsm-scheduler

git add src/lib/league/leagueAnalyticsEngine.js
git add src/components/league/LeagueAnalyticsWorkspace.jsx
git add src/pages/LeagueManagerPage.jsx
git add src/lib/supabase.js
git add supabase/migrations/202607140009_league_analytics_reports.sql
git add tests/regression/league-manager-analytics-v38.test.js
git add docs/LEAGUE_MANAGER_V38_ANALYTICS_REPORTS.md
git add docs/LEAGUE_MANAGER_V38_ROLLOUT.md

git diff --cached --check
git commit -m "Add League Operations v3.8 analytics and reports"

$env:RELEASE_ENVIRONMENT="staging"
$env:RELEASE_ID=(git rev-parse --short HEAD)
npm run release:evidence

npx supabase migration list --linked
npx supabase db push --linked

git push origin staging
```
