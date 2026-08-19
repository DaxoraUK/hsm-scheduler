# v3.10.45 Rollout and Acceptance

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
