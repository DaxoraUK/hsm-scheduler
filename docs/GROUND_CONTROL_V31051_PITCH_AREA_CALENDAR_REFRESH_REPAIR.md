# Ground Control v3.10.5.1 — Pitch Area and Calendar Refresh Repair

## Purpose

This follow-up repair closes four faults found during the v3.10.5 pilot check:

1. Legacy or object-backed training-area data could render as `[object Object]` or `object:object`.
2. Pitch-area inputs normalised their value on every keystroke, preventing spaces in names such as `Half A`.
3. Annual Planner requests did not refresh unless the workspace was manually reloaded.
4. Pitch-area selection was visible in the UI but was not persisted through every booking save and Coach Hub approval path, so simultaneous Half A and Half B bookings could not be represented reliably on the calendar.

## Changes

### Pitch settings

- Accepts legacy arrays, object maps, JSON-encoded values and simple delimited text.
- Extracts labels from `label`, `name`, `title`, `text` or `value` properties.
- Rejects object string artefacts rather than displaying them.
- Preserves whitespace while the operator types.
- Trims and normalises area names only when settings are saved.

### Area-aware booking capacity

- Annual Planner booking records now retain `pitch_area_id` and `pitch_area_name` through normalisation and database payloads.
- Two overlapping training bookings are allowed on Pitch 4 when one uses Half A and the other uses Half B and the pitch capacity is two.
- A second overlapping booking on the same named area is rejected.
- A third overlapping booking is rejected when the pitch's simultaneous training capacity is two.
- Coach Hub request availability counts pending requests against both whole-pitch capacity and the selected area.
- Approval, alternative approval, recurring booking creation and operator-created bookings all use the same area-aware database guard.

### Calendar visibility

- Annual Planner month cells, selected-day cards, booking register, request queue and booking drawer show the named pitch area.
- Coach Hub calendar month and agenda items show the named pitch area.
- Separate simultaneous bookings are retained as separate calendar events.

### Annual Planner refresh

- The Requests tab refreshes quietly every six seconds while visible.
- It refreshes immediately when the browser regains focus or the tab becomes visible.
- Quiet refreshes do not replace the workspace with a loading screen or clear the existing request list.
- A visible Refresh button remains available in the Annual Planner header.
- The page shows a subtle last-updated or background-refresh indicator.

## Database migration

`202607170002_pitch_area_calendar_refresh_repair.sql`

The migration replaces the relevant booking and Coach Hub functions and introduces `private.pitch_area_slot_available(...)`. No existing booking or request records are deleted.

## Acceptance criteria

- Adding `Half A` or `Goalkeeper Area` preserves the spaces while typing and after saving.
- No pitch-area input displays `[object Object]` or `object:object`.
- Pitch 4 configured with capacity two can hold simultaneous Half A and Half B bookings.
- The calendar displays both bookings and their area labels.
- A duplicate Half A booking is rejected.
- A third simultaneous booking is rejected when capacity is two.
- New Coach Hub requests appear in the Annual Planner Requests tab without a full page reload.
- The manual Refresh button updates the complete Annual Planner workspace.
