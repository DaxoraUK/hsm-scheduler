# Daxora v3.10.2.1 rollout

## Installation

Extract the package and run `DOUBLE-CLICK-THIS-INSTALL-AND-DEPLOY.cmd`.

The installer validates the payload, runs lint, all regression tests and the production build, creates a non-interactive commit, applies migration `202607160001`, pushes `staging`, and verifies the remote commit.

## Acceptance checks

1. Sign in and open Settings → Coach Hub.
2. Confirm the page loads without the global recovery screen.
3. Open Annual Planner → Insights.
4. Confirm coach engagement metrics load.
5. Confirm bookings, requests and approvals remain usable if the metrics endpoint is temporarily unavailable.
6. Confirm the browser console no longer shows repeated 400 responses from `list_coach_hub_pilot_metrics`.
7. Confirm the Vercel staging deployment uses the new commit.

## Rollback boundary

The migration only replaces one reporting function. It does not alter Coach Hub identities, requests, messages, bookings or entitlement data.
