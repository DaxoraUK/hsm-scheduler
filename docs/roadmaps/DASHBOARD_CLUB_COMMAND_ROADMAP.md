# Dashboard and Club Command Roadmap

## Baseline

**Release:** v3.10.27 Vercel API Function Consolidation

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

**Consolidate, validate and simplify.** The merged baseline is validated, and the current deployment blocker is the Vercel Hobby Serverless Function limit. v3.10.27 consolidates the existing API handlers behind one Vercel catch-all function without changing the public API paths. After deployment reliability is restored, navigation, role exposure and terminology will be simplified from the merged baseline.

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
- Vercel function-count constraint and the consolidated API gateway; this is a cross-module deployment dependency recorded for the dashboard/club-command release path.

## Pilot status

The consolidated codebase is a technical baseline, not a declaration that every surfaced module is commercially ready. Paid pilot readiness will follow product simplification and Full-Time reliability work.
