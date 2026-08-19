# Daxora v3.8.2 — Rollout and Acceptance

## Upgrade baseline

Apply this release only after:

- League Operations v3.8 Analytics and Reports;
- Daxora v3.8.1 Notifications, Dialogues and Interaction System;
- migration `202607140009_league_analytics_reports.sql`.

The new migration is:

```text
202607140010_daxora_reporting_delivery_notifications.sql
```

## Required hosting configuration

### Existing Supabase and email settings

Keep the existing browser and server Supabase variables and the Resend staging-pilot configuration.

At minimum, report email delivery requires:

```text
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVER_ONLY_SERVICE_ROLE_KEY
COMMUNICATIONS_EMAIL_ENABLED=true
COMMUNICATIONS_EMAIL_FROM=Ground Control Staging <matchday@YOUR_VERIFIED_DOMAIN>
RESEND_API_KEY=YOUR_SERVER_ONLY_RESEND_API_KEY
```

For staging, retain:

```text
COMMUNICATIONS_DEPLOYMENT_ENVIRONMENT=staging
COMMUNICATIONS_EMAIL_PILOT_MODE=true
COMMUNICATIONS_EMAIL_PILOT_RECIPIENT=YOUR_AUTHORISED_INTERNAL_TEST_EMAIL
COMMUNICATIONS_EMAIL_PILOT_OPERATOR_EMAILS=YOUR_AUTHORISED_LOGIN_EMAIL
```

### Daily automation

Add the same strong random secret to Vercel Preview/staging:

```text
CRON_SECRET=YOUR_LONG_RANDOM_AUTOMATION_SECRET
DAXORA_AUTOMATION_SECRET=YOUR_LONG_RANDOM_AUTOMATION_SECRET
```

`CRON_SECRET` is the required Vercel cron value. Do not prefix it with `VITE_`.

### Installed-app push

Generate one P-256 VAPID key pair. Add:

```text
VITE_DAXORA_VAPID_PUBLIC_KEY=YOUR_URL_SAFE_PUBLIC_KEY
DAXORA_VAPID_PUBLIC_KEY=YOUR_URL_SAFE_PUBLIC_KEY
DAXORA_VAPID_PRIVATE_KEY=YOUR_SERVER_ONLY_URL_SAFE_PRIVATE_KEY
DAXORA_VAPID_SUBJECT=mailto:support@YOUR_VERIFIED_DOMAIN
```

Only the public key may use `VITE_`. The private key must remain server-only.

The package includes `GENERATE-DAXORA-VAPID-KEYS.cmd`, which writes a local text file containing the generated settings. It does not upload or commit the keys.

After adding or changing Vercel variables, redeploy the staging deployment so server functions and the browser bundle receive the new values.

## Automated installer

Extract the complete package, then double-click:

```text
DOUBLE-CLICK-THIS-INSTALL-AND-DEPLOY.cmd
```

The installer targets `C:\Development\hsm-scheduler` and asks for a different repository only when that path is unavailable.

It performs:

1. `staging` branch and remote-state checks;
2. unrelated-change isolation;
3. payload SHA-256 verification;
4. timestamped backup of every affected file;
5. payload copy and post-copy verification;
6. lint;
7. all regression tests in four deterministic shards;
8. production build;
9. exact-file Git staging;
10. non-interactive commit with GPG/editor prompts disabled;
11. commit-specific release evidence;
12. linked Supabase migration list and `db push`;
13. push to `origin/staging`;
14. remote hash verification for the Vercel deployment trigger.

The window remains open and a complete transcript is written to the Desktop.

## Staging acceptance

### Deployment evidence

```powershell
cd C:\Development\hsm-scheduler
npx supabase migration list --linked
npm run release:evidence
git fetch origin staging
git rev-parse HEAD
git rev-parse origin/staging
```

Confirm migration `202607140010` appears locally and remotely. The two Git hashes must match. Confirm Vercel created a Preview deployment for the same `staging` commit.

### Environment and automation

- In Vercel Project Settings, confirm `CRON_SECRET` exists for Preview/staging.
- Confirm Resend and Supabase server variables are available to Preview.
- Confirm VAPID public and private keys are present when push is being accepted.
- Open the deployment’s Cron Jobs view and confirm `/api/automation/daily` is registered.
- Invoke the cron once from the Vercel interface or an authorised request and confirm a JSON summary is returned.
- Confirm an unauthorised request receives HTTP 401.

### Report distribution lists

As league owner/admin:

1. Open League Manager → Analytics & reports → Reports & evidence.
2. Create a distribution list with the authorised staging-pilot test recipient.
3. Refresh the page and confirm the list persists.
4. Edit or delete the test list and confirm the activity is audited.

### Report schedule and Run now

1. Capture or refresh the current Analytics snapshot.
2. Create a weekly executive report using Excel output.
3. Select the test distribution list.
4. Set maximum snapshot age to 24 hours.
5. Enable email and archive.
6. Use **Run now**.
7. Confirm the run changes through queued/processing to delivered.
8. Confirm provider reference and artifact filename are retained.
9. Confirm the staging email is redirected to the authorised pilot inbox.
10. Open the attachment in Microsoft Excel and inspect the worksheets.

Repeat with HTML and CSV formats.

### Stale and missing data protection

- Create a schedule with a freshness limit lower than the source snapshot age.
- Confirm delivery is blocked and the run records `REPORT_SNAPSHOT_STALE`.
- Test a definition without recipients and confirm `REPORT_RECIPIENTS_MISSING`.
- Do not manually alter production data to test a missing snapshot; use an isolated staging definition or SQL fixture.
- Refresh Analytics, retry the failed run and confirm it can deliver from the new snapshot.

### Delivery archive and retry

- Open Delivery queue and archive.
- Confirm status, requested source, attempt count, failure detail and timestamps are readable.
- Retry a controlled failed run.
- Confirm the retry creates an auditable attempt and does not duplicate a successfully completed run.
- Download the archived artifact or source snapshot and reconcile it to the email attachment.

### Scheduled cron

Create a report definition due before the next cron run, then confirm after the daily worker:

- the definition was queued;
- a delivery run was claimed;
- the staging-pilot email was received;
- last-run and next-due were advanced only after delivery;
- a Daxora activity item was created;
- failures remain visible and retryable.

### Notification synchronisation

Using the same account in two browser sessions:

- create a retained warning or report-delivery notification;
- confirm it appears after sync on both devices;
- mark it read on one and refresh/focus the other;
- confirm the unread count follows the server state;
- dismiss it and confirm the dismissal follows the account.

### Preferences and digests

- Disable one category and confirm it no longer contributes to the visible in-app queue or unread badge.
- Disable the in-app centre and confirm the bell remains available for settings but shows no activity count.
- Save daily and weekly digest preferences.
- Confirm staging digest delivery is redirected to the authorised pilot inbox.
- Confirm quiet hours suppress push while leaving the in-app activity available.

### Browser/installed-app push

- Use an HTTPS Vercel Preview deployment.
- Open Notification preferences and enable Daxora push.
- Accept the browser permission prompt.
- Use **Send test**.
- Confirm a Daxora Ground Control system notification appears with the Daxora icon.
- Click it and confirm the Daxora application opens.
- Disable push and confirm the subscription is removed.

The outer notification design is controlled by Windows/Edge or the current operating system. Test the identity, wording and click destination rather than expecting an in-app card design.

### Security

- Confirm report and digest APIs reject missing/invalid authentication.
- Confirm a non-admin league role cannot create distribution lists or report definitions.
- Confirm a user from another league cannot claim or read the run.
- Confirm the browser bundle contains no service-role key, VAPID private key, Resend key or cron secret.
- Confirm player names, dates of birth, registration evidence and confidential discipline notes do not appear in report snapshots or notifications.

### Performance

- Open League Manager from a cold page load.
- Confirm the shell loads before the selected heavy workspace.
- Navigate between Schedule, Officials, Registrations, Discipline and Analytics.
- Confirm each lazy workspace loads successfully and browser back/forward still works.

## Rollback behaviour

Before the Supabase migration succeeds, an installer failure restores the previous files and removes a local release commit created by that run.

Once the database migration succeeds, the installer does not attempt an unsafe automatic schema rollback. If the later Git push fails, the local release commit and migration remain in place; rerun:

```powershell
git push origin staging
```

After a successful remote push, rollback should use a normal Git revert. The additive tables and columns may remain safely unused while the application commit is reverted.

## Exact manual Git fallback

Use only when the installer stops before commit/push and the repository contains no unrelated work:

```powershell
cd C:\Development\hsm-scheduler

git add .env.example
git add .env.staging.example
git add .env.production.example
git add api/automation/daily.js
git add api/league/report-delivery.js
git add api/notifications/push-test.js
git add public/daxora-sw.js
git add server/notifications/email.js
git add server/notifications/webPush.js
git add server/reports/delivery.js
git add server/reports/processor.js
git add src/components/league/LeagueAnalyticsWorkspace.jsx
git add src/components/system/DaxoraNotificationBell.jsx
git add src/components/system/DaxoraNotificationPreferences.jsx
git add src/lib/league/leagueAnalyticsEngine.js
git add src/lib/league/reportDeliveryService.js
git add src/lib/notifications/browserPush.js
git add src/lib/notifications/daxoraNotifications.js
git add src/lib/supabase.js
git add src/pages/LeagueManagerPage.jsx
git add supabase/migrations/202607140010_daxora_reporting_delivery_notifications.sql
git add tests/regression/daxora-report-delivery-v382.test.js
git add tests/regression/league-manager-analytics-v38.test.js
git add vercel.json
git add docs/DAXORA_V382_ANALYTICS_DELIVERY_AUTOMATION.md
git add docs/DAXORA_V382_ROLLOUT.md

git diff --cached --check
git -c commit.gpgSign=false commit --no-gpg-sign --no-verify -m "Add Daxora v3.8.2 analytics delivery automation"

$env:RELEASE_ENVIRONMENT="staging"
$env:RELEASE_ID=(git rev-parse --short HEAD)
npm run release:evidence

npx supabase migration list --linked
npx supabase db push --linked

git push origin staging
```
