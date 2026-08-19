# Daxora Ground Control v3.10.29 - Vercel API Legacy Entry Cleanup

## v3.10.29 - Legacy Entry Cleanup

Fixes the v3.10.27/28 API consolidation rollout so the Windows installer removes the 16 superseded Vercel Serverless Function entry files from `api/` after moving their handler source to `server-api/`. The installer verifies each deletion target against its expected pre-consolidation SHA-256, backs it up before deletion, stages the deletions, and restores them during rollback if any pre-commit gate fails.

Also fixes the consolidation regression test to normalize Windows path separators when checking the relocated webhook handlers.

## Acceptance

- `api/` contains exactly one deployable JavaScript entry: `api/[...path].js`.
- The 16 legacy `api/...` handler files are absent after installation.
- All 16 handler source files remain under `server-api/`.
- Existing public `/api/...` paths remain unchanged.
- Daily automation remains `/api/automation/daily`.
- Full regression catalogue, lint, TypeScript build, Vite build and Git gates must pass.
