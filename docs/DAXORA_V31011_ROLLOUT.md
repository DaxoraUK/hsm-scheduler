# Daxora Ground Control v3.10.11 Rollout

## Release

Ground Control v3.10.11 - Smart Refinement and Calendar Polish

## Installation

1. Extract the release ZIP fully.
2. Double-click `DOUBLE-CLICK-THIS-INSTALL-AND-DEPLOY.cmd`.
3. The installer targets `C:\Development\hsm-scheduler`.
4. The installer creates a backup before replacing files.
5. It runs focused tests, the complete regression suite, lint and the production build.
6. It commits only the v3.10.11 payload and pushes the `staging` branch.

No Supabase migration is included.

## Successful completion

`COMPLETE - v3.10.11 SMART REFINEMENT AND CALENDAR POLISH PUSHED`

## Acceptance checks

### Smart allocation

- Build a draft and lock one or more assigned teams.
- Rebuild the draft and confirm locked allocations do not move.
- Apply an alternative and confirm it is marked as an operator override.
- Compare the draft with the latest published allocation.
- Confirm changed teams display their previous allocation.
- Confirm unresolved teams show a clear reason and next action.
- Review preference success and slot fairness metrics.

### Rules and coach preferences

- Copy a master rule into another season.
- Create age-group defaults in bulk.
- Review a coach proposal and compare current versus proposed values.

### Calendar

- Use Annual Planner search, facility, status and closure filters.
- Confirm Full Pitch and named areas are easy to distinguish.
- Confirm simultaneous Half A and Half B bookings appear separately.
- Open Coach Hub week view and filter by facility and status.
- Start a request from an available calendar day.

### Analytics

- Confirm preference success, slot fairness, changed-from-usual and protected-allocation measures appear in Annual Planner Insights.
- Confirm the same values appear in main Analytics for the same period and filters.

## Rollback

The installer stores original files under:

`C:\Development\hsm-scheduler\.daxora-backups\v3.10.11-<timestamp>`

If validation, commit or push fails, the installer restores the affected files automatically.
