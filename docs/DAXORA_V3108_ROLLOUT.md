# Daxora Ground Control v3.10.8 rollout

## Release

Club master scheduling rules and coach-managed team preferences.

## Installation

Run the packaged double-click installer from a fully extracted folder. The installer targets:

`C:\Development\hsm-scheduler`

It validates hashes, creates a backup, installs exact replacement files, runs tests/lint/build, checks and applies the linked Supabase migration, commits the scoped files and pushes `staging`.

## Migration

`202607170007_training_master_rules_and_coach_preferences.sql`

## Acceptance checks

### Club administrator

1. Open Annual Planner > Smart allocation.
2. Select Regular season.
3. Confirm the club default permits Monday-Friday and disables weekends.
4. Save a U14 age-group rule with a preferred time window.
5. Confirm U14 teams inherit that rule.
6. Set Coach changes to Approval required.

### Coach

1. Sign in through Coach Hub.
2. Open Training preferences.
3. Select an assigned team and Regular season.
4. Confirm Saturday and Sunday are disabled.
5. Save preferred days, times and pitches.
6. Confirm the change reports Pending approval.

### Club review

1. Return to Annual Planner > Smart allocation.
2. Review the pending coach proposal.
3. Approve it and confirm the team profile changes.
4. Submit another change and reject it with a reason.
5. Confirm the coach receives the decision in Coach Hub.

### Smart allocation

1. Build an Assisted regular-season draft.
2. Confirm weekend candidates are not used when disabled.
3. Confirm prohibited pitches are not offered.
4. Confirm the recommendation explanation identifies the inherited policy.
5. Create a scenario with no valid weekday capacity and confirm the team remains unassigned.
6. Repeat with Winter training and confirm only permitted winter sites are used.

## Rollback

Before modifying the project, the installer creates a timestamped backup under:

`C:\Development\hsm-scheduler\.daxora-backups\v3.10.8-<timestamp>`

If installation fails before a commit is created, affected files are restored automatically.

## Git fallback

```powershell
cd C:\Development\hsm-scheduler

git add src/lib/planning/trainingPolicyEngine.js
git add src/lib/planning/smartTrainingAllocationEngine.js
git add src/components/planning/TrainingSchedulingPolicyPanel.jsx
git add src/components/planning/SmartTrainingAllocationWorkspace.jsx
git add src/components/coach/CoachTrainingPreferences.jsx
git add src/pages/AnnualPlannerPage.jsx
git add src/pages/CoachHubPage.jsx
git add src/lib/supabase.js
git add supabase/migrations/202607170007_training_master_rules_and_coach_preferences.sql
git add tests/regression/training-master-rules-coach-preferences-v3108.test.js
git add docs/roadmaps/ANNUAL_PLANNER_SHARED_CALENDAR_COACH_REQUESTS_ROADMAP.md
git add docs/GROUND_CONTROL_V3108_TRAINING_MASTER_RULES_COACH_PREFERENCES.md
git add docs/DAXORA_V3108_ROLLOUT.md

git diff --cached --check

git -c commit.gpgSign=false commit `
  --no-gpg-sign `
  --no-verify `
  -m "Add Ground Control v3.10.8 training master rules and coach preferences"

npx supabase db push --linked --yes
git push origin staging
```
