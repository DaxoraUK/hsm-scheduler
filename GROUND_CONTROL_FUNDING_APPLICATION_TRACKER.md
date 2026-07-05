# Ground Control Funding Application Tracker

## Purpose

This phase turns a funding project into a controlled application workflow. It records who owns the application, what must happen next, when the funder deadline falls, what was submitted, the decision received and every post-award monitoring obligation.

## Added workspace

Analytics > Funding Intelligence > Funding Workspace > Applications

## Application record

Each saved funding project can hold one or more applications. Every application records:

- programme and application stage;
- accountable owner and owner email;
- application deadline;
- requested and awarded amounts;
- funder application reference;
- submission timestamp;
- expected decision date;
- actual decision date and decision notes;
- next action and working notes;
- award conditions.

Stages include considering, eligibility checking, evidence preparation, awaiting quotations, ready to apply, submitted, further information requested, awarded, unsuccessful, withdrawn and closed.

## Task tracker

Application tasks record:

- title;
- status;
- priority;
- owner;
- due date;
- notes and completion time.

Open overdue tasks are highlighted. Task progress is shown separately from grant-readiness evidence so a well-evidenced application cannot appear operationally complete while key submission tasks remain outstanding.

## Post-award monitoring

Monitoring obligations record:

- report, claim or condition title;
- status and accountable owner;
- due date;
- reporting period;
- evidence required;
- notes and completion time.

This supports expenditure claims, outcome reports, photographs, invoices, participation evidence, acknowledgement requirements and other funder conditions.

## Evidence snapshots

New evidence snapshots include the application records, application tasks and monitoring obligations attached to the project at the time of the snapshot.

## Storage and security

Migration `202607050010_funding_application_tracker.sql` creates:

- `funding_applications`;
- `funding_application_tasks`;
- `funding_monitoring_obligations`.

All records are club-scoped, protected by row-level security and validated against their parent funding project or application. Club owners and administrators can manage records; authorised club users can read them.

Until the migration is applied, the application tracker uses clearly labelled local browser storage. Local records are not shared across users or devices.

## Validation

- 36 test files passed
- 199 tests passed
- TypeScript passed
- Production build passed
- Lint completed with 0 errors and 78 existing warnings
- Initial application bundle remains approximately 472 KB / 145 KB gzip

## Manual acceptance checks

1. Save a funding project and open Applications.
2. Create an application with an owner, deadline and requested amount.
3. Add tasks with different priorities and due dates.
4. Mark one task complete and confirm progress updates.
5. Use a past date on an open task and confirm it is flagged overdue.
6. Record a submitted date, application reference and expected decision date.
7. Record an award, awarded amount and funding conditions.
8. Add post-award monitoring requirements and evidence expectations.
9. Create an evidence snapshot and confirm the application tracker is included.
10. Confirm a read-only user cannot change tracker records.
11. Confirm another club cannot read the application, task or monitoring records.
