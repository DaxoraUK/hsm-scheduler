# Ground Control Mission Hero Refinement

## Purpose

This patch improves the Mission Control hero so it functions as an operational summary rather than a decorative banner.

## Changes

- Replaces the oversized equal-weight action buttons with one clear primary action and a lighter secondary action.
- Keeps primary action text on one line and places the directional arrow after the label.
- Adds up to three concise live issue summaries for fixtures, officials and parking.
- Connects the workflow progress indicator visually to the action area.
- Renames `Live Status` to `Matchweek Status` and reduces the current clock to supporting information.
- Replaces the generic weather icon with an icon derived from the connected forecast conditions.
- Explicitly labels the weather forecast by selected matchday and date.
- Shows an honest unavailable/configuration state when no live forecast exists.
- Adds official-clash detection to Mission Control state, workflow status and the officials status strip.
- Changes the primary officials action to state the number of clashes or issues requiring review.

## Files

- `src/components/dashboard/DashboardMissionHero.jsx`
- `src/pages/DashboardPage.jsx`
- `src/lib/engines/workflowEngine.js`
- `tests/regression/mission-control-hero.test.js`

## Validation

- 30 test files passed
- 172 tests passed
- TypeScript passed
- Production build passed
- Lint completed with 0 errors and 79 existing warnings
- Entry bundle remains approximately 472 KB minified / 145 KB gzip
