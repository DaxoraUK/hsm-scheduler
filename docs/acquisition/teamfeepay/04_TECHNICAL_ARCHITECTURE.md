# Technical architecture summary

## Product baseline

The uploaded acquisition baseline contains:

- React and Vite client application;
- TypeScript/JavaScript domain and service layers;
- PostgreSQL/Supabase data model and row-level security;
- Supabase Edge Functions for server-authoritative workflows;
- 75 additive migrations in the uploaded baseline;
- 128 regression-test files in the uploaded baseline;
- 299 source files in the uploaded baseline;
- Vercel deployment configuration;
- release, acceptance and staging scripts;
- module roadmaps, audits and operating documentation.

Counts must be regenerated from the final diligence commit before being stated contractually.

## Core domains

- Multi-organisation access and subscriptions.
- Club, team, person and role management.
- Matchday and pitch-allocation engines.
- Facility, site and pitch-area resources.
- Annual Planner bookings and capacity.
- Coach Hub requests and communications.
- League competitions, calendars and operations.
- Unified analytics and reporting.
- Platform administration, audit and support controls.

## TeamFeePay integration boundary

The acquisition layer adds:

- `src/lib/integrations/teamfeepay/contracts.js`
- `src/lib/integrations/teamfeepay/mapper.js`
- `src/lib/integrations/teamfeepay/mockAdapter.js`
- `src/lib/integrations/teamfeepay/httpAdapter.js`
- `docs/integrations/teamfeepay/openapi.yaml`
- `scripts/teamfeepay-demo-api.mjs`

The mock adapter is the only active provider connector. The HTTP adapter cannot operate without an authorised API base URL and credential.

## Integration options

### Option A — separate integrated service

TeamFeePay remains the member and financial system. Daxora runs as a separately deployed operational service with SSO and event synchronisation.

**Advantages:** fastest time to market and preserves working Daxora logic.
**Trade-offs:** two deployed services and an explicit integration boundary.

### Option B — progressive product absorption

TeamFeePay initially integrates the Daxora service, then ports selected domain services and UI workflows into its own application.

**Advantages:** early value followed by stack consolidation.
**Trade-offs:** requires a managed migration programme.

### Option C — domain-logic and specification acquisition

TeamFeePay uses Daxora's data models, rules, tests, workflows and product evidence as the validated specification for an internal implementation.

**Advantages:** full alignment with the buyer's stack.
**Trade-offs:** slower value realisation and less direct reuse.

## Production integration requirements

Before live TeamFeePay connectivity:

- written authorisation and named technical owner;
- API and webhook specification;
- authentication and key-rotation process;
- permitted organisations and data scopes;
- controller/processor responsibilities;
- lawful-basis and consent analysis;
- member and child-data minimisation;
- rate limits, retries and replay protection;
- field-level authority and conflict resolution;
- deletion, correction and subject-right workflows;
- penetration testing and security review;
- observability and incident ownership;
- sandbox and production acceptance plans.
