# Ground Control v3.8.3 — Drag, Validate and Resolve Timeline

## Purpose

Ground Control's matchday timeline is now an operational editing surface rather than a read-only visual. The same shared MatchdayPage implementation serves Saturday, Sunday and Midweek, so all three use one scheduling, validation and recommendation path.

## Delivered

- Drag any active fixture between pitch rows and kick-off slots.
- Snap kick-off changes to 15-minute intervals.
- Show empty configured pitches as possible drop targets while editing.
- Block closed pitches and pitches that are unsuitable for the fixture format.
- Validate linked-pitch clashes, kick-off rules, officials and parking before applying a move.
- Surface live drop status and ranked suitable pitch or time alternatives.
- Require explicit confirmation for advisory parking warnings.
- Preserve the assigned referee unless the operator changes it separately.
- Recalculate parking, readiness, analytics, fixture messages and all dependent views from the updated schedule state without rebuilding the schedule.
- Provide Undo after an accepted move.
- Show an explicit Unsaved changes state and a Save changes action that uses the existing governed matchweek publication flow.
- Respect matchday schedule locks.

## Validation rules

Hard failures never apply:

- closed pitch;
- unsuitable pitch format;
- pitch or linked-pitch overlap;
- invalid kick-off window;
- referee overlap;
- any other hard rule returned by the shared operations validation engine.

Parking capacity and concurrency warnings may be accepted only through the Daxora warning dialogue. They remain visible elsewhere in the operating plan until resolved.

## Known boundary

The first release uses the browser's native HTML drag event model and is therefore aimed at desktop and laptop operation. A later touch-first refinement should add a dedicated tap-to-move sheet for tablets and phones without changing the validation engine.

## Next development

After staging acceptance, return to League Manager v3.9 Finance and Commercial Administration. A later Ground Control timeline refinement should add multi-select moves, keyboard/touch movement, version comparison and an audit history of schedule changes.
