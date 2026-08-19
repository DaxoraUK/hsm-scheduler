# v3.10.44 Rollout and Acceptance

## Installation

Target:
`C:\Development\hsm-scheduler`

Run:
`DOUBLE-CLICK-THIS-INSTALL-AND-DEPLOY.cmd`

Do not manually edit or reset the working tree before installation.

## Acceptance

1. Open Settings → Integrations and select “Add Lancashire Amateur feeds”.
2. Confirm five enabled sources appear for Premier through Division Four.
3. Save the settings and import Saturday 22 August 2026.
4. Confirm Horwich St. Mary's v Rossendale Football Club LAL appears at 14:30 from Division One.
5. Confirm feeds with no matching home fixture report zero rather than failing.
6. Confirm a disabled or invalid feed cannot clear the existing schedule.
7. Compare the imported fixture with the Lancashire Amateur League website and Full-Time.
8. Full regression, lint and production build pass.
9. Git staging contains only v3.10.44 release files.
