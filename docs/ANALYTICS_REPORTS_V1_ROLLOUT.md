# Ground Control Analytics v1 and Reports v1 — Rollout

## Prerequisites

Install this patch after the multi-club/RLS, roles/audit, onboarding, production UX and offline-access patches.

No Supabase SQL migration is required.

## Installation

From PowerShell:

```powershell
cd C:\Development\hsm-scheduler

git add .
git commit -m "Checkpoint before analytics and reports v1"
```

Extract `ground-control-analytics-reports-v1.zip` into:

```text
C:\Development\hsm-scheduler
```

Choose **Replace files in the destination**.

Run:

```powershell
npm run check
npm run test:coverage
```

Expected release-gate result:

```text
Test Files  13 passed
Tests       89 passed
Production build passed
```

Existing non-blocking lint warnings may still be shown.

Restart the application:

```powershell
npm run dev
```

## Verification

### Reports

1. Build a harmless test matchweek.
2. Open **Reports**.
3. Confirm the old Coming Next cards are gone.
4. Select **Current matchweek**.
5. Test Matchweek, Weekend, Saturday, Sunday and Midweek scopes where enabled.
6. Open each report type.
7. Export a fixture CSV and open it in Excel.
8. Use **Print / save PDF** and confirm only the report document appears.
9. Select a saved matchday and confirm current weather is not substituted for historical conditions.

### Analytics

1. Open **Analytics → Performance analytics**.
2. Confirm saved history is visible.
3. Test period and specific-matchday filters.
4. Test team, pitch and format filters.
5. Confirm pitch, team, format, parking and officials totals respond consistently.
6. Save a new matchweek with live weather available, then confirm weather evidence coverage appears in Analytics.

### Historical integrity

Select an older saved matchday whose car-park capacity differs from the current setting. The report and analytics parking figures must use the saved capacity, not today's capacity.

## Commit

After verification:

```powershell
git add src tests docs
git commit -m "Complete analytics and reports v1"
```
