# Scheduling State Contract Design

## Goal

Make every Saturday, Sunday and Midweek schedule a deterministic derived build from one canonical fixture collection plus explicit, persisted user intent. Generated allocations must not become manual input, and each canonical fixture must have exactly one operational result: scheduled or unresolved.

## Scope

This design preserves the canonical provider-fixture and Away-to-Home reversal work already in place. It replaces only the overlapping allocation state that currently lets historical moves re-enter a rebuild.

## State model

### Provider facts

Provider facts remain in the reconciled Full-Time source snapshot and are keyed by `canonicalFixtureIdentity` (the canonical provider URL identity). They contain the source fixture, provider date and provider kick-off. Refreshing a scope reconciles these facts but does not allocate the day.

### User intent

Every mutable decision is represented by a canonical identity and scope/date:

- venue role override;
- allocation intent with `mode: "locked"` only when a user intentionally moves pitch and/or kick-off;
- exclusion with reason and audit metadata;
- official assignment;
- lifecycle intent such as postponement;
- a first-class manual fixture with a stable `manual:<uuid>` identity.

Intent is the only mutable scheduling input that survives a refresh or rebuild. Venue reversal remains an intent and never creates a second fixture record.

### Derived schedule build

A build contains the optimiser allocation or unresolved diagnostic for every non-excluded effective Home fixture. It is keyed by canonical identity and is disposable. It may be saved as an immutable historical/published snapshot, but loading that snapshot must not promote its generated allocations to live intent.

## Precedence and invariants

```text
reconciled provider facts + manual fixture records
  -> canonical identity validation
  -> exclusion and venue intent
  -> effective Home/Away partition
  -> locked allocation intent only
  -> deterministic day optimiser
  -> one allocation result or one unresolved result per canonical identity
  -> all operational consumers
```

The effective fixture collection is validated for unique canonical identities before allocation. Effective Home and Away are exclusive. An unresolved result is not a fixture copy and cannot coexist with an allocation for the same identity.

## Operations semantics

**Refresh Fixtures** reconciles provider facts for the selected Saturday, Sunday or Midweek scope. It does not optimise.

**Optimise/Rebuild Day** reads the current canonical facts and user intent, discards the old derived build, preserves locked allocations only, and creates a deterministic replacement build. Concurrent rebuilds for the same scope are rejected without changing the current build.

Calendar movement and Control Centre allocation edits call the same intent mutation service. A deliberate calendar or Control Centre move creates locked allocation intent. Day-optimiser and parking recommendations remain derived suggestions until deliberately accepted as a locked manual move.

## Consumer contract

Schedule cards, Calendar, Control Centre, conflicts, timeline, parking, capacity and officials select allocation from the same build map. Officials and lifecycle data are fixture intent overlaid on that same effective fixture. Annual Planner synchronisation uses canonical identity as its matchday source key.

## Optimiser

The optimiser evaluates eligible pitch/time allocations for the complete day, respecting pitch areas and linking, closures, format, duration, buffers, concurrency, manual locks and scoped operating windows. It must not classify an age-banded team as adult because of pitch preference or 11v11 format. U17 remains Youth. A fixture reaches Resolution Centre only after no valid allocation remains; diagnostics include the blocking constraints.

## Exclusion and deletion

Provider fixtures are excluded by persisted canonical identity and may be restored. They remain in provider history but have no effective operational contribution. Manual fixtures are deleted by their own stable identity and their intent/build/official references are removed together.

## Testing and release criteria

Regression coverage will prove canonical uniqueness, refresh versus rebuild semantics, intentional manual move persistence, generated-move replacement, one allocation view across all consumers, unresolved exclusivity, U17 classification, exclusions and manual deletion. The full real-user workflow repeats rebuild ten times with unchanged identities and count. Final verification includes targeted tests, the regression suite, TypeScript, production build and app smoke verification before staging deployment only.
