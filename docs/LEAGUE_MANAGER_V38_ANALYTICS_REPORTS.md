# League Operations v3.8 — Analytics and Reports

## Purpose

v3.8 turns the operational registers already held by League Manager into one decision-ready reporting workspace. It does not create a second analytics data model or copy figures into manually maintained dashboards. Metrics are calculated from the current fixture, result, club-operation, match-official, discipline and registration records.

The release is designed for league administrators, competition officers, discipline officers, registration secretaries, board members and funding evidence preparation. Sensitive datasets remain role-restricted.

## New workspace

League Manager now includes **Command → Analytics & reports** with six focused views:

1. **Executive** — headline delivery, risk and service measures, plus stored trend snapshots.
2. **Competitions** — fixture delivery, missing results, postponements, average goals and current leaders by division.
3. **Club scorecards** — transparent operational benchmarking across results, acknowledgements, requests, registrations and discipline.
4. **Officials** — required appointment coverage, gaps, confirmation rates and workload distribution.
5. **Governance** — aggregate discipline, sanctions, fines, registration and eligibility measures without exposing player-level personal data.
6. **Reports & evidence** — CSV exports, printable HTML board packs, funding evidence, governed report schedules and snapshot history.

Filters for season, division and date range persist locally for the operator and are applied consistently across every view and export.

## Executive measures

The executive dashboard includes:

- Fixture completion against fixtures due, rather than misleading completion against the entire future season.
- Missing results and submissions awaiting review.
- Published and upcoming fixtures.
- Postponement totals.
- Match-official appointment coverage and gaps.
- Club fixture-publication acknowledgement rates.
- Open club change requests.
- Open discipline cases, overdue responses and outstanding fines where the operator is authorised.
- Approved, pending and correction-required registrations and invalid team sheets where the operator is authorised.

The headline state is **Ready**, **Needs review** or **Action required** based on unresolved operational and governance queues.

## Club operational scorecards

The club score is intentionally transparent and uses five weighted components:

- 35% result completion
- 20% publication acknowledgements
- 20% registration health
- 15% discipline health
- 10% unresolved change-request health

The score is an operational attention tool, not a sporting ranking, regulatory judgement or automatic sanction. Operators can see the component figures alongside the score.

## Reports and exports

The release provides:

- Executive board report in printable HTML, suitable for browser Save as PDF.
- Competition-delivery HTML and CSV reports.
- Club-scorecard HTML and CSV reports.
- Match-official HTML and CSV reports.
- Governance HTML and CSV reports.
- Funding-evidence HTML and CSV datasets.
- Date-stamped filenames based on league and season.
- Stored snapshots for trend comparison.

Exports include an evidence-control statement. Operational figures can support board reporting and funding evidence, but they do not by themselves prove grant eligibility or compliance with a governing-body requirement.

## Funding evidence

The funding evidence register exposes traceable aggregate measures such as:

- Active clubs and teams
- Active venues
- Published and completed fixtures
- Fixture completion
- Match-official coverage
- Club acknowledgement rates
- Approved registrations
- Open discipline cases

Each row includes its category, unit, source register and an interpretation note. This is a reporting foundation for the later research-led Grant Requirements Matrix; it does not claim universal UK grant coverage.

## Saved report schedules

Owners and administrators can save report definitions with:

- Name
- Report type
- Manual, weekly, monthly, quarterly or annual cadence
- HTML or CSV output
- Recipient list
- Reporting filters
- Next due date
- Active status

A saved definition creates a governed due queue and audit record. **v3.8 does not claim unattended email delivery.** The operator uses **Run now** to generate the file and capture the snapshot. Automatic delivery requires a later scheduled worker and communications-provider integration.

## Snapshot history and trends

Executive snapshots store a compact reporting payload rather than a copy of every underlying record. The UI compares the latest 12 points for:

- Fixture completion
- Match-official coverage
- Club acknowledgements
- Missing results

Snapshots are immutable reporting evidence and retain the filters, season and generated time used for the report.

## Security and governance

- Any authorised league member can see general fixture, result, club and official aggregates.
- Discipline aggregates load only for owner, administrator or discipline roles.
- Registration aggregates load only for owner, administrator or registration roles.
- Player-level records, dates of birth, documents and confidential case details are never included in the analytics payload.
- Only owners and administrators can create report definitions or snapshots.
- Report definitions are protected by league-management RLS.
- Snapshots are protected by league-view RLS.
- All saved, deleted and captured reporting actions write to the league audit trail.
- Snapshot payloads are limited to 750 KB.

## Database additions

Migration `202607140009_league_analytics_reports.sql` adds:

- `league_report_definitions`
- `league_report_snapshots`
- `get_league_report_configuration`
- `upsert_league_report_definition`
- `delete_league_report_definition`
- `capture_league_report_snapshot`

## UX review decisions

The analytics pass follows these rules:

- One reporting workspace, not separate duplicated dashboard and report modules.
- Operational language rather than abstract business-intelligence terminology.
- Headline metrics always include the denominator or queue context.
- Division ordering comes from the central League Manager sporting-order model.
- Filters remain visible and apply to screens and exports.
- Restricted data is labelled as restricted rather than silently shown as zero.
- Tables have horizontal overflow protection on narrow screens.
- Report schedules state clearly what is and is not automated.
- Evidence exports contain source and interpretation fields.

## Deliberate boundaries

The following are not falsely presented as complete:

- Unattended email scheduling
- Governing-body API submission
- Universal grant eligibility matching
- Geographical deprivation or demographic enrichment
- Predictive forecasting or AI-generated sanctions
- Fully designed branded PDF rendering on the server

These require separate data, provider, research or infrastructure work.

## Recommended next phase

The next major phase is **v3.9 League Finance and Commercial Administration**: affiliation and competition fees, invoices, payment status, fines reconciliation, referee expenses, club statements, commercial income and financial reporting. A smaller v3.8.1 staging-polish pass should first address any real-data metric or layout issues found during acceptance.
