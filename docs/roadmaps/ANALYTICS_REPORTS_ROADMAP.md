# Daxora Ground Control Analytics and Reports roadmap

## 1. Purpose

Analytics and Reports turn Ground Control operational records into reliable club decisions, board reporting, facility-capacity evidence and grant-support material.

The module must represent the whole club operation. Weekend fixtures are one source, not the definition of pitch usage. Training, friendlies, camps, events, winter provision, external hires, closures, maintenance and unused configured capacity belong in the same evidence model.

## 2. Module boundaries

Included:

- whole-club facility utilisation;
- matchday performance and operational detail;
- Annual Planner demand, allocation and recovery evidence;
- closure, weather and maintenance impact;
- split-pitch and simultaneous-use accounting;
- team, age-group, site, pitch and usage filtering;
- cost and cost-per-delivered-team-hour measures where the user may view costs;
- CSV, print and save-as-PDF reports;
- grant and facility-investment narratives grounded in source records;
- executive summaries and evidence quality.

Not included in this module:

- editing fixtures or bookings;
- publishing Annual Planner allocations;
- accounting-led financial statements;
- guaranteed grant recommendations or automatic application submission;
- personally identifiable participation reporting without an approved data model and lawful basis.

## 3. Baseline through v3.10.13

### Unified facility intelligence

The default Main Analytics view now combines:

- saved weekend and midweek fixture evidence;
- Annual Planner training bookings;
- friendlies;
- camps and events;
- external hires;
- winter and external-site bookings;
- pitch closures, maintenance and weather downtime;
- configured but unused capacity.

The legacy matchday dashboard remains available as a dedicated detail view. Funding evidence remains a separate advanced workspace.

### Correct pitch-capacity accounting

The evidence model distinguishes:

- team-hours served;
- full-pitch-equivalent facility hours;
- configured available hours;
- closure and downtime hours;
- usable hours after closures;
- unused usable hours.

Two simultaneous half-pitch sessions count as two team-hours but one full-pitch-equivalent hour. This prevents split-pitch activity from overstating physical utilisation.

### Capacity baseline

Available capacity uses:

- the club's saved matchday operating window;
- the Annual Planner club scheduling policy;
- pitch simultaneous-use capacity;
- relevant site and pitch closures.

The calculation does not assume every hour of every day is available.

### Filters

The unified dashboard supports:

- date range;
- season phase;
- site;
- pitch;
- pitch area;
- team;
- age group;
- usage type;
- status.

### Measures

The baseline includes:

- utilisation percentage;
- pitch-equivalent hours;
- team-hours;
- delivered, scheduled, postponed and cancelled hours;
- fixture, training, friendly, event, hire, winter and other usage;
- weather and maintenance downtime;
- teams and participants recorded;
- waiting-list demand;
- period-on-period team-hour change;
- booking cost and cost per delivered team-hour where authorised.

### Reports

Reports now includes a dedicated Unified Facility Usage report with:

- date-range selection;
- whole-club headline measures;
- usage mix;
- pitch and site table;
- closure, unused-capacity and utilisation evidence;
- grant and investment narrative;
- CSV export;
- browser print and save-as-PDF output.

Existing matchday operations, fixture, pitch, parking, officials, exceptions, analytics and funding reports remain available.

## 4. Evidence authority and reconciliation

Source authority:

- saved matchday history is authoritative for published fixture operations;
- Annual Planner is authoritative for training, friendly, event, winter and other bookings;
- duplicated fixture-linked planner bookings are removed when the same source fixture exists in matchday history;
- scheduling policies define planned training availability;
- blackouts and closures reduce usable capacity;
- cost fields are included only when the current user is authorised to view them.

Headline values must reconcile across:

- Main Analytics;
- Annual Planner Insights;
- Unified Facility Usage report;
- CSV evidence exports;
- funding and grant evidence workspaces.

## 5. Permissions, privacy and security

- Every database query is club-scoped and protected by membership checks and RLS.
- Advanced funding evidence remains package-gated.
- Cost measures follow Annual Planner cost-visibility permissions.
- Private notes, supplier references and personal contact details are excluded from general analytics exports.
- Exports must be explicit user actions and remain auditable where Elite governance applies.
- Analytics must never infer protected personal characteristics from team names or contact records.

## 6. UX principles

- Start with the whole-club question, then allow drill-down.
- Separate physical pitch-equivalent use from teams served.
- Explain calculations in plain language.
- Show empty and incomplete evidence honestly.
- Preserve filters during ordinary refreshes.
- Avoid dashboards made only of decorative cards; every headline must connect to rows or a report.
- Keep matchday detail available without allowing it to dominate total facility usage.

## 7. Grant and investment evidence

The module should help a club evidence:

- sustained peak-time demand;
- teams unable to obtain suitable slots;
- hours lost to weather or poor surfaces;
- winter-site dependency and cost;
- split-pitch efficiency;
- facility downtime;
- unused off-peak capacity;
- growth in activity compared with an equivalent earlier period;
- cost per delivered team-hour;
- the operational case for drainage, floodlights, 3G, changing facilities or added capacity.

All generated wording is a draft based on recorded evidence. It must not promise funding success.

## 8. Next phases

### Analytics quality and reconciliation

- automated reconciliation tests between Main Analytics, Annual Planner Insights and exports;
- data-quality warnings for missing pitch, team, duration, status or operating-window information;
- record-level drill-down from every headline measure;
- explicit treatment of provisional versus delivered sessions;
- configurable facility availability calendars where club policy is more complex than a weekly window.

### Growth, participation and outcomes

- season-over-season team and activity growth;
- participation totals from an approved, privacy-safe source;
- retention and access measures where reliable source data exists;
- community-programme and facility-outcome evidence;
- controlled demographic reporting only after governance and lawful-basis review.

### Financial and scenario intelligence

- winter-site and external-provider cost trends;
- cost by team, site and usage type;
- cost per planned and delivered team-hour;
- scenario comparisons for additional floodlights, drainage or 3G capacity;
- budget-versus-capacity planning;
- avoidable cost caused by closures and rearrangements.

### Report builder and scheduled delivery

- saved report definitions;
- selected measures, filters and narrative sections;
- board, trustee, facility and grant templates;
- governed scheduled report delivery;
- branded exports;
- exact evidence snapshot and approval controls for Elite.

### Elite executive intelligence

- multi-club and organisation roll-ups;
- cross-site benchmarking;
- risk and exception summaries;
- governed executive packs;
- data freshness, confidence and source lineage;
- no league or organisation user may see club data outside their authorised scope.

## 9. Testing and acceptance

Each analytics release requires:

- fixture and Annual Planner source reconciliation tests;
- split-pitch capacity tests;
- closure and weather tests;
- filters for site, pitch, area, team, age group, usage and status;
- cost visibility tests;
- club isolation and entitlement tests;
- CSV and print report checks;
- focused regression tests;
- full regression catalogue;
- lint with zero new errors;
- production build;
- controlled HSM comparison against manually checked source records.

## 10. Packaging

- Core includes whole-club operational and facility analytics plus standard reports.
- Pro includes advanced funding evidence, deeper comparisons and advanced report packs.
- Elite adds organisation roll-ups, governed approvals, executive reporting and controlled delivery.
- Annual Planner-specific analytics require the Annual Planner module data source, but Main Analytics remains the club-level destination for the combined picture.

## 11. Release history

| Release | Status | Scope |
|---|---|---|
| Analytics v1 / Reports v1 | Complete | Canonical saved-matchday evidence, operational dashboards and standard matchday reports. |
| v3.10.6-v3.10.12 | Complete | Annual Planner demand, weather, winter, closure, fairness, resource and grant evidence measures. |
| v3.10.13 | Complete | Unified fixture-and-booking facility intelligence, split-pitch accounting, cost/trend evidence, unified report and Analytics roadmap baseline. |
