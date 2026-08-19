# Daxora Ground Control v3.10.50 - HSM First-Team Horwich Alias Migration

## Delivered

- Visibly appends `Horwich` to the existing HSM 1st Team external fixture names.
- Applies the same exact first-team fallback inside scheduling before the migrated field is manually saved.
- Restricts the implicit fallback to the internal team named `HSM 1st Team`.
- Keeps the BBDFL U14 source migration and all v3.10.48 retention protections.

## Verification

- 16 focused Full-Time and external-team mapping tests pass.
- Production build passes.
- No database migration or Full-Time write-back is introduced.

## Previous release: v3.10.49

## Delivered

- Automatically recognises existing configured feed `167398131` and displays the canonical **BBDFL U14 - Horwich St. Mary's fixtures** label.
- Automatically appends the required `Horwich` fallback alias to existing and newly added BBDFL U14 sources.
- Does not require users to delete, recreate or manually rename their existing BBDFL source.
- Retains all v3.10.48 source-health and rolling fixture-snapshot protections.

## Verification

- 12 focused Full-Time regression tests pass.
- Production build passes.
- No database migration or Full-Time write-back is introduced.

## Previous release: v3.10.48

## Delivered

- Clearly labels official feed `167398131` as **BBDFL U14 - Horwich St. Mary's fixtures**.
- Persists the latest check, last success, matching fixture count, retained future count and current error for every configured source.
- Retains current and future fixtures when Full-Time's maximum-fixture feed window moves forward.
- Refreshes republished fixture details without duplicating the same dated home-team/opponent fixture.
- Shows saved source health on the collapsed fixture-source cards.
- Keeps failed-source snapshots and existing schedules intact.

## Verification

- Focused official-feed and parser regression suites pass.
- Production build passes.
- No database migration or Full-Time write-back is introduced.

## Previous release: v3.10.45

## Delivered

- Adds comma-separated external fixture names to every configured Ground Control team.
- Resolves provider names such as `Horwich St. Mary's` to the club's chosen internal name such as `HSM 1st Team`.
- Applies the mapped team's format, duration, pitch preferences and internal identity during scheduling.
- Preserves the original provider team name as `sourceHomeTeam` for audit and diagnostics.
- Adds a permanent local updater that finds an approved ZIP, verifies its SHA-256 sidecar, extracts it in isolation and invokes the packaged release installer.
- Retains the official Full-Time browser feeds delivered in v3.10.44.

## Safety

- Updates remain explicit and checksum verified.
- The existing strict dirty-file protection, backup, rollback, selective staging and staging push remain in force.
- No Full-Time access-control bypass or write-back is introduced.
