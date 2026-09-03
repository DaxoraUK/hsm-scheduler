# Canonical Control Centre Identity Design

## Goal

Ensure an imported Full-Time fixture reversed from Away to Home has the same
Control Centre behaviour as a native Home fixture, without creating another
fixture representation.

## Proven root cause

The persisted venue reversal is a session override keyed by canonical provider
identity. Control Centre edits write a second session override under a numeric
schedule index. `applyFixtureOverrides` turns identity-bearing entries into a
map keyed by canonical identity. JavaScript enumerates numeric object keys
before normal string keys, so the canonical reversal override overwrites the
new KO, pitch, referee and operational-field patch. Native Home fixtures have
no competing reversal override and therefore work.

## Design

Every mutation takes an immutable canonical identity and a patch. One merged
override record per canonical identity holds venue reversal, KO, pitch,
referee, official status and related operational fields. Selection, timeline
records, optimiser moves, parking actions and Control Centre navigation resolve
fixtures by that identity. Array indexes remain display-only legacy fallbacks;
they must not select a record for a new mutation.

The schedule remains a single effective collection. Rehydration recalculates
schedule, timeline, officials, capacity and parking from that collection after
every mutation. A rebuild retains the same provider fixture and applies the
same merged override.

## Verification

Tests will import Away and native Home fixtures, reverse the Away fixture, then
apply KO, pitch, referee, official-status and selector-driven edits. They will
verify refresh/rebuild persistence, native/reversed parity and exactly one
canonical fixture throughout.
