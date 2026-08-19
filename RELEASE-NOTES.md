# Daxora Ground Control v3.10.32 - Multi-Role Access Architecture

## Delivered

- Replaced the single-role access calculation with additive multi-role workspace access.
- Added canonical club role catalogue covering leadership, administration, operations, finance, welfare, communications and team roles.
- Added club/team/site role-scope types and persisted `club_member_roles` assignments.
- Added guarded Supabase RPCs for listing, adding and revoking additional member roles.
- Preserved the legacy primary `club_memberships.role` for backward compatibility.
- Updated Access & Security to display multiple assigned roles and allow authorised administrators to add/remove additional roles.
- Updated Coach Hub regression coverage to test behaviour rather than the obsolete `coach: new Set([])` source string.
- Added regression coverage for Coach + Fixture Officer multi-role access.
- Retained the v3.10.29 Vercel legacy-handler deletion architecture.

## Deliberately not claimed

- Full-Time FA live integration is not declared production-ready by this release.
- Team/site selectors are not exposed until they are wired to authoritative registries.
- Dashboard/Club Command visual consolidation remains the next UX phase.

## Migration

`supabase/migrations/202608190001_multi_role_access_architecture.sql`
