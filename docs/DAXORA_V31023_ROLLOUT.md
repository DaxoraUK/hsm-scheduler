# Daxora v3.10.2.3 rollout

## Prerequisites

Ground Control v3.10.2.2 must already be installed locally. The installer applies migration `202607160003_coach_assignment_source_slot_and_contacts_rpc.sql` before pushing the release to `staging`.

## Acceptance

1. Open **Settings → Coach Hub**.
2. Select an existing coach and open **Teams & roles**.
3. Add a manager, coach or assistant role against a second team.
4. Confirm the role saves without a `source_slot` constraint error.
5. Close and reopen the dialog and confirm the assignment remains.
6. Open **Communications** and confirm the assigned adult is available for the relevant team.
7. Confirm the console contains no 404 for `list_team_contacts_v2` and no 400 for `save_coach_hub_team_assignment`.

## Rollback

The installer backs up `src/lib/supabase.js` and removes newly copied release files if pre-deployment validation fails. Once the database migration has been applied, do not manually reintroduce the old constraint because valid `directory` assignments may already exist.
