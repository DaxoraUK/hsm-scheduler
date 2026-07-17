# Daxora Ground Control v3.10.5.1 Rollout

## Prerequisite

Ground Control v3.10.5 must already be installed, including:

`supabase/migrations/202607170001_shared_calendar_request_workflow.sql`

## Automated installation

1. Extract the release ZIP fully.
2. Double-click `DOUBLE-CLICK-THIS-INSTALL-AND-DEPLOY.cmd`.
3. Leave the command window open while validation, the production build, Git and Supabase complete.
4. Wait for Vercel to deploy the `staging` branch.

The installer targets `C:\Development\hsm-scheduler` and creates a timestamped backup under `.daxora-backups` before replacing any file.

## Pilot check

### Pitch areas

1. Open **Settings → Pitches**.
2. Open Pitch 4.
3. Set **Simultaneous training teams** to `2`.
4. Add `Half A` and `Half B`.
5. Save, leave the panel and return to confirm both names persist.

### Simultaneous calendar bookings

1. Create or approve a Pitch 4 training booking on Half A.
2. Create or approve another overlapping training booking on Half B.
3. Confirm both appear separately in the Annual Planner calendar and selected-day panel.
4. Attempt another booking on Half A and confirm it is blocked.
5. Attempt a third simultaneous booking and confirm Pitch 4 capacity blocks it.

### Request refresh

1. Keep **Annual Planner → Requests** open in the operator browser.
2. Submit or edit a request in the coach browser.
3. Confirm the request list updates quietly within approximately six seconds.
4. Confirm switching back to the operator browser refreshes immediately.
5. Confirm the main **Refresh** button also updates the workspace.

## Migration

`202607170002_pitch_area_calendar_refresh_repair.sql`

## Rollback

The installer stores every replaced file in:

`C:\Development\hsm-scheduler\.daxora-backups\v3.10.5.1-<timestamp>`

The migration is forward-compatible and does not remove columns or data. If source deployment must be rolled back, restore the backed-up application files and push the resulting commit. The area-aware functions can safely remain in the database because they preserve the previous whole-pitch capacity behaviour when no area is selected.
