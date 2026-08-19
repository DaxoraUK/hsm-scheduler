# v3.10.48 Rollout and Acceptance

## Automated acceptance

1. Verify every packaged payload hash before replacement.
2. Confirm the focused Full-Time parser and browser-feed tests pass.
3. Confirm the production build succeeds.
4. Rehearse the exact ZIP in a disposable Git repository.
5. Install and push only the verified release payload.

## Pilot acceptance

1. Open Settings → Fixture connections and confirm feed `167398131` is labelled BBDFL U14.
2. Confirm every source is collapsed by default and displays its saved health evidence.
3. Import a known U14 fixture and confirm last-success, matching and retained counts update after refresh.
4. Confirm a future fixture retained from an earlier read remains available when it falls outside Full-Time's current maximum-fixture response.
5. Confirm a deliberately failed source records the failure without removing its last successful snapshot or existing schedule.

## Previous v3.10.45 acceptance

## Installation

Target:
`C:\Development\hsm-scheduler`

Run:
`DOUBLE-CLICK-THIS-INSTALL-AND-DEPLOY.cmd`

Do not manually edit or reset the working tree before installation.

## Acceptance

1. Open Settings → Teams and select `HSM 1st Team`.
2. Set External fixture names to `Horwich St. Mary's, Horwich St Mary's` and save.
3. Import the Division One fixture for Saturday 22 August 2026.
4. Confirm it schedules as `HSM 1st Team` using that team's 11v11 format and configured pitch.
5. Confirm the original Full-Time name remains available as source provenance.
6. Confirm the updater refuses a ZIP with a missing or incorrect SHA-256 sidecar.
7. Full regression, lint and production build pass.
8. Git staging contains only v3.10.45 release files.
