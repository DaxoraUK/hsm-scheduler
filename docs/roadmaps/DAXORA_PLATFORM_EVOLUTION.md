# Daxora platform evolution

## Destination

Daxora is one secure organisation platform with a shared identity, organisation boundary, role model and subscription record. Ground Control, Coach Hub, League Manager and Daxora Pay are products within that platform rather than separate accounts or duplicated applications.

## Delivery principles

- Keep Ground Control operational throughout the transition.
- Reuse the existing authenticated shell, organisation membership, multi-role access and subscription enforcement.
- Never treat a visible product tile as authority; every destination continues to enforce its own access controls and database policies.
- Introduce products only when their workflow and security boundary are real. Future products are labelled clearly and remain non-interactive.
- Keep payment-provider credentials and card data outside the general club operations domain.

## Incremental releases

### Foundation — implemented

- Central Daxora product catalogue.
- Product launcher within the existing desktop and mobile shell.
- Ground Control remains the default workspace.
- League Manager availability follows authenticated league membership or platform staff access.
- Coach Hub inclusion follows the club subscription while coach access remains role-controlled.
- Daxora Admin is visible only to platform staff.
- Daxora Pay is presented honestly as in development and cannot be opened.

### Next

- Give Coach Hub a first-class product entry for authorised coaches and a safe administration route for club managers.
- Separate organisation selection from product selection so multi-club and multi-role users always understand their current context.
- Add a platform home showing products, urgent cross-product actions and subscription state without duplicating Mission Control.
- Introduce product-level entitlements alongside the existing Ground Control feature entitlements.
- Prepare canonical `www.daxora.co.uk` and `app.daxora.co.uk` routing without changing production DNS until staging acceptance passes.

### Daxora Pay boundary

- Shared Daxora identity, organisation and role context.
- Separate payment permissions, audit events and financial data policies.
- Regulated payment provider owns raw payment credentials.
- Daxora owns member billing schedules, collection status, arrears workflows, reconciliation and reporting.

## Ground Control work continues in parallel

Platform work must not suspend operational improvements. Each release should include a bounded platform increment alongside the highest-value Ground Control reliability or workflow improvement, with regression coverage for both.
