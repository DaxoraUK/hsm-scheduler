# Ground Control — Production UX Rollout

## 1. Create a checkpoint

From PowerShell:

```powershell
cd C:\Development\hsm-scheduler
git add .
git commit -m "Checkpoint before production UX hardening"
```

## 2. Install the patch

Extract `ground-control-production-ux-error-handling.zip` into:

```text
C:\Development\hsm-scheduler
```

Choose **Replace files in the destination**.

No Supabase SQL migration is required for this phase.

## 3. Run the release check

```powershell
npm run check
```

Expected result:

- 12 test files pass;
- 79 tests pass;
- production build passes;
- 0 lint errors;
- existing warnings may still be printed.

## 4. Restart the application

```powershell
npm run dev
```

If it was already running, stop it with `Ctrl + C` before restarting.

## 5. Acceptance checks

### Desktop and mobile navigation

1. Open Ground Control normally on desktop.
2. Narrow the browser to a phone-sized width.
3. Confirm the menu button opens the navigation drawer.
4. Confirm selecting a destination closes the drawer.
5. Confirm Escape closes the drawer.
6. Confirm role-restricted destinations remain hidden where appropriate.

### Offline recovery

1. Open browser developer tools.
2. Set the network to **Offline**.
3. Confirm the amber offline banner appears.
4. Attempt a harmless settings save.
5. Confirm Ground Control does not report a successful cloud save.
6. Restore the network.
7. Use **Retry sync** and confirm the error state clears.

Use a non-destructive setting for this test and restore its original value afterwards.

### Settings save feedback

1. Save a harmless settings change.
2. Confirm the button changes to **Saving…** while the operation runs.
3. Confirm **Saved** appears only after successful completion.
4. During an offline test, confirm **Not synced** and **Retry save** appear.

### Session lifecycle

1. Sign in and leave Ground Control open for a period.
2. Return to the tab and confirm the workspace remains available.
3. Sign out in another tab.
4. Return to the original tab and confirm it returns safely to authentication rather than continuing with stale access.

### Destructive confirmations

Without completing the destructive action, open the confirmation flows for:

- deleting a history entry;
- removing a member;
- transferring ownership.

Confirm each uses the Ground Control confirmation dialog, can be cancelled, closes with Escape and does not execute until explicitly confirmed.

### Error boundary smoke test

The error boundary is regression-tested and does not need to be deliberately triggered against live club data. Confirm only that normal startup succeeds and no blank page appears.

## 6. Commit after verification

```powershell
git add src tests
git commit -m "Harden production UX session recovery and sync handling"
```

## Rollback

If a release-blocking issue appears before committing:

```powershell
git restore src tests
```

If the patch was committed, use Git to revert the specific commit rather than deleting individual files.
