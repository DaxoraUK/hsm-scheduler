# Ground Control v3.8.4 — Matchday Planner UX overhaul

## Purpose

v3.8.4 replaces the first-generation drag-and-drop timeline with a proper matchday planning workspace. The original v3.8.3 engine proved that fixture moves could be validated safely, but the visual interface still behaved like a wide developer grid. This pass keeps the shared scheduling and validation contract while rebuilding the operator experience around deliberate planning, warnings and recoverable draft changes.

## Planner experience

### Timeline canvas

- Sticky pitch labels and sticky time ruler.
- Exact 15-minute snap positions.
- Fit-day, 15-minute, 30-minute and 60-minute zoom modes.
- Auto-scroll while dragging near a planner edge.
- Collapsible pitch groups for 11v11, 9v9, 7v7, 5v5, astro and other pitches.
- Empty configured pitches remain visible while editing.
- Closed pitches are visibly hatched and labelled.
- Mobile devices open the simpler pitch-board view by default.

### Pointer and touch controls

- A dedicated drag handle separates moving a fixture from opening it.
- Pointer events replace browser HTML drag-and-drop.
- Mouse and touch movement use the same validation path.
- The selected-fixture drawer provides accessible pitch and time controls for touch, keyboard and precision editing.
- Escape cancels an active pointer move.

### Live validation

Every proposed move continues to use the shared Ground Control operations engine. Validation covers:

- pitch closure and suitability;
- format, surface and configured pitch ranking;
- pitch and linked-pitch clashes;
- timing and competition rules;
- official clashes;
- parking capacity and concurrency.

The proposed slot displays an inline status beside the drop position:

- green: move available;
- amber: warning requires review;
- red: move blocked.

Blocked moves open the selected fixture with validated alternatives. Advisory moves remain explicit and require confirmation before they are applied.

### Selected-fixture drawer

The drawer shows:

- home team and opposition;
- current kick-off and pitch;
- assigned official;
- estimated parking contribution;
- operational warnings;
- suitable pitch ranking;
- direct pitch and kick-off editing;
- validated recommendations;
- link to the full fixture record.

### Draft changes

Timeline edits are now treated as a coherent unpublished batch:

- persistent unpublished-change count;
- undo and redo;
- review drawer with before/after pitch and time values;
- warning retained on the change record;
- confirmed discard of all draft changes;
- save clears the draft history only after the existing save operation succeeds.

The same workflow is shared by Saturday, Sunday and Midweek through `MatchdayPage`.

## Operational overlays

Operators can toggle:

- pitch closures;
- parking contribution and peak percentages;
- missing officials;
- fixture warnings.

The overlays are optional so the default planner remains readable.

## Pitch-board view

The alternative pitch-board view presents each pitch as a chronological fixture card list. It is intended for:

- mobile and tablet use;
- quick matchday scanning;
- users who prefer direct selection over spatial dragging;
- future print and briefing refinements.

Both views operate on the same fixtures, selected-fixture drawer, validation engine and draft-change state.

## Files

- `src/lib/engines/matchdayPlannerEngine.js`
- `src/components/Operations/shared/MatchdayTimelineCard.jsx`
- `src/pages/MatchdayPage.jsx`
- `src/index.css`
- `tests/regression/ground-control-matchday-planner-v384.test.js`

## Deferred refinements

The following remain suitable for a later planner pass after staging use:

- multi-select and multi-fixture moves;
- saved planner view preferences per user;
- printable pitch-board briefing pack;
- planner change audit persistence beyond the existing schedule save/history contract;
- live collaborator presence and concurrent editing protection;
- richer weather and preparation-buffer overlays.
