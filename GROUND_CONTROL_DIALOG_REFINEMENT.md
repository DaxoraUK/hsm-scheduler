# Ground Control dialog refinement

This update removes native browser `confirm()` and `alert()` prompts from the Operations workflow.

## Changes

- Schedule locking now uses a Ground Control confirmation dialog.
- Outstanding schedule issues are listed clearly before locking.
- Applying all optimiser recommendations now uses a branded success dialog.
- Pitch-clash overrides now show the conflicting fixture and time in a branded warning dialog.
- Missing pitch, missing kick-off, closed pitch and invalid time messages now use in-app toast notifications.
- The shared confirmation component now supports danger, warning, success and information tones, keyboard escape, outside-click cancellation and selectable initial focus.

## Validation

- 28 test files passed.
- 167 tests passed.
- TypeScript and production build passed.
- Lint completed with 0 errors and 79 pre-existing warnings.
- Entry bundle remains approximately 472 KB minified.
