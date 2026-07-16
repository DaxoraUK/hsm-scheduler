# Ground Control v3.10.2.1 — Coach Hub runtime hotfix

## Fault corrected

The Coach Hub pilot metrics RPC could return HTTP 400 when called without an explicit date range. Settings uses that default-range path. The request failure could then prevent the surrounding workspace from completing its load and expose the global recovery screen.

## Corrections

- Replaces the fragile default-year expression with deterministic `make_date` boundaries.
- Validates the requested date range before executing metric queries.
- Aggregates message acknowledgement receipts without duplicating message rows.
- Treats pilot metrics as supplementary data: a reporting failure can no longer block Annual Planner, Coach Hub contacts, invitations, requests, approvals or bookings.
- Shows a controlled amber warning when metrics are temporarily unavailable.
- Adds regression protection for both the SQL boundary logic and graceful frontend fallback.

## Database migration

`202607160001_coach_hub_pilot_metrics_runtime_hotfix.sql`

The migration recreates the existing `list_coach_hub_pilot_metrics(uuid,date,date)` function and preserves authenticated execution only.
