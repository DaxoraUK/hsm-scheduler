# Dashboard and Club Command Future Development

## Deployment and platform resilience

- Keep public API paths stable while consolidating Vercel Function entry points.
- Monitor function count and bundle size as new integrations are introduced.
- Revisit Vercel plan selection only when commercial usage justifies the infrastructure cost.

## Product simplification

- Merge useful Organisation Command information into Mission Control where it answers a club user's immediate questions.
- Keep advanced governance and executive controls behind Elite/role-aware access rather than primary navigation.
- Reduce duplicate status cards and command surfaces.
- Use direct resolution actions from Mission Control rather than requiring users to locate the owning workspace.

## Full-Time and fixture-source expansion

- Replace fragile single-page scraping assumptions with a source abstraction.
- Support multiple FA Full-Time league/competition sources per club.
- Add source health, last successful sync, import counts and actionable errors.
- Add duplicate protection and normalized fixture ingestion.
- Preserve manual fallback when an external source is unavailable.

## Commercial value

- Surface measurable administration time saved.
- Surface pitch/facility capacity recovered.
- Surface avoided operational costs and missed activity.
- Connect funding intelligence to evidence of potential financial value.
- Use these measures to validate pricing rather than reducing price without a value model.

## Deferred

- Removal of Organisation Command.
- Full navigation redesign.
- New AI-heavy dashboard functionality.
- New integrations beyond the fixture-source foundation.
- Further backend decomposition unless required by scale, security or provider isolation.
