# Daxora Ground Control v3.10.10 rollout

## Release

Seasonal rollover, training waitlists, shared resources, operational buffers, participant capacity and Smart Allocation header refinement.

## Installation order

1. Confirm the project is on the `staging` branch.
2. Back up every affected file.
3. Install the exact replacement files.
4. Run the focused v3.10.10 regression tests.
5. Run the complete regression suite in controlled batches.
6. Run lint and the TypeScript/Vite production build.
7. Dry-run the linked Supabase migration.
8. Stage only the v3.10.10 files and run `git diff --cached --check`.
9. Commit, apply the linked migration and push `staging`.

## Migration

`202607170010_season_rollover_waitlist_resources_buffers.sql`

## Post-deploy checks

- Open Annual Planner > Resources & rollover.
- Create a shared resource and confirm it reloads after refresh.
- Add a waitlist entry and confirm it appears in shared analytics.
- Add resource requirements and buffers to a booking.
- Confirm overlapping capacity is blocked correctly.
- Create a regular-to-winter rollover preview and draft.
- Confirm existing live bookings are unchanged.
- Open Smart Allocation and confirm the setup header is not a single cramped inline row.

## Rollback

The installer restores source and documentation files from its backup if tests, build, migration dry-run, Git validation, migration or push fails. Database migrations are forward-only; if a database failure occurs after migration application, retain the migration and deploy the corrected application rather than deleting historical tables or columns.
