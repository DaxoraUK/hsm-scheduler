# Scheduling Core Final Stabilisation Design

## Goal

Make Ground Control resolve every provider or manual fixture through one canonical identity and one effective operational schedule. An authorised operator must be able to save and publish scheduling work directly, without Elite or matchweek approval, while club isolation, capability checks and audit records remain enforced.

## Non-negotiable invariants

1. One provider fixture identity maps to one canonical fixture. A manual fixture has one `manual:` canonical identity.
2. Venue reversal, allocation, official appointment, exclusion, lifecycle and publication are state attached to that identity. None creates a second fixture.
3. Scheduling input cannot contain duplicate canonical identities. Unsafe input produces a diagnostic and no allocation.
4. A fixture is either scheduled or unresolved in one effective schedule result, never both.
5. Provider facts are immutable inputs for a scheduling run. Explicit user intent is persisted. Generated allocations and all operational analytics are derived and replaceable.

## State ownership

### Provider facts

Full-Time snapshots remain provider facts and are reconciled by canonical provider identity. A refresh changes only the provider input for its authoritative scope; it does not write an allocation intent or rebuild unless the operator chooses Optimise/Rebuild.

### Persisted scheduling state

Add a club-, day- and date-scoped scheduling-state record. It stores:

- explicit fixture intent, keyed by canonical fixture identity;
- manual fixture definitions, keyed by `manual:` canonical identity;
- a monotonically increasing revision;
- publication metadata and audit references, not a cloned fixture schedule.

Intent fields are limited to venue override, locked allocation, lifecycle/exclusion, and normalised official appointment. The record does not store optimiser output.

The database exposes capability-checked RPCs to load, atomically save an expected-revision state transition, and publish a saved revision. These RPCs use existing club membership and scheduling/publishing capabilities; they do not rely on a literal role name. Every successful state transition writes an audit event. RLS and club ownership checks remain in force.

### Derived effective schedule

`buildEffectiveMatchdaySchedule` is the sole domain boundary:

```
provider facts + manual fixtures + explicit intent
  -> canonical effective fixtures
  -> deterministic optimiser result
  -> scheduled-by-identity and unresolved-by-identity
  -> allocation / conflicts / timeline / parking / capacity / officials / print
```

The React application may cache the derived result for rendering, but does not persist it or merge it back into intent. The existing parallel `sat/sun/midweekScheduled`, `...Unresolved`, presentation-override projection and history snapshot paths cease to be competing sources of truth.

## Precedence

For a canonical fixture, precedence is:

1. provider facts;
2. explicit venue, lifecycle/exclusion and official intent;
3. explicit locked allocation intent;
4. generated allocation for an unlocked fixture;
5. ordered, unsaved Calendar mutation, visible only in that Calendar transaction.

A higher layer only overlays its own fields. A manual KO recalculates end time through the occupancy service. An excluded fixture has no derived allocation or downstream operational contribution. A locked conflict remains unresolved with an explanatory reason; it is never silently moved.

## Save and publication

Save and publish are separate operations.

`Save Schedule` commits a complete intent batch atomically against the expected revision, reloads the canonical state and rebuilds the effective schedule. It does not publish or create an approval request.

`Publish Matchweek` is available to callers with the existing publish capability. It records publication/audit state for the saved revision and can invoke the existing communications workflow, but neither an Elite request nor a matchday lock is required. Existing stale approval records are ignored for scheduling. Non-scheduling Elite approvals (communications, funding and governance) remain untouched.

The obsolete scheduling-only checks are removed from the browser workflow, the matchweek-history RPC and the matchday-lock/communication gate. Compatibility functions may remain only as no-op, non-gating reads where required by unrelated code.

## Calendar transaction

The Calendar owns a local immutable transaction:

```
saved effective schedule + ordered mutations = proposed effective schedule
```

Each mutation targets canonical identity. Validation is performed against the projected final schedule, not the saved schedule or each temporary step. Undo, redo and discard replay or remove the exact ordered mutation list. A valid A→P3, B→P1, C→P2 reallocation may be staged even if an intermediate move would collide; saving requires the final projected schedule to satisfy all pitch, timing, closure, suitability, linked-pitch, capacity and official rules. Saving writes one intent batch once.

## Allocation and timing service

One service resolves allocation and occupancy for all consumers. Pitch occupancy is explicitly:

```
playing duration + half-time allowance + configured turnaround/changeover
```

The input game length means playing duration. Half-time and turnaround are separately configurable by age/category or format. There are no hidden format buffers. Age classification is sourced from team/competition category: U17, U16 and U15 are Youth; 11v11 and preferred pitch do not imply Adult. Pitch eligibility is independent of age classification.

The scheduling domain uses five-minute candidate increments. Imported times are retained exactly when valid. Timeline labels may use 15/30/60-minute visual markers, but snapping, validation, occupancy, optimiser candidates, Resolution Centre and control inputs use five-minute values.

## Optimiser and conflict lifecycle

The optimiser places valid locked allocations first, then performs deterministic constrained search for flexible fixtures. It orders fixtures by constraint level, enumerates eligible pitch/time combinations at five-minute granularity, checks linked/full-pitch relationships, closures, format/pitch suitability, operating windows, occupancy, capacity/parking and official constraints, and uses stable identity ordering for ties.

Only the final selected effective schedule is passed to conflict detection. Intermediate search conflicts cannot enter banners or Resolution Centre. A fixture reaches Resolution Centre only after no valid candidate exists, or because explicit locks conflict.

## Resolution Centre and Control Centre

All mutations use the same canonical scheduling-state command. Resolution Centre validates against the current proposed effective schedule, persists the lock, reloads/rebuilds, and verifies that the same canonical identity is scheduled exactly once and absent from unresolved before showing success. Failure leaves the prior state intact and reports the returned error.

Control Centre uses the same command path for native and reversed Home fixtures. Reversal only changes effective venue intent. KO, pitch, official and fixture selectors all use canonical identity.

## Reporting and officials

Print/export receives the same effective schedule result, filters excluded/deleted fixtures, and keys rows by canonical identity. It does not depend on visible cards, display numbers or history subsets. Tables repeat headers naturally over print pages.

Officials are normalised into independent fields:

- appointment source: League-appointed, Club-appointed, Internal, Unknown/TBC;
- appointment status: Unassigned, Pending, Confirmed, Declined, Replaced.

Legacy `refStatus` values are mapped at the boundary without losing imported facts.

## Verification

Regression coverage will prove direct capability-based save/publish, stale approval immunity, atomic Calendar batches, five-minute times, shared occupancy boundaries, U17 classification, final-only conflicts, Resolution Centre truthfulness, exclusion/deletion, reporting completeness, official normalisation, canonical uniqueness, repeated deterministic rebuilds, refresh behaviour and all-surface allocation agreement. The release gate is the full suite, TypeScript, production build, local smoke test and staging-only deployment verification.
