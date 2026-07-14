# League Operations v3.6 — Discipline, Compliance and Case Management

## Release purpose

League Operations v3.6 adds a controlled discipline workflow to the existing fixture, results, club-portal and league-table platform. It replaces disconnected notes, emails and spreadsheets with one auditable case record while preserving strict separation between confidential league work and club-visible correspondence.

## Delivered operator workflow

The new **Discipline & compliance** workspace contains five focused views:

1. **Command** — open cases, overdue club responses, hearings, active sanctions, unpaid fines and appeals.
2. **Cases** — searchable case register, guided case creation and a complete case detail view.
3. **Sanctions & fines** — warnings, fines, points deductions, suspensions, ground closures and exclusions.
4. **Hearings & appeals** — hearing preparation and appeal review queues.
5. **Reports** — case-register and club-compliance CSV exports.

Every case can hold:

- a generated case reference;
- incident, fixture, club and team links;
- allegation type, priority and status;
- charges and rule references;
- league-confidential or club-visible timeline events;
- external evidence links restricted to HTTP or HTTPS;
- hearing information;
- decisions, sanctions and appeals;
- a complete league audit record.

## Club portal

Clubs now have a dedicated **Discipline** portal tab. It only exposes non-confidential cases connected to that club. Club users can:

- read the case, charges, sanctions and club-visible timeline;
- submit a formal response;
- acknowledge a decision;
- submit payment evidence notes;
- add secure evidence links;
- submit an appeal after a decision.

League-confidential notes and documents are not returned to club portal users.

## Roles and security

v3.6 adds a dedicated `discipline` league role. Full case access is restricted to:

- league owners;
- league administrators;
- discipline officers;
- platform administrators operating under the existing support controls.

Fixture, results, officials and viewer roles do not receive the discipline workspace or confidential case payload. The database enforces this independently of the interface through security-definer access checks and row-level security.

Club access remains scoped to the authenticated club membership and only to cases where that club is the reporting or respondent club. Confidential cases remain league-only.

## Sanctions and league tables

An active team points deduction automatically creates or updates the linked `league_table_adjustments` record. Revoking or serving that sanction revokes the linked table adjustment. This keeps discipline decisions and published league tables aligned without duplicate manual entry.

Other supported sanctions are:

- warning;
- fine;
- match suspension;
- date suspension;
- ground closure;
- competition exclusion;
- suspended sanction;
- other controlled sanction.

## Command centre and reporting hooks

The League Operations command centre now includes:

- overdue discipline responses;
- overdue fines;
- hearings and open appeals;
- total open discipline cases;
- a discipline-officer role focus.

The command centre remains compatible during migration rollout: it treats the v3.6 RPC as unavailable until the migration is applied instead of breaking the wider operations dashboard.

v3.6 also establishes structured reporting inputs for the later full League Analytics and Reports phase:

- case volume and status;
- case type and priority;
- response timeliness;
- hearings and appeals;
- sanctions and fines;
- club compliance scorecards;
- points deductions linked to table data.

The included CSV reports are operational exports, not the final cross-module analytics suite.

## Database objects

Migration `202607140007_league_discipline_compliance_case_management.sql` adds:

- `league_discipline_cases`
- `league_case_charges`
- `league_case_events`
- `league_case_documents`
- `league_case_sanctions`
- `league_case_appeals`

It also adds the discipline role, access functions, data RPCs, write RPCs, RLS policies, indexes, audit writes and points-deduction integration.

## Acceptance coverage

The v3.6 regression contract verifies:

- payload normalisation and command metrics;
- overdue response and fine identification;
- role-focused command ordering;
- case and club compliance CSV output;
- secure evidence-link validation;
- operator and club portal integration;
- discipline role and access contracts;
- database RPC and table contracts;
- compatibility with the existing v3.5 command centre.

## Deferred from this release

The following remain planned rather than being presented as complete:

- native file storage and malware scanning rather than controlled external links;
- player registration and eligibility records;
- automated suspension matching against registered players and team sheets;
- online fine payment collection;
- configurable rulebooks and sanction tariffs;
- full cross-module dashboards, scheduled board packs and PDF/Excel report generation.

Those belong to the registrations/eligibility and dedicated Analytics and Reports phases.
