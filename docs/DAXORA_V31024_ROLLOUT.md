# Daxora v3.10.2.4 rollout

## Prerequisite

Confirm Ground Control v3.10.2.3 is installed and migration `202607160003_coach_assignment_source_slot_and_contacts_rpc.sql` is present.

## Acceptance checks

### Team contact

1. Open **Settings → Coach Hub**.
2. Assign one adult to a team and enable **Primary team contact**.
3. Open **Settings → Teams** and select that team.
4. Confirm the protected contact card shows the adult’s name and a **Coach Hub** badge.
5. Expand the card and confirm email, mobile and preferred channel are visible.
6. Confirm the primary fields are managed through Coach Hub while assistant fields remain available.
7. Change the role or person in Coach Hub and confirm the Teams panel refreshes without a browser reload.

### Annual Planner Insights

1. Open **Annual Planner → Insights**.
2. Confirm the tab renders without the global recovery screen.
3. Confirm unavailable reporting data produces an amber warning rather than a crash.
4. Confirm Calendar, Bookings, Requests and Availability remain accessible.
5. Confirm pitch utilisation handles an empty dataset cleanly.

## Deployment evidence

After installation, verify:

```powershell
git fetch origin staging
git rev-parse HEAD
git rev-parse origin/staging
```

The two hashes must match.
