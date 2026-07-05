# Ground Control sidebar refinement

## Why this change was made

The previous short-screen fix created a visible nested browser scrollbar inside the navigation. It solved clipping but made the sidebar look unfinished.

## Changes

- Replaced the three large Saturday, Sunday and Midweek counter cards with compact fixture-count chips.
- Reduced the workspace card height while retaining club, plan, readiness and matchweek context.
- Made the full sidebar the only scroll container on short screens.
- Hid the native scrollbar while retaining mouse-wheel, touchpad, keyboard and touch scrolling.
- Applied the same behaviour to the mobile navigation drawer.
- Reduced navigation row height slightly without shrinking the text or icons.

## Validation

- 28 test files passed.
- 166 tests passed.
- TypeScript and production build passed.
- Lint completed with 0 errors and 79 existing warnings.
- Main entry bundle remains approximately 472 KB minified / 145 KB gzip.
