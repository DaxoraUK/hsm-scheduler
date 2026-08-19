# Ground Control v3.10.1 — Coach Hub, Team Contacts and Requests

**Release date:** 15 July 2026

## Purpose

v3.10.1 turns the Annual Planner into a club-wide operating workflow. Coaches no longer need separate spreadsheets, forms or duplicated contact setup. Existing adult team-contact records become the controlled source for Coach Hub identity, communications, calendar access, booking requests and acknowledgements.

## Commercial packaging

- Link: unavailable.
- Core: included when the Annual Planner add-on is active.
- Pro: included.
- Elite: included with organisation-wide oversight.
- Coach accounts: unlimited within the club's normal team capacity during the initial commercial phase.

The module fails closed when the Annual Planner entitlement is removed. This is enforced in the browser and in Supabase functions.

## One contact record across Daxora

Team contacts remain the source of truth. Synchronisation creates or updates the connected Coach Hub person and team assignment without asking the club to re-enter:

- name;
- email address;
- mobile number;
- preferred communication channel;
- team;
- staff role.

The same adult contact then powers:

- Communications recipients;
- Coach Hub access;
- booking requests;
- team calendar feeds;
- notification preferences;
- acknowledgements;
- audit history.

Coach Hub does not store player or parent contact information.

## Dedicated Coach Hub

Coaches enter a separate mobile-first workspace rather than the club administration shell.

### Home

- next fixture;
- next training or friendly;
- outstanding actions;
- pending requests;
- recent club messages;
- acknowledgement status.

### My calendar

- confirmed annual-planner bookings;
- protected matchday fixtures;
- friendlies, training, camps and tournaments;
- private iCalendar feed for Google, Apple and Outlook.

### Requests

Coaches can submit:

- regular or one-off training;
- friendlies;
- camps and tournaments;
- booking changes;
- cancellations.

Change and cancellation requests must reference the actual confirmed booking. The original booking is excluded from its own conflict check, but all other pitch, team, fixture and blackout protections remain active.

### Messages

- club decisions;
- requests for more information;
- proposed alternatives;
- operational notices;
- acknowledgement-required messages.

### Team and profile

- team assignments and permissions;
- contact details;
- preferred communication channel;
- calendar feed management.

## Invitations

Club administrators can synchronise existing team contacts, invite one coach or bulk invite eligible contacts.

Invitation controls include:

- email required;
- active team assignment required;
- personal, expiring token;
- accepted only by the invited email address;
- same-origin invitation URLs;
- HTTPS in deployed environments, with HTTP permitted only for localhost development;
- delivery status and provider reference;
- no raw token stored in the database.

## Team-scoped permissions

Assignments support manager, coach, assistant, secretary, welfare and emergency-contact roles. Each assignment controls whether the person may:

- request training;
- request friendlies;
- request changes or cancellations;
- view the team calendar;
- acknowledge messages;
- view costs, when the club permits it.

Coach access grants no generic club permissions. It does not expose Settings, Finance, Discipline, Registrations, other team contact details or the normal administration shell.

## Request review and alternatives

Annual Planner operators receive a request-only queue. They can:

- approve the requested slot;
- offer an alternative date, time, venue or pitch;
- ask for more information;
- reject with a reason;
- approve a cancellation;
- refresh the Annual Planner immediately after a decision.

Club administrators retain the separate identity and invitation workspace. Schedulers can review requests without receiving coach identity fields they do not need.

When a coach accepts an alternative, the final booking action runs through a private audited database function with the same pitch, team and blackout locks used for administrator approval.

## Communications integration

Communications explains that the shared team contact record powers both modules. The data model supports targeting by team assignment and recording delivery or acknowledgement without creating another coach directory.

The next communication refinement should add saved Coach Hub audiences and automatic recipient selection for affected bookings and fixture changes.

## Security and privacy

Migration `202607150004` introduces forced-RLS tables for:

- people;
- team assignments;
- invitations;
- requests;
- messages;
- receipts;
- calendar feeds.

Direct browser table access is revoked. Operations use security-definer functions that enforce club membership, team assignment, entitlement and role.

Additional controls include:

- identity keys never returned to the browser;
- invitation token hashes only;
- private calendar tokens stored as hashes;
- service-role-only delivery completion and feed retrieval;
- advisory transaction locks for booking creation and changes;
- entitlement revocation removes workspace discovery and access;
- audit events for invitations, requests, decisions, bookings, profile changes and messages.

## Known boundaries

This release deliberately does not add:

- safeguarding or qualification document storage;
- parent/player communication records;
- open public request links;
- per-coach billing;
- unattended WhatsApp or SMS delivery;
- two-way external calendar editing.

Those capabilities require additional governance or provider work and should not be implied by the interface.

## Pilot acceptance

A club should prove the following before commercial activation:

1. Existing team contacts synchronise without duplicate people.
2. Individual and bulk invitations reach the intended adult contacts.
3. A coach can access only assigned teams.
4. Training and friendly requests reach the Annual Planner queue.
5. Hard pitch, team, fixture and blackout conflicts remain blocked.
6. An administrator can approve, reject, request information and offer an alternative.
7. A coach can accept or decline an alternative.
8. Change and cancellation requests update the intended booking only.
9. Messages and acknowledgements are visible to the correct team.
10. Removing the add-on or team assignment removes access.
11. Calendar feeds contain only the coach's authorised teams.
12. Communications continues using the original team contact record.
