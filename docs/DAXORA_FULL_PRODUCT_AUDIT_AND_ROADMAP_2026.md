# Daxora Ground Control and League Manager — Full Product Audit and Roadmap

**Audit date:** 15 July 2026
**Repository baseline inspected:** `staging` at `2873ea3`
**Current product build:** Ground Control v3.10 Annual Pitch Booking, Training and Friendlies Planner

## Executive verdict

Daxora is no longer a scheduling prototype. It is a substantial grassroots-sport operating platform with secure multi-organisation data, club matchday control, league competition administration, portals, communications, governance, analytics and finance.

The codebase is suitable for a controlled design-partner pilot. It is **not yet ready for an unrestricted commercial launch**. The remaining risk is less about missing screens and more about proving the whole service under real operational load: browser-level acceptance, migrations, backups, support, performance, accessibility, provider configuration and repeatable onboarding.

The right commercial strategy is to stop adding unrelated modules, prove the integrated core with real clubs and a real league, and turn the strongest workflows into measurable time and risk savings.

## Where the product is now

### Platform foundation — delivered

- React/Vite application with shared product shell and role-sensitive navigation.
- Supabase authentication, organisation membership and forced RLS migrations.
- Subscription entitlements and fail-closed access controls.
- Platform administration, support tooling and audit events.
- Vercel staging deployment workflow and release-evidence scripts.
- Daxora interaction system, persistent notifications and installed-app identity.
- Server-side communications and daily automation foundation.

### Ground Control — advanced pilot capability

- Full-Time import and manual fixture workflows.
- Saturday, Sunday and Midweek scheduling through shared engines.
- Pitch suitability, closures, linked-pitch clashes and kick-off spacing.
- Matchday Planner with pointer-based movement, validation, undo/redo and draft save.
- Parking-capacity modelling and operational readiness.
- Officials assignment, clash warnings and suggestions.
- Coach communications and delivery status.
- Live weather intelligence shared across Dashboard, Operations and Matchday.
- Operational history, reports, analytics and grant-evidence workspaces.

### League Manager — advanced pilot capability

- League structure, divisions, seasons, clubs, teams, venues and competitions.
- Fixture generation, real meeting formats and schedule assurance.
- Secure club portal, publication, acknowledgements and club change requests.
- Full-Time fixture/result reconciliation and calendar feeds.
- Results, tables, deductions, exceptional outcomes and cup progression.
- Officials pools, assistants and appointment operations.
- Discipline, hearings, sanctions, appeals and club responses.
- Player registrations, transfers, eligibility, dispensations and team sheets.
- Executive analytics, compliance scorecards, scheduled report delivery and archive.
- Finance ledger, club statements, fines and expenses.
- v3.9.1 bulk billing, automated reminders, document delivery and payment reconciliation.
- v3.9.2 platform health, support diagnostics, accessibility safeguards and repeatable pilot evidence.
- v3.10 annual pitch booking, recurring training, friendlies, blackouts and Matchday facility protection.

## Technical evidence from this audit

- Clean dependency installation completed.
- TypeScript and Vite production build completed.
- Full regression suite passes after v3.10: **101 files and 509 tests**.
- Lint completes with no errors; existing warning debt remains.
- PostgreSQL parser accepts the new v3.9.1 migration.
- The repository contains approximately **106,000** JavaScript, TypeScript and SQL lines across product, server, migrations and tests.
- There are no product `alert()`, `confirm()` or `prompt()` calls.

### Structural debt found

Several core files are too large for long-term development speed and safe ownership:

- `src/AppCore.jsx` — approximately 2,889 lines;
- `src/lib/supabase.js` — approximately 2,500 lines;
- `src/pages/MatchdayPage.jsx` — approximately 1,674 lines;
- multiple analytics, onboarding, scheduling and planner files around or above 1,000 lines.

The production build succeeds, but some route chunks remain large. This is not an immediate pilot blocker, but it will slow future work and affect lower-powered mobile devices unless addressed.

## What makes Daxora worth the price

The product should be sold around outcomes rather than feature quantity.

### For clubs

- Fewer fixture, pitch, parking and referee mistakes.
- Faster matchday planning and controlled change handling.
- One operational record instead of spreadsheets and message threads.
- Better evidence for facility decisions and funding applications.
- Clearer coach communication and accountability.

### For leagues

- One competition command centre from fixture generation through publication and results.
- Club self-service without surrendering league control.
- Discipline, registration and finance workflows linked to the same clubs, teams and fixtures.
- Reduced repeat administration through bulk operations and scheduled delivery.
- Board-ready evidence, compliance views and audit history.

### Proof required during pilot

Daxora should measure:

- administrator hours saved each week;
- fixture and publication errors prevented;
- result and acknowledgement turnaround;
- referee coverage improvement;
- overdue balance reduction;
- support cases per active organisation;
- successful matchdays run without spreadsheet fallback.

Those results will justify pricing more convincingly than a long feature list.

## Potential improvements

### P0 — before controlled paid launch

1. **Real staging acceptance:** execute all migrations remotely and complete end-to-end scenarios with representative club and league data.
2. **Browser-level E2E coverage:** add Playwright journeys for onboarding, schedule publication, club acknowledgement, result verification, discipline response, registration approval and finance collection.
3. **Backup and recovery proof:** test organisation export, database restore and accidental-change recovery rather than relying only on written runbooks.
4. **Observability:** central error tracking, API failure dashboards, provider-health status and support correlation references.
5. **Accessibility:** formal keyboard, focus, contrast, screen-reader and zoom audit to WCAG 2.2 AA target.
6. **Data protection:** complete DPIA, retention rules and secure managed document storage for player and discipline evidence.
7. **Provider readiness:** verify Resend domain, cron secret, VAPID keys and production environment variables.
8. **Pilot support model:** named escalation route, incident ownership, service-status communication and response expectations.

### P1 — strongest revenue and retention improvements

1. Native invoice PDF and credit-note generation.
2. Payment links and payment-provider integration.
3. Bank-feed/Open Banking and accounting-package connectors.
4. Guided club and league onboarding with import mapping and validation.
5. Full-Time two-way reconciliation with controlled exception queues.
6. Finance-period locking, controlled reversals and treasurer close packs.
7. Ground Control multi-fixture planner moves and richer capacity overlays.
8. Communications distribution lists, WhatsApp/SMS provider options and consent controls.
9. Subscription checkout, upgrades, renewals and self-service account administration.
10. Executive implementation dashboard showing adoption and unresolved setup tasks.

### P2 — product quality and scale

1. Split the largest pages and Supabase client into domain modules.
2. Reduce route bundle sizes and prefetch the next likely workspace.
3. Standardise tables, filters, drawers, empty states and bulk-action patterns.
4. Add universal command search across clubs, teams, fixtures, people and finance records.
5. Improve mobile and tablet layouts through real-device pilot testing.
6. Add large-dataset pagination, virtualised tables and server-side filtering.
7. Add public API keys, webhooks and integration audit logs.
8. Add sandbox/demo organisations with resettable realistic data.

### P3 — strategic differentiation

1. Multi-league and county/federation oversight.
2. Cross-organisation venue, referee and fixture intelligence with explicit governance.
3. Benchmarking that protects club privacy and explains methodology.
4. Human-approved AI assistance for schedule alternatives, case summaries, communications and board reports.
5. Governing-body reporting packs and structured data exchange.
6. Native companion experience only where web/PWA evidence proves a genuine need.

## Full roadmap

### Current — v3.10 Annual Pitch Booking, Training and Friendlies Planner

Delivered in this build:

- full calendar-year facility planning;
- weekly and fortnightly training series;
- internal and external friendlies;
- camps, tournaments, maintenance and external hire;
- requests, approvals and facility blackouts;
- cost, contact and booking-reference records;
- conflict protection against annual bookings and current matchdays;
- Core add-on packaging with inclusion in Pro and Elite.

### v3.10.1 — Annual Planner Pilot Refinement

Only evidence-led refinements from real club use:

- touch and tablet calendar testing;
- drag-to-reschedule where it reduces administration;
- school-holiday and exception patterns;
- team self-service requests;
- team calendar feeds and coach invitations;
- facility supplier documents and cost reconciliation;
- external venue-calendar integration discovery.

### v4.0 — Controlled Paid Launch

- hosted subscription checkout and renewals;
- production organisation provisioning;
- Core add-on activation and billing;
- guided onboarding and customer-success checklist;
- in-product help, support and service status;
- legal acceptance and data-processing records;
- production monitoring and incident handling;
- first controlled paying club and league cohorts.

Link remains held back until League Manager connectivity creates meaningful value.

### v4.1 — Integrations and Finance Completion

- Full-Time controlled two-way sync;
- payment links and payment reconciliation connectors;
- native PDF and credit-note generation with finance period close;
- accounting exports and integrations;
- communications provider expansion;
- API and webhook foundation;
- facility and membership integrations.

### v4.2 — Mobile and Field Operations

- touch-first matchday and annual-planning boards;
- offline-safe operational checklists;
- rapid incident, result and attendance capture;
- push-action workflows;
- venue and pitch inspection records;
- governed evidence capture.

### v4.3 — Intelligence and Benchmarking

- season-on-season operational trends;
- anonymous peer benchmarking;
- venue-capacity and investment modelling;
- referee supply forecasting;
- club-risk and compliance trends;
- grant and facility evidence packs with source provenance.

### v5.0 — League Network and Federation

- multi-league administration;
- county and federation views;
- shared officials and venue governance;
- inter-league competition support;
- governing-body data exchange;
- network-level insight under explicit data-sharing controls.

## Recommended immediate decision

Deploy v3.10 to staging and prove a real pre-season, winter-training and friendly-booking cycle with Horwich St Mary’s. Do not begin another broad module until that workflow, Matchday integration and the v3.9.2 launch-confidence evidence are accepted. The next increase in value comes from controlled onboarding, reliable operation and proof that clubs save time across an entire calendar year.
