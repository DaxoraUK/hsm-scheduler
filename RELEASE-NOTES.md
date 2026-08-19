# Daxora Ground Control v3.10.26 - Git Staging Repair

## Purpose
Repair the Windows release validation gate after v3.10.21 completed the full 131-file regression catalogue but lint could not start because the local npm launcher attempted to load missing `node_modules\npm\bin\npm-prefix.js` and `npm-cli.js`.

## Fix
The installer now invokes the pinned local Oxlint, TypeScript and Vite package entry points directly through `node.exe`. This removes the broken npm launcher from the lint and build gates while preserving real non-zero exit handling.

## Application scope
No application source behaviour is changed by this repair. The v3.10.21 navigation runtime repair remains the application baseline.

## Migration
The merged release contains the existing Supabase migration set. The installer now invokes the standalone Supabase CLI directly and does not depend on npm/npx.

## Validation
The Windows installer remains responsible for the full regression catalogue, direct Oxlint validation, TypeScript build, Vite production build, Git gates and Supabase gates.
