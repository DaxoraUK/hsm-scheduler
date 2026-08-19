# Dashboard and Club Command Roadmap

## Baseline

**Release:** v3.10.42 Dashboard and Club Command Simplification

Mission Control is the primary club operating overview. Club Command is the Elite leadership and governance view; it is no longer presented as a competing operational home.

## Current implementation baseline

- Mission Control / Dashboard
- Operations workspaces and matchday tooling
- Weather, parking, officials and readiness summaries
- Communications and coach messaging
- Analytics and funding evidence
- Coach Hub
- Annual Planner
- League Manager
- Elite Club Command
- Subscription and entitlement controls
- TeamFeePay acquisition/readiness tooling

## Known defects / decisions

1. Full-Time live imports require a configured public team or fixture page and must be checked against the club's fixture list before use.
2. Mission Control and Club Command must retain distinct operational and leadership purposes.
3. The product currently exposes more operational concepts than a typical grassroots user needs at once.
4. Role visibility must be derived from multiple assigned roles, scope and subscription rather than one membership role.
5. Shared operational metrics must remain sourced from shared operational data rather than duplicate calculations.

## Active phase

**Role-aware product simplification.** v3.10.42 uses the v3.10.41 effective multi-role access object and subscription entitlements as one shared navigation and rendering authority. Mission Control remains operational; Club Command is exposed only to entitled users with governance/audit permission.

## Acceptance criteria

- Consolidated source builds successfully on the target Windows environment.
- Full regression catalogue passes in controlled batches.
- Coach Hub, Annual Planner, League Manager and Elite functionality are reachable under their intended entitlements and role permissions.
- Mission Control remains the primary operational entry point.
- Club Command is labelled consistently and is hidden from support, operational-only and read-only users without governance permission.
- Eligible leaders can move from Mission Control to Club Command through one explicit handoff rather than duplicated executive cards.
- No existing Ground Control functionality is silently removed during consolidation.
- Full-Time FA reliability and multiple-source support are delivered by v3.10.43 without changing Mission Control ownership.

## Cross-module dependency: access architecture

Dashboard visibility and Club Command exposure consume the v3.10.41 effective permission object and package entitlements. No second role matrix is introduced.

## Dependencies

- Full-Time source availability remains an external operational dependency with manual fixture entry as the fallback.
- Subscription/entitlement authority.
- Shared operational data and scope model.
- Coach Hub team/contact authority.
- Vercel function-count constraint and the consolidated API gateway; this is a cross-module deployment dependency recorded for the dashboard/club-command release path.

## Pilot status

The consolidated codebase is ready for controlled Full-Time pilot imports. A successful import from each club's real configured sources remains required before paid-pilot acceptance.
