# Daxora Ground Control v3.10.12 Rollout

## Release

Ground Control v3.10.12 - Annual Planner Module Completion

## Installation

1. Extract the release ZIP fully.
2. Double-click `DOUBLE-CLICK-THIS-INSTALL-AND-DEPLOY.cmd`.
3. The installer targets `C:\Development\hsm-scheduler`.
4. It creates a timestamped backup before replacing files.
5. It runs focused tests, the complete regression suite, lint and the production build.
6. It performs a linked Supabase migration dry run.
7. It commits only the v3.10.12 payload, applies the migration and pushes `staging`.

## Migration

`202607170011_waitlist_offers_bulk_feeds_grant_acceptance.sql`

## Successful completion

`COMPLETE - v3.10.12 ANNUAL PLANNER MODULE COMPLETION PUSHED`

## Acceptance checks

### Waiting-list offers

- Add a team to the training waiting list.
- Offer a specific available pitch or winter slot.
- Sign in as the assigned coach and confirm the offer appears in Coach Hub.
- Accept the offer and confirm a single confirmed booking is created.
- Repeat with decline and confirm the team returns to waiting status.
- Attempt acceptance after deliberately occupying the slot and confirm it fails closed.

### Bulk operations

- Select two test bookings.
- Preview and apply a status change.
- Move compatible bookings to another pitch or area.
- Shift test bookings by a day.
- Confirm one incompatible booking stops the complete transaction rather than creating a partial result.

### Calendar feeds

- Create a whole-club private calendar feed.
- Subscribe through a calendar client or open the endpoint directly.
- Confirm public bookings and blackouts appear.
- Confirm costs and private notes are absent.
- Revoke the feed and confirm the old link stops working.

### Analytics and evidence

- Compare waiting-list and offer totals in Annual Planner Insights and main Analytics.
- Export the grant-evidence CSV.
- Confirm requested, approved, unmet and delivered hours use the same shared totals.
- Confirm cost-per-delivered-hour and waitlist outcomes are included when data exists.

### Module acceptance

- Open Annual Planner -> Delivery & feeds.
- Complete each readiness check with controlled pilot data.
- Preserve evidence of the HSM summer, winter, weather, closure, Coach Hub and grant-export scenarios.

## Rollback

The installer stores original files under:

`C:\Development\hsm-scheduler\.daxora-backups\v3.10.12-<timestamp>`

If source validation, tests, build, migration, commit or push fails, the installer restores the affected files automatically. A migration that has already been applied cannot be removed automatically and must be handled through a new corrective migration.
