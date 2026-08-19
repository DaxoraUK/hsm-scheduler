# Daxora v3.10.1 — Rollout and Acceptance

## Release contents

- Coach Hub person and team-assignment model;
- secure invitation delivery;
- dedicated mobile Coach Hub;
- Annual Planner request queue;
- change, cancellation and alternative workflows;
- private team calendar feeds;
- messages and acknowledgements;
- shared team-contact integration;
- Core add-on, Pro and Elite entitlement enforcement;
- migration `202607150004_coach_hub_team_contacts_requests.sql`.

## Installation

Extract the release package and double-click:

```text
DOUBLE-CLICK-THIS-INSTALL-AND-DEPLOY.cmd
```

The installer targets `C:\Development\hsm-scheduler` by default. A different repository folder can be dropped onto the launcher.

## Installer behaviour

The installer:

1. verifies the `staging` branch and remote;
2. cleans generated Supabase and TypeScript cache files;
3. rejects unrelated working-tree changes;
4. scans the payload for trailing whitespace before copying;
5. creates a timestamped backup;
6. copies and SHA-256 verifies the exact release files;
7. runs lint;
8. runs all regression tests in four deterministic shards;
9. runs the production build;
10. stages only the v3.10.1 release files;
11. creates a non-interactive commit;
12. generates release and pilot-hardening evidence;
13. applies the linked Supabase migration;
14. pushes `staging`;
15. verifies `origin/staging` matches local `HEAD`.

## Required provider configuration

Coach invitations use the existing server-side email configuration. Confirm the Preview environment contains the same Resend variables used by Daxora Communications.

No new public secret is required. Invitation links are generated from the active Daxora deployment and rejected if their origin does not match the API request.

## Staging acceptance

### Entitlements

- Link does not show Coach Hub or Annual Planner.
- Core without the add-on remains locked.
- Core with `annual_planner=true` receives both Annual Planner and Coach Hub.
- Pro and Elite receive both by default.
- Removing the entitlement removes coach workspace discovery.

### Contact synchronisation

- Open Settings → Teams and confirm adult coach details.
- Open Settings → Coach Hub.
- Run contact synchronisation.
- Confirm each contact appears once and is linked to the correct team and role.
- Update a team contact and confirm Coach Hub reflects the change.

### Invitation

- Send one invitation.
- Confirm the email uses Daxora branding and correct club/team names.
- Accept it while signed in with the invited email.
- Confirm a different email cannot accept it.
- Confirm an expired or previously accepted token is rejected.
- Bulk invite remaining eligible contacts and review failed/missing-email rows.

### Coach access

- Confirm the coach enters the dedicated Coach Hub.
- Confirm club administration routes are unavailable.
- Confirm only assigned teams, bookings, fixtures and messages are visible.
- Confirm profile changes update the shared contact record and audit history.

### Requests

- Submit training and friendly requests.
- Attempt a pitch, team, matchday and blackout conflict.
- Confirm hard conflicts are blocked and warnings are carried to the reviewer.
- Approve a request from Annual Planner.
- Offer an alternative and accept it from Coach Hub.
- Request more information and reject with a reason.
- Submit a change and cancellation against a confirmed booking.
- Confirm only the selected booking changes or cancels.

### Calendar and messages

- Generate a private calendar feed.
- Subscribe using Google, Apple or Outlook.
- Confirm only authorised team events are present.
- Send an acknowledgement-required message.
- Confirm read and acknowledged states update.

### Audit and isolation

- Review audit events for invitation, acceptance, request, decision and booking creation.
- Test a second club and confirm no cross-club people, requests, messages or calendar events appear.

## Manual migration verification

```powershell
cd C:\Development\hsm-scheduler

npx supabase migration list --linked
npx supabase db push --linked
npx supabase migration list --linked
```

The remote list must contain:

```text
202607150004
```

## Manual Git fallback

Use only if the installer stops before committing:

```powershell
cd C:\Development\hsm-scheduler

git add -- `
  api/coach/calendar.js `
  api/coach/invite.js `
  server/coach/invitations.js `
  src/lib/coach/coachHubEngine.js `
  src/pages/CoachHubPage.jsx `
  src/components/coach/CoachRequestReviewDialog.jsx `
  src/components/Settings/CoachHubSettingsPanel.jsx `
  src/components/Settings/SettingsTabs.jsx `
  src/pages/SettingsPage.jsx `
  src/components/Settings/TeamSettingsPanel.jsx `
  src/pages/CommunicationsPage.jsx `
  src/lib/subscriptions/entitlements.js `
  src/components/Settings/SubscriptionSettingsPanel.jsx `
  src/components/SubscriptionGate.jsx `
  src/lib/security/permissions.js `
  src/hooks/useClubAccess.js `
  src/AppCore.jsx `
  src/lib/supabase.js `
  src/pages/AnnualPlannerPage.jsx `
  supabase/migrations/202607150004_coach_hub_team_contacts_requests.sql `
  tests/regression/coach-hub-v3101.test.js `
  docs/GROUND_CONTROL_V3101_COACH_HUB_TEAM_CONTACTS_REQUESTS.md `
  docs/DAXORA_V3101_ROLLOUT.md `
  docs/DAXORA_FULL_PRODUCT_AUDIT_AND_ROADMAP_2026.md

git diff --cached --check

git -c commit.gpgSign=false commit --no-gpg-sign --no-verify -m "Add Ground Control v3.10.1 Coach Hub and team requests"

$env:RELEASE_ENVIRONMENT="staging"
$env:RELEASE_ID=(git rev-parse --short HEAD)

npm run release:evidence
npm run pilot:hardening

npx supabase migration list --linked
npx supabase db push --linked
npx supabase migration list --linked

git push origin staging
```

## Rollback

The installer restores files automatically if validation fails before migration. After the migration is applied, prefer a forward repair rather than deleting Coach Hub tables because invitations, requests and audit evidence may already exist.
