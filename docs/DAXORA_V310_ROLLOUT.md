# Daxora v3.10 — Rollout and Acceptance Guide

## Release contents

Ground Control v3.10 adds the Annual Pitch Booking, Training and Friendlies Planner and migration:

```text
202607150003_annual_pitch_booking_training_friendlies.sql
```

It requires the v3.9.2 pilot-hardening baseline and the v3.9.1 finance migration.

## Commercial acceptance

Confirm all three package paths:

1. A Core club without the override sees **Annual Planner · Add-on** in navigation and receives the branded subscription gate.
2. A Core club with `entitlement_overrides.annual_planner = true` receives full access.
3. Pro and Elite clubs receive full access without overrides.

The Link package remains held and does not receive the planner.

## Database rollout

Run from the authenticated repository:

```powershell
npx supabase migration list --linked
npx supabase db push --linked
npx supabase migration list --linked
```

Verify migration `202607150003` appears locally and remotely.

## Functional acceptance

### Annual calendar

- Open **Annual Planner**.
- Move between years and months.
- Select a day and add a one-off training session.
- Search for it in the booking register.
- Export the year and confirm the CSV opens correctly.

### Recurring training

- Create a weekly winter-training series for at least six weeks.
- Confirm every occurrence appears.
- Attempt a second series on the same pitch and time.
- Confirm the save is blocked and alternatives are shown.
- Remove one occurrence and then test whole-series removal.

### Friendlies

- Create a friendly with an opponent, contact and booking reference.
- Confirm the friendly total increases.
- Confirm the opponent and contact appear in the booking drawer and export.

### Matchday integration

- Ensure Saturday or Sunday fixtures exist for a date in the selected year.
- Confirm they appear as protected match bookings in Annual Planner.
- Attempt to create training on the same pitch and time; it must be blocked.
- In Matchday Planner, attempt to drag a fixture into a confirmed annual booking or blackout; it must be blocked.

### Blackouts

- Create a full-pitch maintenance blackout.
- Confirm overlapping booking creation is blocked.
- Confirm a different pitch remains available.

### Approval policy

- Enable approval requirements.
- Sign in as an operator who is not an owner or administrator.
- Create or edit a booking.
- Confirm the record is submitted as `requested` even if the client payload is altered.
- Approve it as an owner or administrator.

### Cost privacy

- Disable cost visibility for schedulers.
- Sign in as a non-administrative operator.
- Confirm planned-cost metrics, cost input and supplier reference are absent.
- Export the year and confirm no cost column is present.
- Inspect the annual workspace response and confirm `cost_pence` and `supplier_reference` are absent.

## Security acceptance

- A user outside the club cannot list or change annual-planner records.
- A viewer can read the planner but cannot create or change bookings.
- An operator can manage bookings and blackouts but cannot change planner policy.
- An owner or administrator can change policy and approve requests.
- Removing the annual-planner entitlement immediately blocks all planner RPCs.
- Audit history records booking, blackout and settings events.

## Release evidence

After commit creation:

```powershell
$env:RELEASE_ENVIRONMENT="staging"
$env:RELEASE_ID=(git rev-parse --short HEAD)
npm run release:evidence
npm run pilot:hardening
```

## Vercel acceptance

After pushing `staging`:

- confirm the local and remote commit hashes match;
- confirm Vercel creates a Preview deployment for `staging`;
- perform the package, approval, cost-privacy and Matchday conflict checks on that deployment;
- capture the successful booking series, blocked conflict and Core add-on gate as pilot evidence.

## Rollback

The installer creates a file backup before copying the release. If migration application fails, do not manually delete migration records. Restore the files from the installer backup, inspect the Supabase error and correct through a forward migration.
