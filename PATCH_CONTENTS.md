# Patch contents — Daxora Admin and Support Tooling

This archive contains only files changed for this phase.

## Application

- `src/AppCore.jsx`
- `src/hooks/useClubAccess.js`
- `src/hooks/usePlatformOperator.js`
- `src/layout/HeaderProfile.jsx`
- `src/layout/ProductShell.jsx`
- `src/lib/platform/adminModel.js`
- `src/lib/supabase.js`
- `src/pages/PlatformAdminPage.jsx`

## Supabase

- `supabase/migrations/202607030005_admin_support_tooling.sql`
- `supabase/tests/admin_support_tooling.sql`

## Regression tests

- `tests/regression/admin-support-model.test.js`
- `tests/regression/admin-support-repository.test.js`
- `tests/regression/admin-support-tooling-migration.test.js`

## Documentation

- `docs/ADMIN_SUPPORT_TOOLING_IMPLEMENTATION.md`
- `docs/ADMIN_SUPPORT_TOOLING_ROLLOUT.md`
- `PATCH_CONTENTS.md`

No `.env`, keys, `node_modules`, `dist`, `.git`, package lock replacement or service-role credential is included.
