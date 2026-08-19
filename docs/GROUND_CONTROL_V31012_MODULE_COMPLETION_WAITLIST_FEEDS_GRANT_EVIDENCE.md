# Ground Control v3.10.12 - Annual Planner Module Completion

## Purpose

This release completes the current implementation baseline for the Annual Planner, Shared Calendar and Coach Request module. It closes unresolved training demand through coach-accepted waitlist offers, gives operators safe bulk controls, creates revocable external calendar feeds, reconciles grant evidence and adds an operational module-acceptance view.

## Waiting-list offers

- Operators can turn an unresolved waitlist entry into a specific dated training-slot offer.
- The offer can use a club pitch, named pitch area or winter-site slot.
- The coach sees the proposal in Coach Hub and can accept or decline it with a response.
- Acceptance rechecks pitch-area, shared-resource and team capacity before creating the confirmed booking.
- Declined offers return the team to the waiting list.
- Offer, response and booking outcomes remain auditable and feed the shared analytics layer.

## Bulk operational commands

Operators can select bookings and apply one controlled command:

- change booking status;
- move bookings to another pitch or area;
- shift booking dates by a specified number of days.

The workspace previews affected bookings and teams. Supabase locks and validates the selected records in one transaction, records the command and writes an audit event. A failed validation prevents a partial change.

## External calendar feeds

- Operators can create private revocable calendar subscriptions.
- Feed scopes support the whole club, one team or one season.
- Calendar output includes approved planner bookings and public blackout information.
- Sensitive costs, supplier references, private notes and administrator notes are excluded.
- Revoking a feed immediately invalidates its token.

## Grant evidence and shared analytics

The common Annual Planner analytics layer now includes:

- requested, approved and unmet training hours;
- waitlist offers accepted, declined and awaiting action;
- bulk operational command volume and bookings changed;
- cost per delivered team-hour;
- existing weather, winter, closure, fairness, preference and capacity measures.

The module can export a grant-evidence CSV using the same measures and narratives shown in Annual Planner Insights and the main Analytics page.

## Module acceptance

A dedicated Delivery & feeds workspace shows operational checks for:

- teams and pitches configured;
- annual bookings tested;
- winter inventory reviewed;
- waitlist workflow tested;
- a private calendar feed created;
- grant evidence generated.

This is an operational readiness indicator, not a replacement for the controlled HSM pilot, RLS checks or commercial acceptance.

## Security and data integrity

- Operators require active club management access for offers, bulk commands and feed administration.
- Coaches can view and respond only to offers for teams they actively manage.
- Accepted offers are revalidated at database level before booking creation.
- Bulk commands run transactionally and fail closed.
- Feed tokens are private, random and revocable.
- External feeds exclude private financial and operational fields.
- Existing organisation isolation and Row Level Security remain active.

## Packaging

The Annual Planner remains a bolt-on module rather than standard Core functionality. It remains included in Elite. Final Pro inclusion or discounted add-on pricing remains a commercial packaging decision.

## Validation

- 12 new v3.10.12 focused tests passed.
- 128 regression files and 711 tests passed.
- TypeScript/Vite production build passed.
- Lint completed with 63 existing warnings and 0 errors.
- The migration source passed structural, delimiter and whitespace checks.
- Payload hashes, staged Git whitespace validation and final ZIP integrity passed.

## Next step

Run the complete module through the controlled Horwich St Mary's pilot. Record only focused maintenance issues against this module while the next product module roadmap is selected and developed separately.
