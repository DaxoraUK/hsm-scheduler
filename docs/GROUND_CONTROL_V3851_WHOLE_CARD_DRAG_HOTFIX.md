# Ground Control v3.8.5.1 — Whole-card drag interaction hotfix

## Reason for the hotfix

The v3.8.4 Matchday Planner deliberately separated fixture selection from movement by limiting drag start to the six-dot handle. In normal use that made the planner appear non-draggable, particularly when operators naturally tried to move the fixture card itself.

## Changes

- The complete fixture card is now the drag target.
- A movement threshold of six pixels separates a click from a drag.
- A normal click or keyboard Enter/Space still opens the fixture planner drawer.
- The six-dot grip remains as a visual affordance but is no longer the only grab area.
- Pointer capture supports mouse, pen and touch movement consistently.
- The browser's default touch action is suppressed only on fixture cards while interacting.
- The cursor changes from grab to grabbing during an active move.
- The post-drag click event is suppressed so dropping a fixture does not also open it.
- Read-only schedules now display an explicit locked message explaining that the schedule must be unlocked before fixtures can move.

## Preserved behaviour

The hotfix does not change:

- v3.8.5 compact single-lane packing;
- genuine-overlap lane allocation;
- live weather synchronisation;
- pitch suitability and closure checks;
- parking, referee and clash warnings;
- undo, redo, review and save workflows;
- League Operations v3.9 Finance.

## Database

No Supabase migration is required.
