# Ground Control v3.10.10 - Seasonal rollover, waitlists and resource capacity

## Purpose

This release deepens the Annual Planner beyond pitch-only capacity. It adds reviewable season rollover, unresolved-demand waiting lists, shared operational resources, participant limits and setup/clear-down buffers. It also corrects the Smart Allocation setup header so the controls remain readable at normal laptop widths.

## Delivered workflows

### Seasonal rollover

- Preview a source and target season before creating anything.
- Copy approved team preferences into the target season when selected.
- Use the latest published source allocation as the basis of a new target draft.
- Preserve existing bookings and source allocations.
- Keep regular/pre-season and winter inventories separate.
- When inventory type changes, retain useful day/time context but leave the new resource unresolved for operator review.

### Training waiting list

- Record team, season, duration, expected participants and priority.
- Record preferred days and half-hour start times.
- Record required shared resources and operational notes.
- Track waiting, offered, allocated, withdrawn and expired states.
- Feed active waiting demand into Smart Allocation profile weighting without bypassing master rules.

### Shared resources

- Create club-scoped resources such as portable goals, floodlight keys, changing rooms and equipment sets.
- Set total quantity, setup buffer and clear-down buffer.
- Reserve one or more resource quantities on a booking.
- Block overlapping reservations that exceed quantity.
- Deactivate a resource without deleting historic booking records.

### Deeper capacity

- Store expected participants on bookings.
- Configure maximum participants for Full Pitch and named areas.
- Apply setup and clear-down buffers around facility use.
- Recheck buffered pitch, area and shared-resource capacity in Supabase before saving.
- Preserve normal team-clash checks against actual session time rather than operational buffer time.

### Analytics

The shared analytics model now includes:

- active shared resources;
- waiting, offered and allocated waitlist teams;
- seasonal rollover runs;
- bookings using setup/clear-down buffers;
- shared-resource reservation volume;
- grant narratives describing unresolved demand and recovered waitlist demand.

The same model feeds Annual Planner Insights and the main Analytics page.

### Smart Allocation layout

The setup controls are grouped into responsive panels:

- planning setup: season and scheduling mode;
- draft date range: from and to;
- draft action: separate primary Build draft action.

The saved-mode status remains visible without compressing the fields.

## Security and data integrity

- All new records are club scoped and protected by RLS.
- Resource, waitlist and rollover changes require active club-operator access.
- Final booking saves use transactional database checks.
- Season rollover creates a draft; it never publishes or moves teams automatically.
- Existing bookings, source allocations and audit history are preserved.

## Migration

`202607170010_season_rollover_waitlist_resources_buffers.sql`

## Acceptance scenarios

1. Create two portable-goal sets and confirm a third overlapping reservation is blocked.
2. Add a 15-minute setup and clear-down buffer and confirm adjacent bookings respect it.
3. Configure a Half A participant limit and confirm an oversized booking is rejected.
4. Add an unallocated team to the waiting list and confirm it appears in analytics and influences the next draft.
5. Roll regular-season allocations into winter and confirm the new draft does not reuse summer pitch IDs.
6. Confirm the Smart Allocation header remains readable at laptop and mobile widths.
