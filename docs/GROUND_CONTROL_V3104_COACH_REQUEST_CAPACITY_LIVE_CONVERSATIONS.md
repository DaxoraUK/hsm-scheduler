# Ground Control v3.10.4 — Coach Request, Pitch Capacity and Live Conversations

## Purpose

This release completes the first operational Coach Hub request workflow. It fixes the route-level recovery failure reported after coach access activation and upgrades requests from a one-way form into an editable, pitch-aware conversation with controlled training capacity.

## Coach Hub stability

- The Coach Hub route now has its own recovery boundary.
- A rendering fault inside Coach Hub no longer opens the application-wide recovery screen.
- Workspace and conversation faults can be retried without leaving the coach area.
- The coach workspace silently refreshes every 30 seconds and when the browser regains focus.

## Editable coach requests

Coaches can edit requests while their status is:

- `submitted`
- `needs_information`

The edit form restores the original team, request type, title, date, times, recurrence, attendance, pitch and notes. Saving updates the existing request rather than creating a duplicate. Once a request is approved, rejected, cancelled or has an alternative awaiting a response, the original request is locked to preserve the decision trail.

Every edit:

- returns the request to `submitted`;
- clears any superseded proposed alternative;
- creates a request-thread audit message;
- updates the club scheduler’s current request record.

## Selectable pitches

Coach Hub now receives the club pitch registry in its secure workspace response. Coaches select a pitch from a dropdown rather than typing a name.

The selector shows the configured simultaneous training capacity, for example:

- Pitch 4 — up to 2 training teams
- Pitch 5 — 1 training team

A coach can still select “No pitch preference” when the club should allocate the facility.

## Simultaneous training capacity

Settings → Pitches now includes **Simultaneous training teams** for every pitch. The accepted range is 1–20 and the default is 1.

Capacity applies only when all overlapping bookings are training sessions. Friendlies, matches, tournaments, external hire and other non-training bookings remain exclusive.

Example with Pitch 4 capacity set to 2:

1. Team A training at 18:00–19:30 — allowed.
2. Team B training at 18:00–19:30 — allowed.
3. Team C training at 18:00–19:30 — blocked.
4. Friendly at 18:00–19:30 — blocked while either training booking exists.

The same rule is enforced in:

- the Annual Planner browser conflict engine;
- direct Annual Planner database saves;
- Coach Hub request validation;
- coach request approval and booking creation;
- recurring booking series through the standard save function.

## Live-style request conversations

Open request conversations now refresh silently every six seconds while the browser tab is visible. They also refresh immediately when the browser regains focus.

- Existing messages remain on screen while checking for updates.
- New replies append without a loading flash.
- The conversation scrolls to the latest message.
- A **Live** indicator changes to **Reconnecting** if a quiet refresh fails.
- Manual refresh remains available.

This uses controlled background polling. It does not weaken Row Level Security or expose conversations outside the coach’s assigned club and request.

## Database migration

`202607160009_coach_hub_request_live_capacity.sql`

The migration adds or replaces:

- `private.pitch_training_capacity`
- `private.pitch_slot_available`
- `public.get_coach_hub_workspace`
- `public.submit_coach_hub_request`
- `public.update_my_coach_hub_request`
- `public.save_annual_planner_booking`
- `private.create_booking_from_coach_request`

## Validation

- 10 focused v3.10.4 tests passed.
- 113 regression files passed.
- 580 regression tests passed.
- TypeScript/Vite production build passed.
- Lint completed with 61 existing warnings and 0 errors.
