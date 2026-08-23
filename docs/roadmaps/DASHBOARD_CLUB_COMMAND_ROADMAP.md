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

### Matchweek workflow consolidation — v3.10.56

- Matchday now presents one six-stage command route: Import, Review, Allocate, Resolve, Notify and Lock.
- The command surface selects one next action and routes directly to the owning unresolved-fixture, officials, pitch-closure or communications section.
- Fixture count, unresolved work, pitch availability and lock state are consolidated in the command surface.
- The duplicate fixture-summary card has been removed from Saturday, Sunday and Midweek workspaces.
- Specialist schedule, competition-rule, resource, officials, weather, parking and communications detail remains available in collapsed sections.
- Existing operations permission, read-only subscription and schedule-lock boundaries continue to govern editing and consequential actions.

### Login-to-coach journey and role-aware simplification — v3.10.57

- Login describes the whole club platform—administration, matchweek operations and communications—without presenting every module before entry.
- After login, subscription entitlement, combined roles, assigned scope and workspace status determine the smallest useful navigation and action set.
- Mission Control owns the operator journey and presents one primary next action. Eligible leaders receive one secondary handoff to Club Command; the same handoff is not repeated in overflow actions.
- Club Command remains the governance, assurance and leadership surface and does not duplicate operational task management.
- Communications has an explicit `send_communications` capability. Communications Officers can prepare, review, copy and send coach updates without receiving fixture, settings or governance authority.
- Subscription read-only status disables communication as well as operational publishing. Support sessions remain visibly read-only.
- The end-to-end journey is: authenticate → enter the role-appropriate home → complete the next authorised task → resolve exceptions → prepare communications → review recipients → send or copy through an audited route → retain delivery evidence.
- Specialist depth remains available behind focused workspaces and collapsed detail; simplification must remove duplication, not capability.
- Coach Hub becomes the preferred first-party destination for authorised coach communications: Ground Control prepares and audits the message once, Coach Hub surfaces it to the correct team contacts, and configured external channels remain delivery or fallback routes rather than a separate source of truth.

### Shared approval integrity and live operator coordination

- Matchday locks are club-wide, permission-controlled and retained in the shared workspace rather than one browser.
- Every approval records the responsible operator, approval time and an exact fixture-version fingerprint.
- Coach Hub publication is rejected when the prepared fixtures do not match the locked version.
- Open matchday workspaces refresh approval state on focus and at a short interval, so a remote lock immediately stops editing without requiring a page reload.
- Cloudflare is planned as a complementary security layer for production DNS, Turnstile, rate controls and later document storage; Vercel remains the application host and Supabase remains the protected data authority.

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

Every Dashboard and Club Command surface must apply the mandatory access contract in `ACCESS_ARCHITECTURE_ROADMAP.md`: subscription entitlement + combined user permissions + assigned scope + account/workspace status. The same result governs navigation, component visibility, available actions and server-enforced data access.

This access contract is also a product-simplification mechanism. Users should see the smallest useful operating surface for their responsibilities; finance, safeguarding, governance, support and advanced operational controls must not create clutter for users who cannot or need not act on them.

## Dependencies

- Full-Time source availability remains an external operational dependency with manual fixture entry as the fallback.
- Subscription/entitlement authority.
- Shared operational data and scope model.
- Coach Hub team/contact authority.
- A declared role/package/scope/action matrix for every newly exposed dashboard capability.
- Vercel function-count constraint and the consolidated API gateway; this is a cross-module deployment dependency recorded for the dashboard/club-command release path.

## Pilot status

The consolidated codebase is ready for controlled Full-Time pilot imports. A successful import from each club's real configured sources remains required before paid-pilot acceptance.
