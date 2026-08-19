# Ground Control v3.10.9

## Closure recovery, coach alternatives and notifications

Ground Control v3.10.9 completes the first operational response workflow for approved Annual Planner bookings affected by blackouts, pitch closures or weather disruption.

## Delivered workflow

### Operator action queue

Annual Planner Availability keeps affected bookings visible with one of these states:

- Action required
- Awaiting coach
- Postponed
- Relocated
- Cancelled
- Acknowledged or resolved

Opening an impact launches a dedicated resolution dialog. The operator can relocate the booking immediately, offer another slot to the coach, postpone it, cancel it, or acknowledge the impact without changing the booking.

### Coach-controlled alternatives

An offered alternative records a proposed date, time and resource but leaves the original booking unchanged. Coach Hub displays the original and proposed allocation side by side.

The coach may accept or decline and include a reply. Acceptance rechecks database capacity before the shared calendar is updated. A declined alternative returns the closure impact to the operator queue.

### Facilities supported

Alternatives can use:

- a club pitch;
- Full Pitch or a named pitch area;
- a winter training site;
- a fixed winter-site slot.

### Notifications

The database creates an in-app Coach Hub message and queues the existing reminder/email worker for enabled delivery when a booking is:

- offered an alternative;
- relocated;
- postponed;
- cancelled.

Coach acceptance and decline are retained in Coach Hub and the audit trail. Public coach messages and private operator notes remain separate.

### Weather recovery

A weather closure uses the same impact workflow. The original booking is preserved and may be postponed, cancelled, relocated or offered as an alternative. This maintains an accurate record of lost, rearranged and recovered activity.

### Analytics

The shared Annual Planner analytics payload now includes closure impacts. Annual Planner Insights and main Analytics receive consistent measures for:

- affected bookings;
- resolved bookings;
- responses awaiting coaches;
- relocated bookings;
- postponed bookings;
- cancelled bookings;
- resolution percentage.

These records support operational review and grant evidence about facility disruption and recovery.

## Security

- Operator functions require active club operator access.
- Coach alternatives are limited to teams assigned to the authenticated Coach Hub person.
- Acceptance revalidates the proposed facility and time transactionally.
- Row Level Security remains enabled and forced on the alternatives table.
- Every decision is written to the existing club audit trail.

## Migration

`202607170009_closure_alternatives_notifications_weather_recovery.sql`

## Acceptance criteria

1. Saving a closure creates or exposes every affected approved booking.
2. Offering an alternative does not move the calendar booking.
3. The assigned coach sees the alternative in Coach Hub.
4. Accepting an available alternative updates the booking and calendar.
5. Accepting a newly conflicted alternative is rejected safely.
6. Declining returns the impact to Action required.
7. Relocate, postpone and cancel send an in-app message and queue enabled email delivery.
8. Public and private notes remain separated.
9. Closure metrics reconcile between Annual Planner Insights and main Analytics.
10. A coach from another team or club cannot read or respond to the alternative.
