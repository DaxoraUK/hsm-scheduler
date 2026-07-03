# Customer onboarding implementation report

## Status

The application patch, database migration and regression coverage for the customer onboarding wizard are complete and locally validated. The onboarding database functions are not active in a Supabase project until `202607030003_customer_onboarding.sql` has been applied.

The existing Horwich St Mary's workspace is deliberately seeded as already complete by the migration. It will not be forced through setup or have its current configuration replaced. Owners and administrators can voluntarily re-run the wizard from **Settings → Setup wizard**.

## Onboarding flow

The wizard contains eight guided steps:

1. Welcome and setup scope
2. Club profile and primary contact
3. Optional workspace modules
4. Primary venue, postcode, weather and parking
5. Scheduling window, turnaround and concurrency rules
6. Teams and pitches
7. Full-Time FA fixture-source setup
8. Validation, review and completion

Progress is stored per club in Supabase and can be resumed on another signed-in device. Required onboarding cannot be dismissed; a voluntary re-run can be finished later.

## Existing and new club behaviour

- Clubs present when the migration is installed are marked `complete` and `required = false`.
- Future clubs receive a `pending`, required onboarding record automatically.
- A brand-new empty club opens with a clean workspace rather than Horwich-specific teams, pitches, venue or postcode.
- Existing clubs retain unknown/advanced team and pitch fields when the wizard is re-run.
- Existing secondary sites and non-primary resource assignments are preserved.
- A renamed primary site is migrated consistently across teams and pitches.

## Application changes

- Added a full-screen customer onboarding wizard.
- Added **Settings → Setup wizard** for owners and administrators.
- Added an onboarding status card to the Settings overview.
- Added resumable progress through the `useClubOnboarding` hook.
- Added validated conversion from wizard draft data into club, team, pitch, scheduling and integration records.
- Added UK-postcode, email, scheduling-window, team, pitch and secure Full-Time URL validation.
- Added automatic opening for newly provisioned clubs that require setup.
- Added a clean unconfigured-club hydration path so platform defaults do not leak Horwich data into another club.
- Persisted scheduling settings inside the club configuration so reopening the workspace keeps the onboarding values.
- Added readable audit labels for onboarding start, restart and completion.

## Database protections

- Added `public.club_onboarding`, keyed one-to-one to `public.clubs`.
- Enabled and forced Row Level Security.
- Read access uses the existing club boundary.
- Direct browser writes are revoked; all changes are RPC-only.
- Start, restart, save and completion require `public.can_manage_club`.
- Completion saves the club configuration and replaces only that club's team and pitch collections in one database transaction.
- Completion writes a trusted `onboarding.complete` audit event from `auth.uid()`.
- Every security-definer function uses an empty `search_path` and schema-qualified objects.

## Validation performed

- Oxlint completed with **0 errors** and 87 non-blocking existing warnings.
- **11 regression test files passed**.
- **70 regression tests passed**.
- TypeScript and Vite production build passed.
- Coverage thresholds passed: 62.07% statements, 51.82% branches, 66.83% functions and 66.47% lines across the configured engine coverage set.
- Main production JavaScript bundle is approximately **974 kB minified**; code splitting remains a launch-hardening task.
- The onboarding migration structure and guarded RPC requirements are regression-tested.

## Deliberately deferred

- Change Display Name/profile editing
- Automated welcome/invitation emails
- Subscription-plan selection during onboarding
- Payment collection
- Additional multi-site onboarding screens
- Reports v1 and Analytics v1 completion

## Not claimed

The migration has not been executed against the user's live Supabase project from this environment. Live progress persistence and transactional completion must be verified using the controlled rollout guide before relying on the wizard for a pilot club.
