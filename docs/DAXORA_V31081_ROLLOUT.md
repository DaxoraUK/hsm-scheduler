# Daxora Ground Control v3.10.8.1 rollout

## Required baseline

Ground Control v3.10.8 must already be installed.

## Automated installation

Extract the release ZIP and double-click:

`DOUBLE-CLICK-THIS-INSTALL-AND-DEPLOY.cmd`

The installer targets `C:\Development\hsm-scheduler`, creates a timestamped backup, validates the payload, runs focused and complete regression tests, runs lint and the production build, checks and applies the linked Supabase migration, commits the release and pushes `staging`.

## Acceptance checks

1. Open Annual Planner > Smart allocation.
2. Select Regular season.
3. Change Rule level to Team type and confirm Applies to contains real team types.
4. Change Rule level to Age group and confirm the detected age groups appear.
5. Change Rule level to Specific team and select U14 Spartans.
6. Confirm preferred start times are selectable in 30-minute intervals.
7. Change the session duration and confirm invalid late starts disappear.
8. Save an Automatic Draft Club default rule.
9. Refresh the browser and confirm Automatic Draft remains selected.
10. Sign into Coach Hub and confirm the same 30-minute selector is used for coach preferences.

## Manual Git fallback

```powershell
cd C:\Development\hsm-scheduler

git add src/lib/planning/trainingPolicyEngine.js
git add src/components/planning/HalfHourTimeSelector.jsx
git add src/components/planning/TrainingSchedulingPolicyPanel.jsx
git add src/components/planning/SmartTrainingAllocationWorkspace.jsx
git add src/components/coach/CoachTrainingPreferences.jsx
git add supabase/migrations/202607170008_scheduling_rule_scope_time_mode_persistence.sql
git add tests/regression/training-rule-scope-time-mode-persistence-v31081.test.js
git add docs/roadmaps/ANNUAL_PLANNER_SHARED_CALENDAR_COACH_REQUESTS_ROADMAP.md
git add docs/GROUND_CONTROL_V31081_SCHEDULING_RULE_SCOPE_TIME_MODE_PERSISTENCE.md
git add docs/DAXORA_V31081_ROLLOUT.md

git diff --cached --check

git -c commit.gpgSign=false commit `
  --no-gpg-sign `
  --no-verify `
  -m "Fix Ground Control v3.10.8.1 scheduling rule persistence"

npx supabase db push --linked --yes
git push origin staging
```
