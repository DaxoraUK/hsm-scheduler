# Daxora Ground Control v3.10.5.2 rollout

## Pre-deployment

- Confirm v3.10.5.1 is installed.
- Confirm the repository is on `staging`.
- Confirm Pitch 4 has capacity `2` and named areas `Half A` and `Half B`.

## Automated validation

- Run `pitch-area-split-session-calendar-legend-v31052.test.js`.
- Run the complete regression suite.
- Run lint and confirm zero errors.
- Run the TypeScript/Vite production build.
- Dry-run and apply the linked Supabase migration.
- Push the release commit to `staging`.

## Pilot acceptance

1. Create or retain a confirmed Half A training booking.
2. Create a second simultaneous training booking on Half B.
3. Confirm both rows appear on Annual Planner and Coach Hub calendars.
4. Confirm the two calendar rows include their area names.
5. Attempt a second Half A booking and confirm it is blocked.
6. Attempt a same-team overlap on another pitch and confirm it is blocked.
7. Confirm the event colours exactly match the calendar key.
8. Confirm a shared pitch with named areas requires an area selection in the Coach Hub request wizard.

## Rollback

The installer stores every replaced file under:

`.daxora-backups/v3.10.5.2-<timestamp>`

The database migration is forward-only. If emergency database rollback is required, restore the previous definitions from migration `202607170002_pitch_area_calendar_refresh_repair.sql` and reload the PostgREST schema.
