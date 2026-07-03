# Ground Control Incident Response Runbook

## Severity

- **P0:** cross-club exposure, data loss, authentication bypass or widespread outage.
- **P1:** incorrect scheduling or persistence, broken access for a pilot club, payment or webhook failure affecting service.
- **P2:** degraded non-critical workflow with a workaround.
- **P3:** cosmetic or low-impact issue.

## Immediate response

1. Create a Daxora support case and record the support reference.
2. Identify affected clubs, release and first known occurrence.
3. For suspected security exposure, stop affected access and preserve evidence.
4. Do not ask clubs to send passwords, keys or private database exports.
5. Assign one incident owner and one communications owner.
6. Record every material action and decision.

## Containment

Depending on the incident:

- suspend checkout or onboarding;
- revoke a support session;
- suspend an affected club account;
- redeploy the last known-good application build;
- disable an external integration;
- rotate server-side secrets when compromise is suspected.

## Recovery verification

- verify authentication and club isolation;
- verify saved club data and matchweek history;
- run the core smoke test;
- confirm telemetry has stopped recurring;
- confirm affected users can resume work.

## Post-incident review

Within two working days for P0/P1 incidents, record:

- timeline;
- root cause;
- customer impact;
- detection gap;
- corrective action;
- regression test added;
- owner and due date.

Assess legal or regulatory notification requirements with qualified advice when personal-data risk is involved.
