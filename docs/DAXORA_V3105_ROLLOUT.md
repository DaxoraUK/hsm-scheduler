# Daxora Ground Control v3.10.5 Rollout

## Release

**Shared Calendar and Request Workflow**

## Required baseline

- Ground Control v3.10.4 installed.
- Git branch `staging` checked out.
- Linked Supabase project available to the Supabase CLI.
- Node.js, npm, Git and npx available on Windows.

## Installer

Extract the release ZIP fully and run:

`DOUBLE-CLICK-THIS-INSTALL-AND-DEPLOY.cmd`

The installer targets:

`C:\Development\hsm-scheduler`

It will:

1. verify every payload hash;
2. back up all affected project files;
3. install exact replacement files;
4. run focused regression tests;
5. run the complete regression suite;
6. run lint and the production build;
7. create the v3.10.5 Git commit;
8. dry-run and apply the linked Supabase migration;
9. push the `staging` branch for Vercel deployment.

## Migration

`supabase/migrations/202607170001_shared_calendar_request_workflow.sql`

## Expected completion message

`COMPLETE - v3.10.5 SHARED CALENDAR AND REQUEST WORKFLOW PUSHED`

## Post-deployment validation

### Pitch configuration

1. Open Settings → Pitches.
2. Open Pitch 4.
3. Set Simultaneous training teams to `2`.
4. Add bookable areas `Half A` and `Half B`.
5. Save.

### Coach calendar

1. Sign in as the pilot coach.
2. Open Calendar.
3. Confirm month and agenda views work.
4. Confirm approved bookings and pending requests appear.
5. Confirm blackouts and pitch closures appear as unavailable.
6. Use the `+` action on a date to start a request.

### Guided request

1. Select a team and Training.
2. Choose a date, time and optional recurrence.
3. Select Pitch 4 and a pitch area.
4. Select acceptable alternative pitches.
5. Enable time flexibility.
6. Confirm live availability is shown before submission.
7. Submit, reopen and edit the request.

### Operator workflow

1. Open Annual Planner.
2. Confirm the pending coach request appears in the calendar.
3. Review the request and offer a saved alternative pitch or area.
4. Create a shared blackout affecting an existing booking.
5. Resolve the generated closure-impact action as relocated or cancelled.

### Privacy

1. Add both a public coach-facing note and an internal note to a blackout.
2. Confirm only the public note appears in Coach Hub.
3. Confirm the internal note is absent from the coach calendar feed.

## Rollback

Before replacement, the installer stores affected files under:

`C:\Development\hsm-scheduler\.daxora-backups\v3.10.5-<timestamp>`

Before a source commit or database migration is completed, any installer failure restores the affected files automatically. Once the database migration or local commit has completed, the compatible source and backup are retained so the installer can safely be rerun after resolving the external failure.

## Next controlled step

After the pilot checks pass, create and commit the dedicated **Shared Calendar and Coach Request module roadmap**. Do not begin the next module roadmap until this module's roadmap has been reviewed and accepted.
