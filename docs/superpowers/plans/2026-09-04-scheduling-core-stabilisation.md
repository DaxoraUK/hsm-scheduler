# Scheduling Core Stabilisation Implementation Plan

For agentic workers: use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

Goal: Make Calendar, Control Centre, rebuild and every operational consumer derive one deterministic schedule from canonical fixtures and explicit intent.

Architecture: Add pure allocation, occupancy and Calendar transaction services below the existing canonical schedulingState model. Calendar edits remain client-only until a single canonical batch commit; rebuild alone generates replaceable allocations.

Tech Stack: React, JavaScript modules, Vitest, Supabase RPC client, Vite.

Spec: docs/superpowers/specs/2026-09-04-scheduling-core-stabilisation-design.md

## Global Constraints

- Start from 796897d5bf7ea7e301e05c7cb360ea0081838976 and preserve canonical fixture identity.
- Use canonical fixture identity for every mutation; never an array index or display number.
- Do not alter real production, Supabase credentials/environment variables, or unrelated temp files.
- Refresh reconciles provider facts only; rebuild regenerates derived allocation only.
- Keep RLS, tenant isolation, audit/history recording and unrelated approvals.
- Use TDD: every production behaviour has a focused failing test before code and a green run after.
- Commit only coherent verified checkpoints.

## Task 1: Shared occupancy and effective allocation

Files:
- Create src/lib/domain/fixtureOccupancy.js
- Create src/lib/domain/effectiveAllocation.js
- Modify src/lib/domain/schedulingState.js, src/lib/engines/validationEngine.js, src/lib/intelligence/pitch/pitchRules.js, and src/lib/engines/officialsEngine.js
- Test tests/regression/scheduling-core-occupancy.test.js

Interfaces:
- getFixtureOccupancy({ fixture, timing }) returns playingMins, halfTimeMins, turnaroundMins, occupancyMins, koMins, and endMins.
- resolveEffectiveAllocation({ fixture, derivedAllocation, intent, pendingPatch, timing }) returns one allocation-bearing fixture.

- [ ] Write failing tests for playing duration plus explicit half-time and turnaround; legal boundary handoff; one-minute overlap; linked/full-pitch conflict; and selector precedence.
- [ ] Run npm test -- tests/regression/scheduling-core-occupancy.test.js and confirm RED because the new services do not exist.
- [ ] Implement the two services. Treat existing youth/adult buffers as turnaround to preserve current behaviour and default half-time to zero.
- [ ] Replace duration fallbacks in validation, pitch clash and officials with the occupancy service.
- [ ] Run npm test -- tests/regression/scheduling-core-occupancy.test.js tests/regression/scheduling-state-contract.test.js and confirm green.
- [ ] Commit with message: feat: unify fixture allocation and occupancy.

## Task 2: Pure Calendar transaction and proposed occupancy

Files:
- Create src/lib/domain/scheduleTransaction.js
- Modify src/lib/engines/timelineDragEngine.js and src/lib/engines/recommendationEngine.js
- Test tests/regression/scheduling-calendar-transaction.test.js

Interfaces:
- createScheduleTransaction(baseFixtures)
- appendScheduleMutation(transaction, { fixtureIdentity, patch })
- undoScheduleMutation(transaction)
- redoScheduleMutation(transaction)
- discardScheduleTransaction(transaction)
- getProposedSchedule(transaction)
- validateProposedSchedule({ fixtures, pitchCfg, timing, closedPitches }) returns blocking and provisional diagnostics.

- [ ] Write failing tests for A vacating P1 before B uses it, A/B/C cyclic reallocation, deterministic undo/redo, and discard returning the original allocation collection.
- [ ] Run npm test -- tests/regression/scheduling-calendar-transaction.test.js and confirm RED because no transaction service exists.
- [ ] Implement immutable ordered projection. Temporary overlaps involving transaction-mutated fixtures are provisional; Save blocks unless final projected occupancy is valid.
- [ ] Feed proposed fixtures, not raw active fixtures, into timeline candidate construction and validation.
- [ ] Run npm test -- tests/regression/scheduling-calendar-transaction.test.js tests/regression/ground-control-planner-drag-v3851.test.js tests/regression/ground-control-matchday-planner-v384.test.js and confirm green.
- [ ] Commit with message: feat: add canonical calendar schedule transactions.

## Task 3: Calendar batch commit and common consumer selector

Files:
- Modify src/AppCore.jsx, src/pages/MatchdayPage.jsx, src/hooks/useFixtureDayScheduling.js
- Modify src/components/Operations/shared/MatchdayTimelineCard.jsx and src/components/Operations/SaturdayCarParkCard.jsx
- Test tests/regression/scheduling-calendar-control-centre.test.js

Interface:
- commitFixtureIntentBatch({ scope, date, patches }) persists final per-identity allocation patches once.

- [ ] Write a failing integration test proving Calendar moves cause zero persistence writes before Save; Save makes one write; Calendar, card and Control Centre return identical allocation.
- [ ] Run npm test -- tests/regression/scheduling-calendar-control-centre.test.js and confirm RED because the current Timeline persists each move.
- [ ] Replace timeline history persistence actions with transaction state. Keep Control Centre on its immediate canonical mutation path. Remove the legacy index-based parking mutation path.
- [ ] Render conflicts, unresolved state, timeline, parking, capacity and officials from the shared projected allocation collection.
- [ ] Run npm test -- tests/regression/scheduling-calendar-control-centre.test.js tests/regression/fixture-venue-flow.test.js tests/regression/scheduling-state-contract.test.js and confirm green.
- [ ] Commit with message: feat: commit calendar moves as canonical batches.

## Task 4: Derived-only rebuild, permissions and history boundary

Files:
- Modify src/AppCore.jsx, src/hooks/useWeekPersistence.js, src/lib/history/historyRestore.js, and src/pages/MatchdayPage.jsx
- Test tests/regression/scheduling-rebuild-authority.test.js

- [ ] Write failing tests proving owner, admin, Scheduler, Fixture Officer and Operations Officer can publish directly with zero schedule approval requests; unauthorised users remain blocked; derived allocation cannot reappear after refresh/rebuild; history load cannot set live derived schedule state.
- [ ] Run npm test -- tests/regression/scheduling-rebuild-authority.test.js and confirm RED because owner/admin currently pass through the Elite matchweek approval gate.
- [ ] Remove only the MATCHWEEK approval branch/request creation from saveWeek. Retain canPublish, unrelated approvals, RLS and audit/history save.
- [ ] Enforce canOperate for editing and canPublish for batch commit/rebuild/publish. Make history a read-only evidence view unless an explicit identity-reconciled restore is implemented.
- [ ] Run npm test -- tests/regression/scheduling-rebuild-authority.test.js tests/regression/scheduling-state-contract.test.js and confirm green.
- [ ] Commit with message: fix: separate schedule publishing from elite approval.

## Task 5: Deterministic whole-day optimiser and classification

Files:
- Modify src/lib/scheduler.js, src/lib/engines/dayOptimiserEngine.js, src/components/Operations/shared/DayOptimiserCard.jsx, and src/pages/MatchdayPage.jsx
- Test tests/regression/scheduling-day-optimiser.test.js and tests/regression/scheduler-recommendations.test.js

- [ ] Write failing tests for an avoidable greedy conflict, conflicting locks, linked pitches, capacity/parking constraints, ten deterministic rebuilds, and U17/U16/U15/Open Age classification.
- [ ] Run npm test -- tests/regression/scheduling-day-optimiser.test.js tests/regression/scheduler-recommendations.test.js and confirm RED on the avoidable placement.
- [ ] Implement bounded deterministic candidate search: locks first as fixed constraints, then valid pitch/time candidates ordered by canonical identity; maximise placed fixtures, then preference/parking score.
- [ ] Keep optimisation analysis non-persistent. Applying a recommendation creates explicit manual intent; generated rebuild output never becomes a lock.
- [ ] Run npm test -- tests/regression/scheduling-day-optimiser.test.js tests/regression/scheduler-recommendations.test.js tests/regression/scheduling-core-occupancy.test.js tests/regression/full-time-browser-feeds-v31044.test.js and confirm green.
- [ ] Commit with message: feat: optimise complete fixture days deterministically.

## Task 6: Lifecycle workflow and release verification

Files:
- Create tests/regression/scheduling-core-workflow.test.js
- Modify only the production boundary named by a failing assertion.

- [ ] Write a failing end-to-end workflow covering Calendar A/B/C moves; undo/redo; authorised Save; refresh; Control Centre move; Away-to-Home KO/pitch; rebuild; generated change replacement; exclusion/restore; Resolution Centre; ten deterministic rebuilds; and no duplicate canonical identities.
- [ ] Run npm test -- tests/regression/scheduling-core-workflow.test.js and confirm RED before final corrections.
- [ ] Make the minimal correction exposed by each assertion without weakening canonical identity or permission boundaries.
- [ ] Run npm test, npm run typecheck, npm run build, npm run dev, git diff --check, and git status --short.
- [ ] Commit, push referee-flow-staging, then deploy only daxora-ground-control-staging after all checks pass. If Vercel is unauthorised, push the verified commit and stop before deployment.

## Self-review

- Tasks 1-3 cover unified timing/allocation and Calendar batch semantics.
- Task 4 covers stale generated state, schedule approval removal, permissions and history.
- Task 5 covers whole-day optimisation and youth/adult classification.
- Task 6 covers refresh/rebuild, exclusion/restore, resolution and all consumer invariants.
- Every requested live defect has an assigned test and a named production boundary.
