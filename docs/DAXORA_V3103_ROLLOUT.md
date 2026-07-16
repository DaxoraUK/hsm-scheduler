# Daxora Ground Control v3.10.3 Rollout

## Installation

Run `DOUBLE-CLICK-THIS-INSTALL-AND-DEPLOY.cmd` from the fully extracted release folder.

The installer:

1. Verifies all payload hashes.
2. Backs up every affected project file.
3. Removes only recognised untracked files left by failed v3.10.2.5–v3.10.2.9 installers.
4. Installs complete replacement files.
5. Runs focused tests, the full regression suite, lint and the production build from `C:\Development\hsm-scheduler`.
6. Commits the repair locally.
7. dry-runs and applies the linked Supabase migration.
8. Pushes the `staging` branch for Vercel deployment.

## Post-deployment checks

1. Open Settings → Coach Hub.
2. Confirm Andrew Manville has U14 Spartans as Manager and Primary contact.
3. Open Settings → Teams → U14 Spartans.
4. Confirm Andrew Manville, email, mobile and preferred channel appear with the Coach Hub badge.
5. Return to Coach Hub and confirm unused Unnamed contact cards no longer appear.

## Expected completion message

`COMPLETE - v3.10.3 COACH HUB CONTACT JOIN REPAIR PUSHED`
