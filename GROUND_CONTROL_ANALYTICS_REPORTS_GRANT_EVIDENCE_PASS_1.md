# Ground Control — Analytics, Reports and Grant Evidence Pass 1

## Purpose

This phase improves trust, traceability and grant-support usefulness without claiming that Ground Control determines grant eligibility.

## Audit findings

### Performance Analytics

**Keep**
- Fixture delivery trends
- Kick-off demand and heatmaps
- Pitch use and rotation
- Parking pressure
- Officials coverage
- Team and format analysis
- Weather snapshot coverage

**Upgrade**
- The previous evidence-depth score was an opaque heuristic.
- The selected reporting period was not summarised clearly beside the evidence score.
- Users could not see a single fixture-level appendix explaining the numbers.
- Missing weather, parking, official and allocation data did not have a shared confidence model.

**Result**
- A common evidence-confidence model now scores history depth, fixture identity, formats, allocations, officials, parking and weather.
- The weakest evidence area is shown with a corrective action.
- A Source Records panel exposes every fixture behind the selected analytics.

### Funding Evidence

**Problems found**
- “Grant-ready” language could be mistaken for eligibility advice.
- Recorded facts, calculations and team-name inferences were presented too closely together.
- Youth and women/girls figures are inferred from team names, not verified beneficiary records.
- Fixture counts create team opportunities, not individual participant counts.
- Governance, finance, project plans, quotations and consultation are outside operational fixture data.
- The current matchweek and historical evidence were not clearly separated.

**Result**
- “Grant evidence readiness” is replaced by “Operational evidence confidence”.
- Filters now control the evidence period and matchday scope.
- Recorded, configured, calculated, inferred and manual evidence are distinguished.
- A 12-line grant evidence framework shows availability, source, current evidence and next action.
- Current live operations remain separate from the selected historical period.
- All eligibility claims have been removed.

### Reports

**Problems found**
- Reports showed operational readiness but not data confidence.
- There was no formal grant/funding evidence document.
- Formal methodology, limitations and evidence provenance were missing.
- Funding-related CSV output did not exist.

**Result**
- All reports display evidence confidence and reporting-period context.
- A new Funding Evidence Pack includes:
  - evidence confidence;
  - methodology and limitations;
  - evidence provenance;
  - grant evidence framework;
  - priority evidence gaps;
  - fixture-level source appendix.
- Funding evidence can be exported as a structured CSV matrix.

## New shared engines

### `evidenceQualityEngine.js`

Provides one definition of evidence confidence across Analytics, Funding Evidence and Reports.

It does not score club performance or grant eligibility. It measures completeness of the selected records.

### `grantEvidenceFramework.js`

Maps Ground Control data into broad funding-evidence categories:

- organisation;
- need and demand;
- facilities;
- participation;
- access and safety;
- workforce;
- monitoring;
- governance;
- finance;
- project evidence.

This is a generic evidence framework. It is not yet the researched, funder-specific Grant Requirements Matrix.

## Validation

- 32 test files passed
- 180 tests passed
- TypeScript build passed
- Production build passed
- Lint passed with 0 errors
- Existing lint warnings reduced to 76
- Initial bundle remains approximately 472 KB minified / 145 KB gzip

## Manual checks

1. Open Analytics → Performance Analytics.
2. Change reporting period, matchday scope, team, pitch and format.
3. Confirm Evidence Confidence changes with the selection.
4. Open Source Records and reconcile a chart against fixtures.
5. Open Analytics → Funding Evidence.
6. Change evidence period and scope.
7. Confirm inferred participation is labelled as inferred.
8. Confirm governance, finance and project evidence are marked manual.
9. Open Reports and select Funding Evidence Pack.
10. Print/save PDF and export the funding CSV.
11. Confirm the source appendix matches the selected report data.

## Next phase

1. Research the first funder-specific Grant Requirements Matrix for England grassroots football.
2. Add explicit beneficiary, team-category, postponement-reason and project-baseline fields only where justified.
3. Add immutable evidence snapshots for submitted applications.
4. Add custom date ranges and before/after investment comparisons.
5. Add report archive/versioning so an exported pack can be reproduced later.
6. Then proceed to production-like staging and launch-gate evidence.
