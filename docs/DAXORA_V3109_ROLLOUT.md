# Daxora Ground Control v3.10.9 rollout

## Release

Closure recovery, coach alternatives, notifications and weather recovery.

## Prerequisites

- Ground Control v3.10.8.1 installed.
- Linked Supabase project available through the project CLI.
- Staging branch checked out.
- Existing Communications staging email pilot configuration retained.

## Installer

Run `DOUBLE-CLICK-THIS-INSTALL-AND-DEPLOY.cmd` from the fully extracted release folder.

The installer:

1. verifies payload hashes and text quality;
2. creates a timestamped project backup;
3. installs exact replacement and new files;
4. runs focused and complete regression tests;
5. runs lint and the production build;
6. dry-runs and applies the linked Supabase migration;
7. creates a scoped Git commit;
8. pushes `staging`.

## Migration

`202607170009_closure_alternatives_notifications_weather_recovery.sql`

## Staging acceptance

1. Create or use a confirmed team training booking.
2. Add a weather blackout or pitch closure overlapping the booking.
3. Open Annual Planner > Availability and select Review and resolve.
4. Offer a different pitch, area, date, time or winter slot.
5. Confirm the original calendar booking has not moved.
6. Sign in as the assigned coach and open Coach Hub > Requests.
7. Accept the alternative and confirm the calendar updates.
8. Repeat with a decline and confirm the item returns to the operator queue.
9. Test immediate relocation, postponement and cancellation.
10. Confirm Coach Hub messages are created and the staging email pilot receives enabled notifications.
11. Confirm closure-resolution metrics appear in Annual Planner Insights and main Analytics.

## Rollback

Before commit, the installer restores all affected files from its backup automatically. If the migration was applied but the application deployment must be rolled back, keep the additive schema in place and redeploy the previous application commit; the added table and columns are backward compatible.

## Git fallback

```powershell
cd C:\Development\hsm-scheduler

git add src/components/planning/ClosureImpactResolutionDialog.jsx
git add src/pages/AnnualPlannerPage.jsx
git add src/pages/CoachHubPage.jsx
git add src/lib/coach/coachHubEngine.js
git add src/lib/analytics/annualPlannerAnalyticsEngine.js
git add src/components/analytics/AnnualPlannerAnalyticsSummary.jsx
git add src/lib/supabase.js
git add supabase/migrations/202607170009_closure_alternatives_notifications_weather_recovery.sql
git add tests/regression/annual-planner-closure-alternatives-notifications-v3109.test.js
git add docs/roadmaps/ANNUAL_PLANNER_SHARED_CALENDAR_COACH_REQUESTS_ROADMAP.md
git add docs/GROUND_CONTROL_V3109_CLOSURE_ALTERNATIVES_NOTIFICATIONS_WEATHER_RECOVERY.md
git add docs/DAXORA_V3109_ROLLOUT.md

git diff --cached --check

git -c commit.gpgSign=false commit `
  --no-gpg-sign `
  --no-verify `
  -m "Add Ground Control v3.10.9 closure recovery and coach alternatives"

npx supabase db push --linked --yes
git push origin staging
```
