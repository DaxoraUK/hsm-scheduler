# Roles, audit and safe support implementation report

## Status

The application patch, database migration and regression coverage are complete and locally validated. The new protection is not active in a Supabase project until `202607030002_roles_audit_support.sql` has been applied.

This phase does not impersonate a club user. Daxora support signs in with its own dedicated account and receives an explicitly approved, time-limited, read-only route through Row Level Security.

## Role model

| Role | Read workspace | Operate matchdays | Publish matchweeks | Manage settings | Manage members | Review audit | Grant support | Transfer ownership |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Owner | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| Administrator | Yes | Yes | Yes | Yes | Yes | Yes | No | No |
| Scheduler | Yes | Yes | Yes | No | No | No | No | No |
| Viewer | Yes | No | No | No | No | No | No | No |
| Daxora Support | Yes | No | No | No | No | No | No | No |

Administrators can manage schedulers and viewers. Only the owner can add or alter another administrator, grant support access or transfer ownership. The current owner cannot demote or remove themselves through a normal role edit.

## Main application changes

- Added a role and permission model shared by navigation, settings, publishing and operational persistence.
- Added **Settings → Access & audit** for owners and administrators.
- Added member listing, guarded role changes, member removal and explicit ownership transfer.
- Added single-use invitation links tied to the exact invited email address and stored only as a SHA-256 token hash.
- Added trusted audit history showing the authenticated user, role, source, action and timestamp.
- Added owner-controlled support sessions with a reason and a 15–120 minute duration.
- Added a persistent read-only support banner, session expiry display and an explicit **End support session** action.
- Added a read-only viewer banner and disabled page controls for viewer/support access.
- Removed settings navigation and settings search routes from roles without administration permission.
- Rechecks access on browser focus and visibility changes. Active support sessions also recheck every 30 seconds so revocation closes the workspace promptly.
- Added a user profile mirror for account email and display name foundations. The user-requested **Change Display Name** screen remains a separate launch task and is not included in this security phase.

## Database protections

- Created `user_profiles`, `club_invitations`, `platform_support_staff` and `support_access_sessions`.
- Membership, invitation, ownership and support changes are available only through guarded `SECURITY DEFINER` RPCs.
- All security-definer functions use an empty `search_path` and schema-qualified objects.
- Operational browser writes are now RPC-only. Direct `INSERT`, `UPDATE` and `DELETE` grants are revoked from authenticated clients for history, referees, teams, club configuration, pitches and pitch closures.
- Supported mutations write their audit event in the same database transaction. A browser can no longer skip the audit call or submit a free-form actor identity/action.
- Direct audit-table access is revoked. Owners and administrators review audit history through a guarded RPC.
- Support sessions add only a `SELECT` route through RLS. Existing owner/admin/scheduler write policies remain membership-based.
- Support helper RPCs can inspect only the signed-in support identity, not arbitrary user IDs.
- A support account cannot be granted support access to a club where it already has an active membership.
- Ownership-transfer audit is captured before the old owner is demoted, preserving the correct historical role.

## Audited write paths

The following operations now mutate data and write an audit event atomically:

- Club configuration save
- Team, pitch, referee and pitch-closure collection replacement
- Matchweek publication
- Saved matchweek deletion
- Demonstration fixture save
- Invitation create, accept and revoke
- Member role change and removal
- Ownership transfer
- Support grant, open, revoke and self-end

## Validation performed

- Oxlint completed with 0 errors. Existing warnings remain non-blocking.
- 9 regression test files passed.
- 58 regression tests passed.
- TypeScript and Vite production build passed.
- Main production JavaScript bundle is approximately 927 kB minified; code splitting remains a later launch-hardening item.
- The role/audit/support migration parsed successfully as 131 SQL statements.
- The updated cross-club isolation test parsed successfully as 26 SQL statements.
- The role and support proof parsed successfully as 59 SQL statements.

## Not claimed

The migration has not been executed against the user's live Supabase project from this environment. Live role changes, invitations and support access must be verified using the controlled rollout guide before inviting real club users.
