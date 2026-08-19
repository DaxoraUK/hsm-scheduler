# Daxora Ground Control v3.10.7 rollout

## Release

Smart Summer and Winter Training Allocation for the Annual Planner module.

## Installation

1. Confirm the project is at `C:\Development\hsm-scheduler`.
2. Run the packaged double-click installer.
3. Allow focused tests, the complete regression suite, lint and the production build to finish.
4. Allow the linked Supabase migration to run.
5. Confirm the scoped Git commit and push to `staging`.
6. Wait for Vercel to deploy the staging branch.

## Migration

`202607170006_smart_training_allocation.sql`

The migration adds team preferences, allocation runs, allocation items, secured save/publish RPCs, workspace loading and shared analytics data.

## Acceptance checks

### Regular-season assisted allocation

1. Open Annual Planner > Smart allocation.
2. Select Regular season and Assisted.
3. Save preferred days, start times and pitch preferences for two teams.
4. Build the draft.
5. Confirm each team has a reason, confidence score and alternatives.
6. Confirm named pitch areas are preferred over Full Pitch unless Full Pitch is required.

### Coach clash

1. Use two teams sharing an active Coach Hub person.
2. Give both teams the same preferred start time.
3. Rebuild the draft.
4. Confirm they are not allocated simultaneously.

### Winter allocation

1. Add an active winter site with fixed weekly slots.
2. Select Winter training.
3. Build the draft.
4. Confirm only winter inventory is used.
5. Confirm normal club pitches are not mixed into the winter run.

### Manual and automatic safety

1. Select Manual and build a run.
2. Confirm recommendations appear but Publish is unavailable.
3. Select Automatic Draft.
4. Confirm the run remains unpublished until the operator presses Publish.
5. Mark one team Manual only and confirm publication is blocked.

### Publication

1. Resolve all teams and publish an Assisted or Automatic Draft run.
2. Confirm recurring confirmed bookings appear on the shared calendar.
3. Confirm a later conflict causes the complete publication to roll back.
4. Confirm smart-run measures appear in Annual Planner Insights and main Analytics.

## Rollback

The installer creates a timestamped backup under `.daxora-backups`. If validation, migration, commit or push fails, the installer restores affected files. A database migration that has already completed must be reverted through a new forward migration rather than deleting migration history.

## Next roadmap phase

v3.10.8: closure-impact resolution, coach notifications, alternative acceptance and shared-calendar refinement.
