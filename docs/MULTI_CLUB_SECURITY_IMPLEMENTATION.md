# Multi-club and RLS implementation report

## Status

Application implementation is complete and locally validated. Production protection becomes active only after the supplied Supabase migration is run and the existing workspace is claimed by an explicitly authorised owner account.

## Main changes

- Added organisations, clubs and membership-based tenancy.
- Added owner, admin, scheduler and viewer role foundations.
- Kept membership writes closed to browser clients until dedicated role-management RPCs are built, preventing direct owner promotion or final-owner deletion.
- Added deny-by-default Row Level Security policies, with suspended or closed clubs excluded from membership access.
- Replaced anon-key bearer database requests with authenticated user JWT requests.
- Added automatic access-token refresh and explicit database errors.
- Added club-scoped reads, upserts, deletes and transactional collection replacement.
- Removed global delete-all persistence paths.
- Added a secure, allowlisted one-time bootstrap for existing single-club data.
- Added trusted audit actor attribution using `auth.uid()`.
- Restricted audit-log reading to club owners and administrators and audit-event creation to operational roles.
- Sealed the old browser-authored `audit_log` table.
- Added user-and-club-scoped local storage and one-time legacy cache migration.
- Added a club access gate and multi-club selector.
- Prevented a club switch from rendering the previous club's workspace while the next club loads.
- Made authentication, membership and other client-side policy failures fail closed instead of opening cached club data; only genuine network/server outages may use the selected club's isolated local cache.
- Made successful cloud reads authoritative so deleted cloud records are not resurrected from stale local cache.
- Added regression tests for bearer identity, club filters, scoped deletion, tenant upserts, audit spoofing and browser-cache isolation.

## Validation performed

- 7 test files passed.
- 42 regression tests passed.
- Production TypeScript/Vite build passed.
- The migration and isolation SQL both parsed successfully (106 and 26 statements respectively).
- Oxlint completed with 0 errors and 82 existing warnings.
- npm audit reported 0 vulnerabilities during dependency installation.
- Production bundle warning remains: the main JavaScript chunk is approximately 896 kB minified. Code splitting remains a separate launch-hardening task.

## Not claimed

The migration has not been executed against the user's live Supabase project from this environment. Live RLS behaviour must be verified using the rollout guide and the supplied isolation script before a second real club is added.
