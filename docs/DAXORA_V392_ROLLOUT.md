# Daxora v3.9.2 rollout and acceptance

## Installation

Use the packaged double-click installer. It backs up the affected files, verifies hashes, runs lint, regression tests, the production build and pilot-hardening evidence, then commits and pushes `staging`.

There is no Supabase migration in v3.9.2.

## Staging acceptance

After Vercel deploys the new `staging` commit:

1. Open Daxora Admin → System health.
2. Confirm the release and environment match the deployment.
3. Review every blocked or conditional provider.
4. Download a support diagnostics pack and confirm it contains no club or player records.
5. Navigate using only the keyboard and verify the skip link and focus movement.
6. Trigger a safe test error in a local or controlled environment and confirm the support reference can be copied.
7. Run remote evidence:

```powershell
$env:PILOT_REMOTE_CHECK="true"
$env:STAGING_URL="https://your-staging-domain.example"
$env:RELEASE_ENVIRONMENT="staging"
$env:RELEASE_ID=(git rev-parse --short HEAD)
npm run pilot:hardening
```

## Git commands

```powershell
cd C:\Development\hsm-scheduler

git add api/health.js
git add src/lib/monitoring/systemHealth.js
git add src/components/system/PlatformSystemHealthPanel.jsx
git add src/pages/PlatformAdminPage.jsx
git add src/layout/ProductShell.jsx
git add src/components/system/AppErrorBoundary.jsx
git add src/hooks/useGlobalErrorNotifications.js
git add src/lib/monitoring/clientTelemetry.js
git add src/index.css
git add scripts/pilot-hardening-evidence.mjs
git add package.json
git add tests/regression/daxora-pilot-hardening-v392.test.js
git add docs/DAXORA_V392_PILOT_HARDENING_LAUNCH_CONFIDENCE.md
git add docs/DAXORA_V392_ROLLOUT.md

git diff --cached --check
git -c commit.gpgSign=false commit --no-gpg-sign --no-verify -m "Add Daxora v3.9.2 pilot hardening and launch confidence"

$env:RELEASE_ENVIRONMENT="staging"
$env:RELEASE_ID=(git rev-parse --short HEAD)
npm run release:evidence
npm run pilot:hardening

git push origin staging
```

## Rollback

If validation fails before the commit, the installer restores every affected file. If staging acceptance fails after the push, revert the release commit and redeploy. No database rollback is required.
