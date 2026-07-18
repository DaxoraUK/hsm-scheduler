# Ground Control v3.10.11 - Smart Refinement and Calendar Polish

## Purpose

This release improves the trust, explainability and day-to-day usability of Smart Training Allocation and the shared Annual Planner calendars. It does not add a new database migration. It uses the existing allocation-run summary, allocation-item lock fields, policy records and calendar data introduced in earlier releases.

## Smart allocation refinement

- Operators can lock assigned teams and rebuild only the remaining draft.
- Locked allocations keep their resource, day and time unless the operator explicitly clears the lock.
- Drafts can compare against the latest published allocation.
- Changed-from-usual teams are identified and the previous allocation is shown.
- Fairness scoring spreads avoidable demand across suitable start times.
- Preference success, prime-slot fairness, manual overrides and protected locks are recorded in the run summary.
- Unassigned teams include explicit reasons and suggested next steps.
- Applying an alternative is recorded as an operator override and protected from accidental movement.

## Rule and coach-preference workflow

- Master rules can be copied to another season.
- Age-group defaults can be generated in bulk.
- Coach preference review shows current approved values beside the proposed values.
- Existing master restrictions remain authoritative.

## Calendar polish

Annual Planner:

- Calendar and filtered agenda views remain available without changing the underlying booking model.
- Search, facility, status and closure filters support operational review.
- Full Pitch and named-area allocations display clearly.
- Concurrent named-area bookings stack as separate entries.

Coach Hub:

- Month, week and agenda views are available.
- Facility and status filters reduce clutter.
- Pitch-area badges distinguish Full Pitch, Half A, Half B and other configured areas.
- Available days can start a request directly.

## Analytics

The shared planner analytics layer now reports:

- preferred-slot success percentage;
- prime-slot fairness percentage;
- teams changed from their usual allocation;
- manual operator overrides;
- protected allocations.

The same measures feed Annual Planner Insights and the main Analytics page.

## Security and data integrity

- Existing club access, RLS and operator publication rules are unchanged.
- No draft is published automatically.
- Locks affect draft generation only and do not bypass final database conflict validation.
- Historic comparison uses club-scoped published allocation data.

## Validation

- 10 new v3.10.11 focused tests passed.
- 51 related Annual Planner, Smart Allocation and calendar tests passed.
- 127 regression files and 699 tests passed.
- TypeScript/Vite production build passed.
- Lint completed with 63 existing warnings and 0 errors.
- Payload hashes and Git whitespace checks passed.

## Next phase

Ground Control v3.10.12 will complete waiting-list automation, bulk operational commands, external calendar feeds, grant-evidence reconciliation and controlled HSM module acceptance.
