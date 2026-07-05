# Ground Control — Production UX and Error Handling

## Phase result

This phase hardens the existing launch-ready core against browser failures, temporary network loss, session expiry and unsuccessful Supabase saves. It does not add a new product module and it does not require a database migration.

## Changes delivered

### Application recovery

- Added a top-level React error boundary around the complete application.
- Unexpected render failures now stop safely and show a branded recovery screen rather than a blank page.
- Each failure receives a support reference that can be supplied to Daxora support.
- Users can reload the workspace or clear the local session and return to sign in.
- Club isolation, roles and Supabase Row Level Security remain active during recovery.

### Session lifecycle

- Added proactive access-token refresh before expiry.
- Added focus and visibility checks when users return to an open browser tab.
- Added cross-tab sign-out detection.
- Added clear expired-session handling.
- Temporary network or provider failures no longer erase an otherwise valid local session.
- Only genuine authentication rejection clears the stored session.

### Offline and cloud-sync handling

- Added browser online/offline detection.
- Added a global offline banner explaining that cloud saves cannot complete.
- Failed Supabase writes now remain visibly unsynchronised rather than appearing successful.
- Retryable failed operations are retained and exposed through a global **Retry sync** action.
- Matchweek history is retained locally when cloud publication fails, with an explicit device-only warning.
- Settings save bars now show **Saving**, **Saved**, **Not synced** and **Retry save** states.
- Workspace hydration and pitch-closure synchronisation now expose recoverable errors.

### Mobile navigation and responsive shell

- Added a proper mobile navigation drawer and menu button.
- Added Escape-key closing and body-scroll locking while the drawer is open.
- Preserved role-aware navigation and club context on mobile.
- Reduced workspace padding on smaller screens.
- Added accessible current-page state to navigation items.

### Safer destructive actions

- Added a reusable accessible confirmation dialog.
- Replaced native browser confirmations for:
  - deleting history entries;
  - removing club members;
  - transferring club ownership.
- Added busy, failure and cancellation states around those actions.

### Global unhandled-error feedback

- Added handling for unhandled promise rejections.
- Users receive a recovery toast and support reference instead of failures disappearing only into the developer console.

## Validation

- 12 regression test files passed.
- 79 regression tests passed.
- Production TypeScript/Vite build passed.
- Oxlint completed with 0 errors and 87 existing non-blocking warnings.
- Session-refresh regression tests prove that:
  - temporary refresh failures preserve the session;
  - authentication rejection clears an expired session.
- New production UX tests cover:
  - support-reference generation;
  - session-refresh timing;
  - offline and cloud-sync banner states;
  - top-level error-boundary installation;
  - mobile navigation structure.

## Remaining launch work

- The production bundle is approximately 991 kB minified and still triggers Vite's large-chunk warning. Route/component code-splitting remains required as a separate performance task.
- Existing lint warnings remain technical-debt cleanup rather than release errors.
- This phase does not replace formal browser/device acceptance testing.
- Display-name editing remains on the core launch to-do list.
- Reports v1 and Analytics v1 remain required before pilot launch.
