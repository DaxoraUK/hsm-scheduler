# Ground Control — Operational UX corrections

This cumulative patch completes the operational fixes identified during the visible UX review while preserving route-level code splitting.

## Changes included

### Responsive sidebar
- Moves the workspace summary directly below the brand so it cannot be pushed below the viewport by extra admin navigation.
- Makes the navigation list independently scrollable on desktop and mobile.
- Keeps the workspace summary visible at short laptop heights and higher browser zoom levels.

### Mission Control matchweek build
- Replaces the passive navigation-only action with **Build Matchweek**.
- Opens a day-selection dialog for Saturday, Sunday and enabled midweek scheduling.
- Selects configured days by default and identifies existing or locked schedules.
- Runs selected schedule builders in sequence.
- Opens Operations Centre after generation for cross-day review.
- Keeps **Open Operations** as a separate secondary action.

### Schedule timeline presentation
- Removes trailing punctuation from pitch names.
- Converts machine labels such as `11v11-youth` into `11v11 Youth`.
- Uses a wider, clearer pitch-label column and compact bordered label tiles.
- Reduces the minimum timeline width while retaining horizontal scrolling on narrow screens.

### Schedule lock
- The lock button now protects the selected club/day/date from fixture edits, manual changes, rebuilding and optimiser moves.
- Locked schedules remain viewable and printable.
- Lock state survives navigation and refresh in the same browser.
- Locking with unresolved fixtures or outstanding official issues requires confirmation.

The current lock is browser-persistent. A shared database-backed lock with role enforcement and an audit record remains a staging/pilot hardening task before multi-user production use.

### Day optimiser
- **Review improvements** opens the optimiser section.
- Individual validated moves can be applied.
- All validated moves can be applied after confirmation.
- Optimiser actions are disabled while the schedule is locked.

### Current Reports v1 printing
- Operations print actions now route to the current Reports v1 fixture-allocation document for the selected day.
- The report opens with current data and triggers the browser print/save-PDF dialog.
- Legacy Saturday, Sunday and combined print-sheet components are removed.

### Duplicate removal
- Removes the unused day-specific unresolved-card wrappers.
- Retains the shared unresolved workflow for Saturday, Sunday and midweek.
- Removes the obsolete dashboard insight component if it remains from an earlier extraction.

### Performance retained
- Dashboard, Operations, day workspaces, Communications, Analytics, Reports, Settings and platform administration remain lazy loaded.
- The production entry bundle remains approximately 472 KB minified rather than returning to the previous 1 MB bundle.

## Validation

- Lint: 0 errors, 79 existing warnings
- Test files: 26 passed
- Tests: 161 passed
- TypeScript build: passed
- Production build: passed
- Entry bundle: approximately 471.83 KB minified / 144.73 KB gzip

## Manual acceptance checks

1. Reduce the browser height or increase zoom and confirm the workspace card remains visible while navigation scrolls.
2. On Mission Control, choose **Build Matchweek**, select multiple days and confirm Operations Centre opens after the builds finish.
3. Open an Operations schedule and confirm pitch labels and formats display cleanly.
4. Lock a schedule, refresh, and confirm editing/rebuilding remains disabled; then unlock it.
5. Open **Review improvements** and apply one validated move, then test **Apply all validated moves** where available.
6. Select **Print current report** and confirm Reports v1 opens for the correct day and launches the print/save-PDF dialog.
