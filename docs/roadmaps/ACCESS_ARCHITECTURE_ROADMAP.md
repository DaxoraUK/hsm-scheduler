# Access Architecture Roadmap

## v3.10.41 baseline

**Release:** v3.10.41 Multi-Role Access Architecture

The club access model now supports a primary legacy membership role plus multiple additional functional roles. Additional roles carry explicit club/team/site scope. The UI and client access model can combine applicable roles without replacing the primary membership role.

## Current implementation baseline

- Existing primary membership roles remain compatible: Owner, Admin, Scheduler, Viewer.
- Additional functional roles:
  - Chair / Director
  - Club Secretary
  - Fixture Officer
  - Operations Officer
  - Treasurer / Finance
  - Welfare / Safeguarding
  - Communications Officer
  - Team Coach
  - Team Manager
  - Volunteer
- Additional role assignments are stored separately from `club_memberships`.
- Team/site scope is represented in the assignment model.
- Access & Security displays and manages additional roles.
- Effective client permissions combine applicable primary and additional roles.
- Supabase remains the authoritative security boundary for existing privileged operations.

## Known limitations

- Existing privileged Supabase RPCs still use the legacy primary membership role for administrative authorization.
- Team/site assignment UI currently records scope through the role model but does not yet expose authoritative team/site pickers.
- Package entitlements are not overridden by role assignment; package-aware navigation is the next phase.
- League roles remain separate from club roles.

## Active phase

v3.10.41 establishes the multi-role data and access foundation.

## Acceptance criteria

- A member can hold multiple functional roles without replacing the primary membership role.
- Club/team/site scope is stored explicitly.
- Access Security can add and remove additional roles.
- Effective client access combines applicable roles.
- Coach Hub remains compatible with team-scoped coach access.
- Existing primary-role permissions remain unchanged.
- Migration uses the actual composite `club_memberships(club_id, user_id)` key.
- Focused and existing permission regressions pass.

## Dependencies

- Shared team registry for authoritative team-scoped assignment UI.
- Shared site/venue registry for authoritative site-scoped assignment UI.
- Subscription entitlement authority.
- Dashboard/navigation access matrix.
- Coach Hub team assignment authority.

## Pilot status

Technical foundation only. Do not treat multi-role navigation or package-aware commercial access as complete until the following phases are delivered.
