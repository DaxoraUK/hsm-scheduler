# Ground Control — Operations Centre hero refinement

## Purpose

This update turns the Operations Centre hero from a marketing-style banner into a compact operational header.

## Changes

- Replaces the fixed marketing headline with a scope-aware title:
  - Matchweek Operations
  - Weekend Operations
  - Midweek Operations
  - Saturday Operations
  - Sunday Operations
- Shows the selected period once in the hero and keeps editable dates in the toolbar below.
- Renames `Control score` to `Operational readiness`.
- Replaces the general incident metric with `Critical incidents`, while retaining total open-incident context.
- Adds a state-aware primary action:
  - Build the selected schedule when no schedule exists.
  - Review critical incidents when present.
  - Review the live priority queue when actions remain.
  - Open the command timeline when the queue is clear.
- Makes the hero action open the real priority-action section.
- Moves scope and date controls into a separate responsive toolbar.
- Removes the duplicate `Live weekend` control and uses a non-interactive `Current weekend` status instead.
- Shows both weekend and midweek date controls when Matchweek is selected.
- Prevents action labels from wrapping or being clipped.

## Validation

- 31 test files passed.
- 176 tests passed.
- TypeScript and production build passed.
- Lint completed with 0 errors and 79 existing warnings.
- Entry bundle remains approximately 472 KB minified / 145 KB gzip.
