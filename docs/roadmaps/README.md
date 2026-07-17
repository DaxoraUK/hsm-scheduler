# Daxora Ground Control module roadmaps

This directory is the committed source of truth for product-module roadmaps.

Roadmaps are created and maintained **one module at a time**. A module is implemented and validated, its roadmap is then updated, and only then does work move to the next module. This avoids broad speculative documents becoming detached from the working product.

## Roadmap standard

Each module roadmap must record:

- purpose and module boundaries;
- current production or staging baseline;
- known gaps and technical debt;
- next release and near-term phases;
- later opportunities and deliberate exclusions;
- dependencies and data model implications;
- permissions, RLS, audit and security requirements;
- UX principles and accessibility expectations;
- testing and acceptance criteria;
- analytics and reporting outputs;
- package entitlements and commercial opportunities;
- decisions made, open decisions and change history.

## Current roadmap set

| Module | Roadmap | Status |
|---|---|---|
| Annual Planner, Shared Calendar and Coach Requests | `ANNUAL_PLANNER_SHARED_CALENDAR_COACH_REQUESTS_ROADMAP.md` | Active baseline committed in v3.10.5.4 |

Other module roadmaps will be added individually after their relevant implementation phase is reviewed. They should not be generated in bulk.

## Maintenance rule

A roadmap update must accompany any release that materially changes its module's data model, permissions, workflow, package entitlement, analytics, or user experience. Completed items must be moved into the baseline section rather than deleted, preserving a useful product history.
