# Daxora v3.10.2 — Staging Rollout and Acceptance

**Release date:** 16 July 2026

## Release contents

This release contains Coach Hub and Annual Planner pilot refinement only. It requires:

- Ground Control v3.10 Annual Planner;
- Ground Control v3.10.1 Coach Hub;
- Daxora v3.9.2 pilot-hardening foundation.

Database migration:

```text
202607150005_coach_hub_annual_planner_pilot_refinement.sql
```

## Automated installer

Extract the complete package and double-click:

```text
DOUBLE-CLICK-THIS-INSTALL-AND-DEPLOY.cmd
```

The installer defaults to:

```text
C:\Development\hsm-scheduler
```

It verifies the branch, working tree, payload hashes and whitespace before changing the repository. It then runs lint, all regression tests, the production build, release evidence, pilot-hardening evidence, the linked Supabase migration and the `staging` push.

## Required environment

The existing Coach Hub and automation environment remains required:

- Supabase browser variables;
- server-side Supabase service-role variables;
- Resend API key and verified sender configuration;
- `CRON_SECRET` or `DAXORA_AUTOMATION_SECRET`;
- correct Vercel Preview environment settings.

No new public secret is introduced by v3.10.2.

## Supabase verification

Run after installation when manual verification is required:

```powershell
cd C:\Development\hsm-scheduler
npx supabase migration list --linked
```

The local and remote lists must include:

```text
202607150005
```

## Staging acceptance

### Request conversations

1. Sign in as an invited coach.
2. Open a submitted booking request.
3. Send a question to the club.
4. Sign in as an Annual Planner operator.
5. Reply in the same request conversation.
6. Confirm unread state clears for the reader and no other team can see the thread.

### Contact verification and replacement

1. Confirm a coach can verify their current details.
2. Review verification coverage in Coach Hub settings.
3. Replace a test coach contact as a club administrator.
4. Confirm the previous Coach Hub account and team feed no longer provide access.
5. Send a new invitation to the replacement contact.

### Recurrence exceptions

1. Submit a weekly winter-training request.
2. Select a holiday policy and provide at least two dates to skip.
3. Approve the request.
4. Confirm the excluded dates do not produce bookings.
5. Edit one occurrence and apply the change to all remaining dates.
6. Confirm past, cancelled and unrelated bookings remain unchanged.

### Automatic audiences

1. Select a confirmed booking and choose **Contact coaches**.
2. Confirm Communications opens with the correct team audience.
3. Create a pitch blackout covering more than one booking.
4. Choose **Contact affected coaches**.
5. Confirm only genuinely overlapping teams are included.
6. Confirm duplicate people and team assignments do not create duplicate recipients.

### Calendar feeds

1. Create or refresh a private feed for one assigned team.
2. Open the feed in a private browser or calendar client.
3. Confirm only that team's fixtures and annual bookings are present.
4. Replace or revoke the coach and confirm the previous feed stops working.

### Reminders and acknowledgements

1. Create a confirmed booking inside the 48-hour reminder window.
2. Run the protected daily automation endpoint.
3. Confirm a reminder message and delivery record are created once.
4. Repeat inside the 4-hour window.
5. Acknowledge the Coach Hub message.
6. Confirm the reminder record receives the acknowledgement timestamp.
7. Confirm repeated automation runs do not send duplicates.

### Insights and Finance connection

1. Open Annual Planner **Insights**.
2. Reconcile booking counts and booked hours to the calendar.
3. Verify contact, request and acknowledgement percentages against test records.
4. Add a planned cost to a booking as an authorised administrator.
5. Mark the booking reconciled and retain a reference.
6. Confirm unauthorised roles cannot see or change cost data.

## Release evidence

Generate evidence against the deployed commit:

```powershell
$env:RELEASE_ENVIRONMENT="staging"
$env:RELEASE_ID=(git rev-parse --short HEAD)
npm run release:evidence
npm run pilot:hardening
```

Store the resulting evidence with the staging acceptance record.

## Git and Vercel verification

```powershell
git fetch origin staging
git rev-parse HEAD
git rev-parse origin/staging
```

The two hashes must match. In Vercel, confirm a Preview deployment exists for that `staging` commit and complete a browser smoke test.

## Rollback boundary

Before the database migration succeeds, the installer restores the release files automatically after validation or commit failure.

After migration `202607150005` succeeds, do not delete the new database objects manually. Retain the application commit and resolve any remaining Git or deployment issue, then push `staging` again.

The migration is additive and preserves v3.10.1 Coach Hub records.

## Exit criteria

v3.10.2 is accepted only when:

- all automated checks pass;
- the migration is present remotely;
- the Vercel Preview deployment is healthy;
- request conversations, contact replacement and private feeds are team scoped;
- recurring exceptions work for a real club series;
- automatic audiences match the affected teams;
- reminder delivery and acknowledgement are duplicate safe;
- utilisation, engagement and cost figures reconcile to source records.
