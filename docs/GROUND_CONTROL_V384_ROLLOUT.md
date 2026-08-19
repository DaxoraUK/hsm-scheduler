# Ground Control v3.8.4 rollout and acceptance

## Prerequisite

Ground Control v3.8.3 must already be installed. The installer verifies the v3.8.3 timeline regression contract before changing the repository.

## Database

No Supabase migration is required.

## Automated validation

The release was validated with:

- 95 regression files;
- 481 regression tests;
- targeted v3.8.3 and v3.8.4 planner tests;
- TypeScript production build;
- Vite production build;
- lint with zero errors;
- clean v3.8.3-to-v3.8.4 payload overlay;
- payload SHA-256 verification;
- final ZIP extraction verification.

The repository retains 60 pre-existing non-blocking lint warnings.

## Staging acceptance

After deployment, test Saturday and Sunday with representative fixtures:

1. Open Operations and expand the matchday timeline.
2. Confirm the planner opens in Timeline on desktop and Pitch board on a narrow/mobile viewport.
3. Use Fit day and each zoom level.
4. Drag only from the dedicated handle.
5. Confirm clicking the fixture body opens the selected-fixture drawer rather than starting a move.
6. Move a fixture to a valid slot and verify the draft action bar appears.
7. Undo and redo the move.
8. Open Review changes and verify the old/new pitch and kick-off are correct.
9. Attempt a move to a closed pitch.
10. Attempt a move to an unsuitable pitch.
11. Attempt a same-pitch or linked-pitch clash.
12. Confirm blocked moves show the relevant reason and alternatives.
13. Create an advisory parking move and confirm it requires explicit approval.
14. Toggle closures, parking, officials and warnings overlays.
15. Use the drawer pitch/time controls on a touchscreen or narrow viewport.
16. Confirm Discard changes requires a branded confirmation and restores the saved state.
17. Save the schedule, refresh, and confirm the saved move remains in Operations and the timeline.
18. Repeat the core move/save checks on both Saturday and Sunday to confirm shared behaviour.

## Git and Vercel

The installer commits only the v3.8.4 release files and pushes `staging`. Vercel should then create a Preview deployment for that commit.

Verify:

```powershell
cd C:\Development\hsm-scheduler
git fetch origin staging
git rev-parse HEAD
git rev-parse origin/staging
```

The two hashes must match.
