# Ground Control v3.10.13 - Unified Analytics, Reports and Team Contact Management

## Release goal

Complete the immediate handoff from the Annual Planner module into the dedicated Analytics and Reports roadmap while repairing the confirmed Team Contact management dead end in Coach Hub.

## Team contact management repair

The Teams and Roles dialog now provides a management route for every active assignment, including contacts whose source is Settings -> Teams.

Available actions:

- Edit contact details;
- Edit role, primary status and Coach Hub permissions;
- Open Team settings for a team-managed source contact;
- Unassign the person from one team.

Unassignment:

- warns when the assignment is primary;
- removes only the selected team relationship;
- retains the shared person record;
- retains all other team assignments and access;
- clears the matching primary or assistant slot in the restricted team contact record when required;
- refreshes Coach Hub and Team contact state;
- records an audit event.

Team-sourced assignments keep their source slot when their role or permissions are edited. The contact-sync trigger preserves those edits instead of recreating a second default assignment.

## Unified Analytics

Main Analytics now opens on Facility Usage rather than treating Matchday analytics as the whole club picture.

The unified evidence engine combines:

- saved fixtures;
- training;
- friendlies;
- events and camps;
- external hires;
- winter/external-site use;
- closures and maintenance;
- weather downtime;
- unused configured capacity.

It supports date, season, site, pitch, area, team, age group, usage type and status filters.

Two half-pitch bookings count as two team-hours and one pitch-equivalent hour. This preserves the distinction between service delivered and physical capacity occupied.

Measures include utilisation, delivered/scheduled/cancelled/postponed hours, weather and maintenance loss, waiting demand, participants, period comparison, booking cost and cost per delivered team-hour where costs are visible.

## Unified Reports

Reports includes a new Unified Facility Usage report as the default report type. It provides:

- date range controls;
- facility and usage summary;
- pitch/site utilisation table;
- closure and unused-capacity evidence;
- grant/investment narrative;
- CSV export;
- browser print and Save as PDF.

The existing matchday and funding report catalogue remains intact.

## Database changes

Migration `202607180001_unified_analytics_team_contact_management.sql`:

- repairs the Team Contact to Coach Hub sync trigger;
- safely updates source-managed assignment roles and permissions;
- makes unassignment clear the selected team slot without deleting the person;
- synchronises administrator contact edits;
- adds scheduling policies to the Annual Planner analytics payload;
- retains club membership, entitlement and audit controls.

## Acceptance cases

1. Open Andrew Manville -> Teams and Roles.
2. Confirm both U14 Spartans and U8 Sharks show management actions.
3. Edit the U8 role or primary status and refresh.
4. Confirm the source remains Managed from Teams and the change persists.
5. Unassign U8 Sharks and confirm U14 Spartans is unchanged.
6. Confirm Andrew remains in the shared directory and the U8 Team contact slot is cleared.
7. Open Main Analytics and confirm Facility Usage is the default view.
8. Confirm fixture, training and friendly activity appear in one evidence model.
9. Confirm two simultaneous halves total one pitch-equivalent hour.
10. Open Reports -> Unified Facility Usage and compare its totals with Main Analytics.
