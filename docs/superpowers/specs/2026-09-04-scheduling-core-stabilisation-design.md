# Scheduling Core Stabilisation Design

## Decision

One canonical fixture identity owns provider facts and explicit user intent. A
derived allocation is never saved as fixture intent merely because it was once
rendered. Every operational surface reads a single effective allocation for a
canonical fixture.

## State model

1. **Provider facts** are immutable inputs for a rebuild: canonical identity,
   provider date, teams, source KO, competition and format.
2. **Explicit intent** is persisted by canonical identity: venue override,
   exclusion, manual allocation lock, official assignment and lifecycle state.
3. **Pending Calendar transaction** is client-only ordered state. It overlays
   persisted effective fixtures and is never written before Save Schedule.
4. **Derived result** is scheduler output. It is replaceable on every rebuild
   and is not an allocation lock.

Precedence is provider facts -> venue/lifecycle/exclusion intent -> explicit
manual allocation intent -> derived optimiser allocation -> pending Calendar
transaction. The final layer exists only while the Calendar editor is dirty.

## Calendar transaction

The transaction contains `baseRevision`, `mutations`, and `redoMutations`.
Each mutation has a canonical fixture identity and a complete allocation patch.
Its projected schedule is rebuilt deterministically by applying mutations in
order over the persisted effective allocation collection.

Immediate validation blocks invalid pitch suitability, closure, operating-window
and identity conditions. Temporary occupancy overlaps that involve two fixtures
changed by the transaction are retained as provisional conflicts, so a cyclic
swap can be staged. The final projected schedule must be conflict-free before
Save. Undo/redo only alter transaction state. Discard clears it. Save calculates
the final per-identity patches and persists that batch once as manual locked
allocation intent.

## Effective allocation and occupancy

`resolveEffectiveAllocation` is the only allocation selector exposed to UI and
operations consumers. It selects the canonical fixture's derived allocation,
applies explicit lock intent, then applies the pending transaction when present.

`getFixtureOccupancy` returns `playingMins`, `halfTimeMins`,
`turnaroundMins`, `occupancyMins`, and `endMins`.

For compatibility, existing youth/adult buffer configuration is interpreted as
turnaround. Explicit half-time defaults to zero until configured. The scheduler,
validator, pitch-link checks, Calendar, Control Centre, timeline, parking,
capacity and officials use this service. End-at-start is legal; one minute of
overlap is not.

## Rebuild and optimiser

Refresh Fixtures only reconciles provider facts. Optimise/Rebuild starts from
canonical provider/manual fixtures plus explicit intent, discards previous
derived allocation, then calculates a deterministic whole-day allocation.
Manual locks are fixed constraints. A lock conflict is unresolved and is never
silently changed. The search enumerates valid pitch/time candidates, honours
pitch links, closures, classification, format, operating windows, occupancy,
capacity and parking constraints, and chooses a deterministic highest-placement
result. Resolution Centre represents unresolved state for an existing canonical
fixture; resolving it writes explicit intent to that fixture only.

## Security and history

Operations edits require `canOperate`; transaction commit, rebuild and publish
require `canPublish`. Matchweek-specific Elite approval checks and request
creation are removed from publishing, while all other approval systems,
organisation isolation, RLS and audit/history recording remain unchanged.

History snapshots remain immutable published evidence. Loading one must not
replace current live derived scheduling state. A restore action, if retained,
must convert explicitly selected allocation data to current canonical intent
only after current identity reconciliation.

## Non-goals

- No provider fixture cloning or new fixture identities.
- No production deployment, Supabase credential change, environment change or
  unrelated temp-file change.
- No removal of non-scheduling approval workflows.
