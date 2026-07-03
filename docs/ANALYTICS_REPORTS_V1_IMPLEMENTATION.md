# Ground Control Analytics v1 and Reports v1 — Implementation

## Scope completed

This phase replaces the Reports placeholder and consolidates analytics and reporting around one club-scoped operational evidence model.

### Analytics v1

- Saved-matchday filters by period, specific matchday, day, team, pitch and format.
- Fixture delivery, postponement, cancellation and unresolved counts.
- Pitch load, facility hours, use share and postponement rate.
- Team activity and delivery rate.
- Format demand.
- Kick-off distribution and day/time heatmaps.
- Officials coverage and outstanding appointments.
- Parking demand using the capacity and assumptions saved with each matchday.
- Historical weather-risk coverage for matchdays saved after this release.
- No current club settings are substituted for historical parking assumptions.
- No current forecast is substituted for historical weather.

### Reports v1

The Reports route now includes:

- Matchday Operations Pack.
- Fixture allocation report.
- Pitch usage report.
- Parking report.
- Officials report.
- Exceptions report.
- Analytics snapshot.
- Current matchweek or saved-matchday sources.
- Matchweek, weekend, midweek, Saturday and Sunday scopes.
- CSV export.
- Browser print and Save as PDF output.
- Live weather for current reports and captured weather evidence for saved reports.

### Shared evidence model

`operationalEvidenceEngine.js` is now the canonical calculation path for both Analytics and Reports. It normalises legacy and v2 history, deduplicates fixture outcomes, and keeps scheduled/postponed/cancelled/unresolved precedence consistent.

### Matchweek evidence capture

Publishing a matchweek now stores:

- Site-aware parking capacity.
- Parking enabled/configured state.
- Saved concurrent-game and vehicle assumptions.
- Best-effort fixture weather exposure when a forecast is available.

Weather capture has a short timeout and can never block an operational save. If weather is unavailable, the matchweek still publishes without invented evidence.

### Performance

Analytics and Reports are lazy-loaded as route chunks. The production build now emits separate Analytics, Reports and evidence-engine chunks rather than adding them all to the initial application bundle.

The main application chunk remains above Vite's 500 kB warning threshold, so wider route splitting remains a later performance task.

## Validation

- 13 regression test files passed.
- 89 regression tests passed.
- Coverage thresholds passed.
- Oxlint reported 0 errors and 87 existing warnings.
- Production build passed.
- Reports placeholder wording was removed.
- No database migration is required.
