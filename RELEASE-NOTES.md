# Daxora Ground Control v3.10.45 - External Team Mapping and Verified Updater

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
