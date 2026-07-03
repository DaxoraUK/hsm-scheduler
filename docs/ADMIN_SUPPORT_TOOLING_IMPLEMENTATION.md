# Daxora Ground Control — Admin and Support Tooling

## Phase result

This phase adds a separate Daxora platform-operations workspace for internal administration and support. It is not a club-admin page and club roles do not grant access to it.

The implementation builds on migrations through `202607030004_entitlements_subscriptions.sql` and introduces migration:

- `202607030005_admin_support_tooling.sql`

## Platform roles

Two internal roles are supported:

- **Platform Administrator** — may review clubs and support cases, assign plans, change subscription status, and suspend or reactivate a club.
- **Support Operator** — may review platform metadata and manage support cases, but cannot change commercial access or suspend a club.

Platform status is stored in `platform_support_staff`. It is deliberately separate from club memberships. A club owner, administrator or scheduler does not become Daxora staff.

## New platform workspace

Authorised users receive a **Daxora Admin** navigation item. The workspace includes:

- club search and filtering
- club, owner, onboarding and subscription summaries
- team, pitch, venue, membership and history counts
- subscription plan and status controls for platform administrators
- club suspension and reactivation controls
- support case creation, assignment, priority, status and notes
- active owner-approved support-session visibility
- a safe route into an accessible club workspace
- Daxora platform activity history

The page is lazy-loaded as a separate production chunk.

## Support access boundary

Platform metadata access does not grant operational workspace access.

A Daxora operator can open fixtures, settings or operational club records only when either:

1. they are already a genuine member of that club; or
2. the club owner has granted a valid, time-limited read-only support session.

The platform console cannot create its own support session. This preserves the owner-approval model established in the roles and permissions phase.

## Database changes

The migration adds:

- `platform_role` to `platform_support_staff`
- `platform_activity_events`
- `platform_support_cases`
- `platform_support_case_notes`
- a traceable case-number sequence
- forced RLS and revoked direct browser access for the new tables
- security-definer RPCs with explicit internal-role checks

Commercial and suspension changes require a written reason and are written to both the club audit trail and the Daxora platform activity trail.

## Commercial controls

The existing manual subscription RPC is tightened so that only a Platform Administrator can use it. The catalogue remains:

- Link
- Core
- Pro
- Elite

No payment provider is connected in this phase. The controls are for safe manual plan assignment before billing integration.

## Security decisions

- No service-role key is exposed to the application.
- Platform users cannot self-authorise from the browser.
- Support Operators cannot grant themselves Platform Administrator status.
- Support Operators cannot assign plans or suspend clubs.
- Club users cannot read Daxora support cases or platform activity.
- New internal tables have forced RLS and no direct authenticated table privileges.
- All browser access uses signed-in-user JWTs and guarded RPCs.
- Operational club records remain protected by club membership or an owner-approved support session.

## Application files

- `src/AppCore.jsx`
- `src/hooks/useClubAccess.js`
- `src/hooks/usePlatformOperator.js`
- `src/layout/HeaderProfile.jsx`
- `src/layout/ProductShell.jsx`
- `src/lib/platform/adminModel.js`
- `src/lib/supabase.js`
- `src/pages/PlatformAdminPage.jsx`

## Test coverage

New regression coverage verifies:

- platform role normalisation
- Link plan compatibility
- support-case validation and case numbering
- platform metrics
- guarded repository payloads
- explicit reason fields for sensitive actions
- administrator-only SQL controls
- forced RLS and revoked direct table access
- continued owner approval for operational support access

A staging-only SQL security proof is included at:

- `supabase/tests/admin_support_tooling.sql`

## Validation result

- 19 test files passed
- 117 tests passed
- coverage thresholds passed
- 0 lint errors
- 88 existing non-blocking warnings
- production build passed
- migration parsed as 58 PostgreSQL statements
- security proof parsed as 21 PostgreSQL statements
- the platform page was emitted as a separate production chunk

The migration was not executed against the live Supabase project during development.

## Deferred items

The following are deliberately not part of this phase:

- live billing/payment collection
- legal-document acceptance
- in-app creation or elevation of Daxora staff accounts
- writable support impersonation
- unrestricted operational access
- Change Display Name

`Change Display Name` remains on the core launch list.
