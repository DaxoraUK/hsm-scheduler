# Ground Control v3.10.5 — Shared Calendar and Request Workflow

## Purpose

v3.10.5 turns Coach Hub and Annual Planner into one shared facilities workflow. Coaches can see operational restrictions before requesting a slot, while club operators can manage requests, alternatives, closures and affected bookings from the same calendar context.

This release intentionally completes the implementation first. The committed module roadmap will be created after the pilot validation of v3.10.5, before work begins on the next module.

## Shared calendar

Coach Hub now provides month and agenda views containing:

- confirmed Annual Planner bookings;
- submitted and unresolved Coach Hub requests;
- whole-club and venue blackout periods;
- pitch closures;
- coach-facing closure notes;
- team filters and visibility filters;
- direct request creation from a selected calendar date;
- private whole-workspace and team-only calendar feeds.

Annual Planner displays the same operating picture, including pending Coach Hub requests, blackouts and pitch closures. Internal operator notes are not returned to coaches or external calendar feeds.

## Guided requests

The previous basic request form has been replaced with a four-step guided workflow:

1. Request type and team.
2. Date, time, recurrence and school-holiday handling.
3. Preferred pitch, pitch area, acceptable alternatives and time flexibility.
4. Availability review and submission.

Availability is checked before submission against:

- club and venue blackout periods;
- pitch closures;
- confirmed Annual Planner bookings;
- unresolved Coach Hub request demand;
- pitch simultaneous-training capacity;
- exclusive friendly and match usage.

The availability response can offer alternative pitches and nearby times. Capacity is checked again inside Supabase when the request is submitted, edited or approved, preventing stale browser data from creating a conflict.

## Pitch areas and training capacity

Settings → Pitches now supports:

- a simultaneous training-team capacity for each pitch;
- named bookable areas, such as Half A and Half B;
- area-aware coach requests;
- area-aware operator alternatives.

A pitch configured for two simultaneous training teams can accept two overlapping training sessions. A third is blocked. Friendlies and matches remain exclusive regardless of training capacity.

## Closure impact workflow

Creating a shared blackout records every confirmed booking affected by the new restriction. Annual Planner displays an action queue where the operator can mark each booking as:

- relocated;
- cancelled;
- resolved by another action.

The closure remains visible while the booking impact is handled. Existing bookings are never silently deleted.

## Request decisions

The operator review dialog uses saved club pitches and configured pitch areas. Operators can:

- approve the requested slot;
- approve using a saved alternative pitch or area;
- offer another date or time;
- ask for more information;
- reject with a reason.

The existing request conversation remains attached to the request and continues its silent six-second refresh behaviour.

## Security and isolation

- Existing club isolation and Row Level Security remain active.
- Coach calendar context is limited to the coach's active assignments.
- Operator-only blackouts are represented as unavailable time without exposing the internal reason.
- Internal closure notes, creator identifiers and operator metadata are removed from coach responses.
- Request availability and approval are revalidated in PostgreSQL.
- Closure-impact actions require club operator access.

## Database migration

`202607170001_shared_calendar_request_workflow.sql`

The migration adds:

- blackout type, visibility and public/internal notes;
- pitch-area fields on bookings and requests;
- acceptable-pitch and flexible-time request fields;
- availability snapshots;
- closure-impact records and RLS;
- shared Coach Hub calendar context;
- secure availability checking;
- v2 request submit, update and review functions;
- v2 blackout save and closure-impact resolution functions;
- blackouts and pitch closures in private calendar feeds.

## Validation

- 15 focused v3.10.5 regression tests passed.
- 115 regression files passed.
- 598 regression tests passed.
- Lint completed with 61 existing warnings and 0 errors.
- TypeScript/Vite production build passed.
- PostgreSQL migration parsed successfully as 32 statements.

## Pilot acceptance checks

1. Set Pitch 4 simultaneous training capacity to `2` and add Half A and Half B.
2. Create a shared blackout and confirm it appears in Coach Hub and Annual Planner.
3. Create a Pitch 4 closure and confirm the date is visibly unavailable.
4. Submit two overlapping Pitch 4 training requests and verify both can be accommodated.
5. Attempt a third overlapping request and verify it is blocked or redirected to alternatives.
6. Edit a submitted request and confirm the availability result refreshes.
7. Offer a saved alternative pitch and area from Annual Planner.
8. Create a closure affecting an approved booking and resolve the generated impact item.
9. Confirm internal notes are not visible in Coach Hub or the ICS feed.
10. Confirm messages and request status changes refresh without a full workspace reload.
