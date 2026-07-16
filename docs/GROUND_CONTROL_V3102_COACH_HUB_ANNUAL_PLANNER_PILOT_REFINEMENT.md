# Ground Control v3.10.2 — Coach Hub and Annual Planner Pilot Refinement

**Release date:** 16 July 2026

## Purpose

v3.10.2 closes the most important gaps between the first Coach Hub release and a realistic club pilot. The release focuses on reliable communication, recurring-calendar exceptions, contact governance, cost control and operational insight rather than adding another disconnected module.

The same adult team-contact record remains the source for Coach Hub identity, Communications, calendar access and booking requests. No second coach directory is introduced.

## Commercial packaging

- Link: unavailable.
- Core: included with the paid Annual Planner add-on.
- Pro: included.
- Elite: included with organisation-wide oversight.
- Coach accounts: unlimited within the club's normal team capacity during the initial commercial phase.

The existing Annual Planner entitlement continues to control Coach Hub discovery and database access.

## Direct request conversations

Each Coach Hub request now has a controlled conversation thread.

Coaches and club operators can:

- ask for missing information;
- explain a conflict;
- discuss an alternative slot;
- record an operational decision;
- retain the exchange with the request audit trail.

Conversation entries are ordered chronologically and expose role-appropriate unread information. Coaches see only threads attached to their own team-scoped requests. Club access follows the existing Annual Planner operating permissions.

## Automatic affected-coach audiences

Annual Planner operators can prepare a Communications audience from:

- selected annual bookings;
- pitch or venue blackouts;
- all active booking teams in the current year.

Daxora resolves the affected team keys, reuses the linked Coach Hub people and team assignments, deduplicates recipients and shows which contacts are ready or missing a usable destination.

Communications receives the audience directly and filters the available coach-message rows. The operator can review the named recipients or copy a controlled contact list without recreating the audience manually.

This is recipient preparation, not unattended mass sending. Existing provider, pilot-mode, consent and delivery controls remain in force.

## Contact verification and replacement

Coaches can confirm that their own name, mobile number and communication preference remain current.

Club administrators can:

- identify unverified records;
- see verification coverage;
- replace a departed or incorrect adult contact;
- invalidate the previous Coach Hub connection and private calendar access;
- issue a new invitation to the replacement contact.

Replacement requires a new secure invitation. A changed sign-in email is never silently transferred to another person.

## Recurring-series exceptions

Coach requests and administrator-created bookings support:

- keep every generated date;
- exclude supplied school-holiday dates;
- use a custom exception list;
- weekly and fortnightly recurrence;
- remaining-series amendments.

Exception dates are parsed, deduplicated and validated before series creation. When an approved recurring request becomes annual bookings, the same exception and holiday policy are retained.

An operator editing an existing recurring booking can apply the change to that booking only or to all remaining active occurrences in the series.

## Team calendar refinement

Coach Hub now provides private team-specific calendar feeds rather than only a person-wide feed.

A coach can subscribe an authorised team calendar to Google, Apple or Outlook. The feed remains token protected, is scoped to that team and includes only permitted fixtures and annual-planner activity.

The feed token is stored as a hash and can be replaced by contact-replacement or access-revocation workflows.

## Booking reminders and acknowledgements

The daily automation now processes Coach Hub booking reminders.

For eligible future confirmed or provisional bookings, Daxora prepares:

- a 48-hour reminder;
- a 4-hour reminder requiring acknowledgement.

Delivery uses the existing server-side email capability. Completion and provider references are recorded through service-role-only functions. Failed deliveries remain visible for controlled retry and support investigation.

Acknowledging the related Coach Hub message also acknowledges the underlying reminder.

## Annual Planner pilot intelligence

The new Insights workspace provides:

- facility utilisation by pitch;
- booked hours and booking counts;
- Coach Hub invitation coverage;
- contact-verification coverage;
- request-resolution rate;
- message and reminder acknowledgement rate;
- planned booking costs;
- reconciled and outstanding booking costs.

These metrics are operational pilot indicators. They are not accounting statements or anonymous industry benchmarks.

## Cost reconciliation

Authorised users can mark a costed annual booking as reconciled and retain a finance reference.

The release reports:

- active planned cost;
- reconciled cost;
- outstanding cost;
- bookings still requiring reconciliation.

This creates a governed connection between facility planning and Finance without pretending that an Annual Planner booking is itself a supplier invoice or bank transaction.

## Database and security

Migration `202607150005` adds controlled fields for:

- contact verification;
- request exception dates and holiday policy;
- team-specific calendar feeds;
- annual-booking exception dates and finance status.

It introduces forced-RLS tables for:

- `coach_hub_request_messages`;
- `coach_hub_booking_reminders`.

Direct browser access to the new tables is revoked. Security-definer functions enforce club, team, role and entitlement scope.

Additional safeguards include:

- service-role-only reminder claiming and completion;
- private calendar-token retrieval;
- audited contact replacement;
- team-scoped request conversations;
- booking conflict checks and advisory transaction locks;
- no exposure of Coach Hub identity data to scheduler-only request views;
- entitlement removal continuing to revoke Coach Hub access.

## Known boundaries

This release deliberately does not claim:

- unattended WhatsApp or SMS delivery;
- external council-booking write access;
- automatic school-holiday discovery for every UK authority;
- supplier invoice creation from a booking cost;
- safeguarding or coaching-qualification document management;
- parent or player communications;
- two-way editing from external calendars.

These require separate provider, governance or data-retention work.

## Pilot acceptance

A real club pilot should prove:

1. A coach and scheduler can hold a complete request conversation.
2. Blackouts and selected bookings generate the correct affected-team audience.
3. Communications receives only matching coach-message rows.
4. Missing coach destinations are clearly identified.
5. A coach can verify their own contact details.
6. Replacing a coach invalidates the old connection and requires a new invitation.
7. School-holiday and custom exception dates are omitted from a recurring series.
8. Remaining-series amendments do not alter completed or unrelated bookings.
9. Team-specific calendar feeds contain only authorised activity.
10. 48-hour and 4-hour reminders are claimed, delivered and recorded once.
11. Required reminder acknowledgements update correctly.
12. Annual Planner utilisation and engagement figures reconcile to the underlying records.
13. Cost reconciliation is visible only to authorised roles.
14. Removing the Annual Planner entitlement removes Coach Hub access.
