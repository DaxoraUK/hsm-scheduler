# Ground Control v3.10 — Annual Pitch Booking, Training and Friendlies Planner

**Release date:** 15 July 2026
**Module:** Annual Planner
**Commercial packaging:** Core paid add-on; included in Pro and Elite

## Product purpose

Ground Control already protects the weekend matchday. v3.10 extends that protection across the full calendar year so clubs can replace disconnected spreadsheets, venue calendars and message threads with one governed facility plan.

The Annual Planner covers recurring training, pre-season blocks, winter training, friendlies, camps, tournaments, maintenance, meetings and external hires. Current Ground Control fixtures are shown as protected resources, so a pitch cannot be allocated to training or a friendly when the Matchday Planner already needs it.

## Delivered capability

### Full-year facility command

- Calendar-year navigation with a month grid and daily booking list.
- Searchable annual booking register.
- Dedicated request and approval queue.
- Facility availability and blackout workspace.
- Year totals for active bookings, hours, friendlies, requests and planned cost.
- CSV export with cost fields removed automatically when the user is not allowed to see them.

### Booking types and recurrence

- Training.
- Internal and external friendlies.
- Camps and clinics.
- Tournaments.
- Club meetings and events.
- Maintenance.
- External hires.
- Weekly and fortnightly recurring series.
- One-off bookings and controlled series removal.

Every occurrence in a recurring series is validated before any part of the series is saved.

### Conflict protection

The planner checks:

- pitch double-booking;
- team double-booking;
- full-venue and pitch-specific blackout periods;
- current Saturday, Sunday and Midweek Ground Control fixtures;
- every earlier occurrence in the same recurring series.

When a booking conflicts, Ground Control offers ranked alternative dates, times and pitches. The Matchday Planner also consumes annual bookings and blackouts, so dragging a fixture into a protected facility period is blocked.

The database repeats the core annual-booking checks inside the secured save function. Advisory transaction locks reduce the risk of two operators creating conflicting bookings at the same moment.

### Requests, approvals and privacy

- Clubs can configure whether schedulers create requests rather than confirmed bookings.
- When approval is required, non-administrative users are forced into `requested` status by the interface and database.
- Owners and administrators control approvals.
- Cost visibility can be limited to owners and administrators.
- Hidden costs and supplier references are removed server-side, not merely concealed visually.
- Booking contacts and supplier or booking references can be stored with the operational record.

### Commercial entitlement model

- **Core:** the navigation advertises Annual Planner as a controlled paid add-on. Activating the add-on adds only the `annual_planner` entitlement and does not force the club into an unsuitable package.
- **Pro:** included.
- **Elite:** included.

The add-on price is deliberately not hard-coded in the application. It can be confirmed during pilot pricing and activated through the existing entitlement override model.

## Security and governance

The migration creates three forced-RLS tables:

- `annual_planner_settings`;
- `annual_planner_bookings`;
- `annual_planner_blackouts`.

Direct browser table access is revoked. Authenticated use is through role-checked security-definer functions that verify club membership, operating permissions and the annual-planner entitlement.

Audit events are recorded for booking creation, updates, deletion, blackout changes and planner policy changes.

## UX review decisions

- The module is a first-class workspace rather than another Settings tab.
- Core users can see the commercial opportunity without receiving data access.
- Pro and Elite users see the same workflow with no package-specific fork.
- Matchday fixtures remain read-only inside Annual Planner and are edited through Ground Control Operations.
- A booking drawer separates review from editing.
- Requests and blackouts have dedicated queues rather than being mixed into the main calendar.
- The annual page is route-split and adds approximately 46 kB minified rather than inflating the initial workspace bundle.

## Known boundaries

The following are intentionally outside v3.10 and should be considered after pilot evidence:

- external council or facility-provider calendar synchronisation;
- online venue-booking payments;
- attachment storage for booking contracts;
- drag-to-reschedule directly on the annual calendar;
- recurring-pattern exceptions such as “every week except school holidays”;
- automatic coach invitations and attendance capture;
- iCalendar publication for individual team training schedules;
- supplier invoice reconciliation against planned booking cost.

The data model and entitlement boundary support these additions without replacing the core planner.
