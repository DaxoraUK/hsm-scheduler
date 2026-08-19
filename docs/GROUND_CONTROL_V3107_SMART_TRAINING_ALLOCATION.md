# Ground Control v3.10.7 - Smart Summer and Winter Training Allocation

## Purpose

v3.10.7 turns the Annual Planner from a booking calendar into an explainable training-allocation workspace. Clubs can keep full manual control, receive ranked assistance, or generate a complete unpublished draft for summer, regular-season or winter training.

## Scheduling modes

- Manual: recommendations and conflict checks only. Manual runs cannot publish.
- Assisted: ranked suggestions that operators can review, lock, change and publish.
- Automatic Draft: creates a complete proposed allocation but never publishes automatically.

A team profile can follow the season-run mode or use a specific override. Manual-only teams remain recommendations and prevent a run from being published until they are resolved.

## Team scheduling profiles

Each team can store:

- preferred and unavailable days;
- preferred start times;
- regular pitch preferences;
- winter-site preferences;
- session duration;
- minimum named area or Full Pitch requirement;
- club priority;
- current-allocation protection;
- manual-only control;
- season-specific notes.

Summer/pre-season, regular-season and winter preferences are stored separately.

## Explainable allocation engine

The initial scoring model considers:

- historic and preferred day, time and resource;
- age-group start-time suitability;
- pitch-format suitability;
- named-area efficiency;
- fixed winter-site inventory and cost;
- team priority;
- existing bookings;
- all active Coach Hub people assigned to each team.

The engine returns a suggested resource, confidence, score, reasons, warnings and up to three alternatives for every team. It prevents overlapping allocations where any coach is shared across teams.

## Publication safety

Publishing is an explicit club-operator action. The database blocks publication when:

- the run is Manual;
- no teams are present;
- any team is unassigned;
- any team remains a manual-only recommendation;
- a proposed item has no valid day, time or resource;
- any weekly occurrence conflicts with final pitch-area or winter-slot capacity.

Publication runs transactionally. A conflict rolls back the complete operation rather than publishing a partial season. Successful publication creates recurring confirmed bookings and an audit record.

## Analytics

The shared Annual Planner analytics layer now includes:

- smart allocation runs;
- published allocation runs;
- Automatic Draft runs;
- teams allocated through smart runs;
- unresolved allocation items;
- average allocation score.

The same measures appear in Annual Planner Insights and the main club Analytics page.

## Security

- Preferences, runs and items are club scoped.
- RLS is enabled and forced.
- Club membership is required to read allocation data.
- Club management authority is required to save or publish.
- Security-definer functions use an empty search path and qualified objects.
- Final capacity checks run in the database.

## Files

- `src/lib/planning/smartTrainingAllocationEngine.js`
- `src/components/planning/SmartTrainingAllocationWorkspace.jsx`
- `src/pages/AnnualPlannerPage.jsx`
- `src/lib/supabase.js`
- `src/lib/analytics/annualPlannerAnalyticsEngine.js`
- `src/components/analytics/AnnualPlannerAnalyticsSummary.jsx`
- `supabase/migrations/202607170006_smart_training_allocation.sql`
- `tests/regression/annual-planner-smart-training-allocation-v3107.test.js`
- `docs/roadmaps/ANNUAL_PLANNER_SHARED_CALENDAR_COACH_REQUESTS_ROADMAP.md`
