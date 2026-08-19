# v3.10.29 Rollout and Acceptance

## Scope
Vercel API function consolidation legacy-entry cleanup.

## Acceptance
- The installer runs from the `staging` branch.
- Each superseded API entry is verified against its expected SHA-256 before deletion.
- Superseded API entries are backed up before deletion.
- `api/` contains exactly one deployable JavaScript function entry.
- The 16 handler sources remain under `server-api/`.
- Existing public API paths and the daily automation cron remain unchanged.
- Full regression catalogue, lint, TypeScript build, Vite build, Git and Supabase gates pass.

## Rollback
The installer restores all backed-up replacement and deletion targets, removes newly created files, and stops without leaving a partial installation if any pre-commit gate fails.
