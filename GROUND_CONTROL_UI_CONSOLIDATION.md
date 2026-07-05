# Ground Control — UI consolidation

## What changed

- Consolidated reusable interface components into the canonical `src/ui` library.
- Moved `ConfirmDialog` into `src/ui`.
- Removed the old `src/components/ui` compatibility layer.
- Removed eight empty and unused placeholder source files.
- Added regression checks preventing duplicate UI paths and empty source placeholders from returning.

## Validation

- 24 test files passed.
- 139 tests passed.
- Production build passed.
- Oxlint completed with 0 errors and 82 existing warnings.

## Installation

1. Extract the update into the project root and replace the included files.
2. Open PowerShell in the project root.
3. Run:

```powershell
.\apply-ui-consolidation.ps1
npm run check
npm run dev
```

## Expected behaviour

This is an architecture cleanup. Existing screens and workflows should look and behave the same.

## Rollback

Restore the checkpoint commit made before installation, or revert the consolidation commit after installation.
