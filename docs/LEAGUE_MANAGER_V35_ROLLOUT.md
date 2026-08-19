# League Operations v3.5 rollout

## Baseline verified

- Branch: `staging`
- v3.4.1 repair commit: `a8ee8ab`
- Zip remote reference: `origin/staging` also points to `a8ee8ab`
- Supabase project reference: `gbefhieunbpxhzshxtba`
- v3.4.1 release evidence was regenerated successfully against `a8ee8ab`
- v3.5 local release evidence passes

The uploaded project does not contain a Supabase personal access token, so a remote migration push cannot be authenticated from the inspection environment. Verify it in the authenticated project PowerShell session:

```powershell
npx supabase migration list --linked
npx supabase db push --linked
```

The expected result is that local and remote migration `202607140004` are aligned and `db push` reports no pending migrations after the successful v3.4.1 repair.

## Why no Vercel build appeared for v3.4.1

The repair commit is present on both the local `staging` reference and the uploaded copy of `origin/staging`, and `vercel.json` does not disable Git deployments or define an ignored build command.

A push to `staging` should create a **Preview** deployment, not replace the Production deployment unless `staging` is configured as the production branch. Check the following in Vercel:

1. Open the correct team and project.
2. Open **Settings → Git** and confirm the connected repository is `DaxoraUK/hsm-scheduler`.
3. Confirm Git deployments are enabled for `staging` and no branch rule disables it.
4. Open **Deployments** and clear any Production-only filter; look for Preview deployments from `staging`.
5. Check **Ignored Build Step** and any “skip unaffected project” setting.
6. Check the GitHub commit for a Vercel status/check. If none exists, reconnect the Vercel GitHub integration or restore repository permission.
7. Check the Vercel Activity Log for Git repository disconnection, disabled Git deployments or ignored-build changes.

A manual Preview deployment can be used after the project is linked:

```powershell
npx vercel
```

Do not use `--prod` until the Preview deployment has passed smoke checks.

## Install v3.5

Run the installer from the project root, passing the extracted package script path if needed:

```powershell
powershell -ExecutionPolicy Bypass -File "C:\path\to\daxora-league-manager-v3.5-command-centre\apply-league-manager-v35.ps1" -ProjectRoot "C:\Development\hsm-scheduler"
```

The installer creates a timestamped backup, applies only the v3.5 files, runs `npm run check`, runs release evidence and restores the backup automatically if validation fails.

## Commit and push

```powershell
git status
git add src/pages/LeagueManagerPage.jsx `
  src/components/league/LeagueCommandCentreWorkspace.jsx `
  src/components/league/LeagueFixtureCommandWorkspace.jsx `
  src/components/league/LeagueOfficialsWorkspace.jsx `
  src/components/league/LeagueClubOperationsWorkspace.jsx `
  src/components/league/LeagueResultsWorkspace.jsx `
  src/lib/league/leagueCommandCentre.js `
  tests/regression/league-manager-command-centre-v35.test.js `
  tests/regression/league-manager-pilot-foundation.test.js `
  docs/LEAGUE_MANAGER_V35_COMMAND_CENTRE_UX_REVIEW.md `
  docs/LEAGUE_MANAGER_V35_ROLLOUT.md
git commit -m "Add League Operations v3.5 command centre and UX consolidation"
git push origin staging
```

## Post-push verification

```powershell
git status
git log -1 --oneline
npm run release:evidence
```

Then confirm the exact new commit appears as a Vercel Preview deployment for the `staging` branch. Run the staging smoke check against the new Preview URL:

```powershell
$env:STAGING_URL="https://your-new-preview-url.vercel.app"
$env:RELEASE_ID=(git rev-parse --short HEAD)
npm run smoke:staging
```
