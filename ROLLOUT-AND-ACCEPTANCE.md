# v3.10.26 Rollout and Acceptance

## Scope
Windows installer lint/build toolchain repair only.

## Acceptance
- Full regression catalogue passes before lint.
- Oxlint runs directly from the pinned project dependency without npm.cmd.
- TypeScript build runs directly from the pinned project dependency.
- Vite production build runs directly from the pinned project dependency.
- A genuine non-zero lint/build exit still stops and rolls back the release.
- No Supabase migration is applied.

## Rollback
The installer creates timestamped backups and rolls back release files if any pre-commit validation gate fails.
