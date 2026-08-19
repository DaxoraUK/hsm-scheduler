# Dashboard and Club Command Roadmap

## Baseline

**Release:** v3.10.21 Navigation Runtime Fallback Repair

The dashboard baseline is now consolidated with the TeamFeePay feature branch. Mission Control remains the primary club operating overview. Coach Hub, Annual Planner, League Manager and Elite/Organisation Command are present in the consolidated codebase but their final navigation and role exposure are deliberately not yet simplified.

## Current implementation baseline

- Mission Control / Dashboard
- Operations workspaces and matchday tooling
- Weather, parking, officials and readiness summaries
- Communications and coach messaging
- Analytics and funding evidence
- Coach Hub
- Annual Planner
- League Manager
- Elite / Organisation Command
- Subscription and entitlement controls
- TeamFeePay acquisition/readiness tooling

## Known defects / decisions

1. Full-Time FA fixture integration is not considered production reliable.
2. Multiple Full-Time sources are required rather than a single source configuration.
3. Mission Control and Organisation Command overlap and need information-architecture consolidation.
4. The product currently exposes more operational concepts than a typical grassroots user needs at once.
5. Shared operational metrics must remain sourced from shared operational data rather than duplicate calculations.

## Active phase

**Consolidate, validate and simplify.** No feature is removed merely because it is complex. Navigation, role exposure and terminology will be decided after the merged baseline has been validated.

## Acceptance criteria

- Consolidated source builds successfully on the target Windows environment.
- Full regression catalogue passes in controlled batches.
- Coach Hub, Annual Planner, League Manager and Elite functionality are reachable under their intended entitlements.
- Mission Control remains the primary operational entry point.
- No existing Ground Control functionality is silently removed during consolidation.
- Full-Time FA is tracked as a separate reliability phase.

## Dependencies

- Full-Time FA source model and reliable import implementation.
- Subscription/entitlement authority.
- Shared operational data and scope model.
- Coach Hub team/contact authority.

## Pilot status

The consolidated codebase is a technical baseline, not a declaration that every surfaced module is commercially ready. Paid pilot readiness will follow product simplification and Full-Time reliability work.
