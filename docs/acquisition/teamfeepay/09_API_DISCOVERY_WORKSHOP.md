# TeamFeePay API discovery workshop

This document is for a confidential technical workshop after TeamFeePay has confirmed interest and authorised integration discovery.

## Boundary

Daxora does not claim access to, knowledge of or compatibility with a private TeamFeePay production API. The current adapter and OpenAPI contract are a sandbox proposal based on Daxora's canonical entities. No production request should be made until TeamFeePay supplies written permission, documentation, credentials and an approved test environment.

## Information requested from TeamFeePay

1. Authentication model, token lifecycle and environment separation.
2. Published or private API base URLs and versioning policy.
3. Club, team, person, membership, event and payment identifiers.
4. Read/write permissions for each entity.
5. Webhook catalogue, signing method, retry behaviour and ordering guarantees.
6. Pagination, rate limits, idempotency and concurrency rules.
7. Data ownership, controller/processor roles and retention requirements.
8. Sandbox data, test accounts and support escalation route.
9. Audit-log requirements and permitted operational telemetry.
10. Expected integration architecture: embedded module, service-to-service API, export/import or domain-logic port.

## Proposed minimum integration scope

### Read from TeamFeePay

- Club and organisation identity.
- Teams, age groups and competition context.
- Authorised coaches and operational contacts.
- Existing events and fixture references.
- Membership eligibility indicators where permitted.

### Write back to TeamFeePay

- Confirmed operational event times and venues.
- Pitch or facility allocation status.
- Closure, postponement and reschedule status.
- Communication-ready operational changes.
- Aggregate utilisation evidence, where approved.

## Technical acceptance questions

- Which system is authoritative for each field?
- How are conflicting updates resolved?
- Can identifiers be safely stored outside TeamFeePay?
- Are deletes hard deletes, soft deletes or status transitions?
- What is the maximum expected organisation and event volume?
- What response times and availability targets are required?
- What data must never leave TeamFeePay infrastructure?
- Is an acquisition expected to retain Daxora as a service or port its rules into TeamFeePay's stack?

## Demonstration outcome

The workshop should end with:

- an agreed entity map;
- an agreed system-of-record matrix;
- an authorised sandbox path;
- a first vertical slice;
- named technical owners;
- security and data-protection requirements;
- a written decision on whether integration work forms part of diligence or follows heads of terms.
