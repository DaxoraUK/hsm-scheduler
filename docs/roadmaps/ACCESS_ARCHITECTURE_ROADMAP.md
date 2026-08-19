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

## Mandatory cross-platform access contract

Every existing and future Ground Control capability must derive effective access from all four authorities:

1. **Subscription entitlement** — whether the organisation owns the capability.
2. **User permissions** — what actions the person may perform through all applicable assigned roles.
3. **Assigned scope** — which club, team, site or organisation records those permissions cover.
4. **Account and workspace status** — whether access is active, read-only, suspended, expired or otherwise restricted.

No module may introduce a separate role matrix or rely on navigation visibility as its security boundary. The client may simplify and hide irrelevant controls, but Supabase RLS and capability-aware server/RPC checks remain authoritative.

Subscriptions set the organisation's capability ceiling. Roles and explicit permissions determine what a person may do within that ceiling. Scope determines which records they may access. Account and workspace status can restrict the resulting access further but can never expand it.

### Required module access definition

Every roadmap phase and material release must define and test:

- who may view, create, amend, approve, publish, communicate, export and delete;
- the subscription entitlement required for each capability;
- club, team, site and organisation scope behaviour;
- sensitive-field visibility, including finance, safeguarding and personal contact data;
- read-only, suspended, expired-subscription and downgrade behaviour;
- audit events for privileged and consequential actions;
- server/RPC authorization and RLS enforcement;
- navigation and action visibility derived from effective access;
- regression coverage for role combinations and cross-scope denial.

### Role experience principles

- Coaches and team managers see only their assigned teams and permitted team workflows.
- Operations roles can manage fixtures, facilities and officials without automatically gaining finance, safeguarding or subscription authority.
- Finance roles can manage authorised financial workflows without inheriting unrelated personal or operational permissions.
- Welfare and safeguarding access remains explicitly restricted and auditable.
- Club administrators manage configuration and membership only within their granted authority.
- Governance and executive views require both the relevant permission and subscription entitlement.
- Platform support access is explicit, time-bounded where appropriate and auditable; support status never implies unrestricted club-data access.
- Users should see the smallest clear interface needed for their responsibilities, reducing clutter without weakening security.

## Acceptance criteria

- A member can hold multiple functional roles without replacing the primary membership role.
- Club/team/site scope is stored explicitly.
- Access Security can add and remove additional roles.
- Effective client access combines applicable roles.
- Subscription, permissions, scope and account/workspace status combine into one effective access result.
- Coach Hub remains compatible with team-scoped coach access.
- Existing primary-role permissions remain unchanged.
- Migration uses the actual composite `club_memberships(club_id, user_id)` key.
- Focused and existing permission regressions pass.
- Every material module release includes its access definition and role/package/scope denial tests.

## Dependencies

- Shared team registry for authoritative team-scoped assignment UI.
- Shared site/venue registry for authoritative site-scoped assignment UI.
- Subscription entitlement authority.
- Dashboard/navigation access matrix.
- Coach Hub team assignment authority.

## Pilot status

Technical foundation only. Do not treat multi-role navigation or package-aware commercial access as complete until the following phases are delivered.
