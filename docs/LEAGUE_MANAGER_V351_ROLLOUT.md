# League Operations v3.5.1 — Rollout

## Included files

- `src/lib/league/leagueOrdering.js`
- `src/lib/league/leagueManagerModel.js`
- `src/lib/league/leagueSchedulingEngine.js`
- `src/lib/league/leagueCommandCentre.js`
- `src/components/league/LeagueCommandCentreWorkspace.jsx`
- `src/pages/LeagueManagerPage.jsx`
- `src/lib/supabase.js`
- `supabase/migrations/202607140005_league_division_ordering_and_v351_ux.sql`
- `tests/regression/league-manager-ordering-and-v351.test.js`
- this rollout document and the v3.5.1 review document

## Automated verification completed

- Oxlint completed with the repository's existing non-blocking warnings only.
- 87 test files passed.
- 446 regression tests passed.
- TypeScript and Vite production build passed.
- Release evidence passed.

## Deployment sequence

The double-click installer performs this sequence:

1. verifies the extracted payload and target repository;
2. refuses unrelated local or staged changes;
3. creates a timestamped backup;
4. copies and verifies the v3.5.1 files;
5. runs the complete repository check;
6. stages only the v3.5.1 release files;
7. creates the Git commit;
8. runs commit-specific release evidence;
9. applies the Supabase migration;
10. pushes `staging` to GitHub;
11. verifies `HEAD` and `origin/staging` match.

The GitHub push should trigger the connected Vercel Preview deployment for `staging`.

## Acceptance checks

After deployment:

1. Open Results and Tables → League Tables.
2. Confirm the selector reads Premier Division, Division One, Division Two, Division Three, Division Four.
3. Check the same order in Fixture Command, Schedule Builder, Match Officials, Adjustments, Club calendars, Cup eligibility and League Structure forms.
4. Navigate to Results, refresh the browser and confirm the selected League Manager area is retained.
5. Return to Command Centre, allow it to load, then confirm relevant contextual tabs show queue badges.
6. Test browser back and forward between League Manager areas.
7. Confirm the Vercel deployment commit matches the installer completion commit.
