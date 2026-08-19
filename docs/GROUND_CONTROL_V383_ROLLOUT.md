# Ground Control v3.8.3 rollout and acceptance

## Prerequisite

Daxora v3.8.2 must already be present on the `staging` branch.

## Automated checks

The installer performs:

1. Git branch and working-tree safety checks.
2. SHA-256 verification of the six release files.
3. Backup of all replaced files.
4. Lint.
5. All Vitest regression tests in four shards.
6. TypeScript and Vite production build.
7. Exact release-file staging.
8. Non-interactive Git commit.
9. Release evidence generation.
10. Push to `origin/staging` and remote commit verification.

There is no Supabase migration in this release.

## Staging acceptance

Test Saturday and Sunday separately.

1. Build a schedule containing at least three fixtures and two configured pitches.
2. Open Fixtures → Timeline.
3. Drag a fixture to another suitable pitch and a new kick-off slot.
4. Confirm the fixture moves immediately and all dependent readiness and parking figures update without rebuilding.
5. Use Undo and confirm the original pitch and kick-off return.
6. Drag onto a closed pitch and confirm the move is blocked.
7. Drag onto an unsuitable pitch format and confirm the move is blocked.
8. Drag into an occupied or linked-pitch slot and confirm the clash warning and alternatives appear.
9. Create a parking advisory and confirm a branded warning dialogue appears before the move can be applied.
10. Confirm an accepted change displays Unsaved changes.
11. Select Save changes and confirm the governed matchweek save succeeds.
12. Refresh after saving and load the saved matchweek to confirm the moved fixture is retained.
13. Lock the schedule and confirm dragging is disabled.

## Vercel

After the installer pushes `staging`, confirm the new commit appears in Vercel as a Preview deployment and complete the acceptance steps against that deployment.
