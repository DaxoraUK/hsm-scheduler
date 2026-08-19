# Ground Control v3.8.5 — Planner density and live-weather synchronisation

## Purpose

This corrective release removes two sources of false operational friction found during staging review of the v3.8.4 Matchday Planner.

## Planner lane packing

The planner previously allowed a fixture card's minimum visual width to influence lane allocation. Short fixtures could therefore appear on separate vertical lanes even when their real kick-off and finish times did not overlap.

v3.8.5 separates scheduling truth from visual presentation:

- Lane allocation uses real kick-off and calculated end times.
- Back-to-back or later fixtures stay on one horizontal lane when they do not overlap.
- A second vertical lane is created only for a genuine time overlap.
- Minimum card width is applied after lane allocation and is capped before the next real fixture.
- Single-lane pitch rows and pitch-group headers are more compact.
- Existing warning, closure, official and parking overlays remain available.

This behaviour is shared by Saturday, Sunday and Midweek because all three routes use the same timeline engine and planner component.

## Live-weather synchronisation

Operations Centre previously constructed an independent weather snapshot without the live provider result used by Dashboard and Matchday. A configured venue could therefore be shown as requiring a live forecast while live provider data was already available elsewhere.

v3.8.5 now:

- Uses the shared `useLiveWeather` result in Operations Centre.
- Passes the live forecast through the shared weather-intelligence engine.
- Uses the relevant Saturday, Sunday or Midweek date for the selected operational scope.
- Carries provider, connection status, error state and refresh information into operational readiness.
- Preserves the previous local snapshot only as a defensive fallback when no shared result is supplied.

## Acceptance criteria

- Two fixtures on one pitch with non-overlapping real time ranges render on one lane.
- A genuine overlap creates a second lane.
- Fixture cards remain legible without changing scheduling truth.
- Operations Centre shows live-provider readiness when provider data exists.
- Provider failure, stale data and unavailable data are represented honestly.
- Saturday, Sunday and Midweek remain consistent.
