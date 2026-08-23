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
- Public `daxora.co.uk` platform website presenting Daxora and its product family before authentication.
- Neutral Daxora loading and authentication identity; Ground Control branding begins only after that product is opened.
- Authenticated Daxora home for organisation-aware product selection.
- Ground Control, League Manager and Daxora Admin open as products from the Daxora home rather than containing the product catalogue themselves.
- Product workspaces expose a compact **Back to Daxora** route instead of duplicating product navigation in their sidebars.
- League Manager availability follows authenticated league membership or platform staff access.
- Coach Hub inclusion follows the club subscription and opens only for authorised coach access.
- Daxora Admin is visible only to platform staff.
- Daxora Pay is presented honestly as in development and cannot be opened.
- Multi-role compatibility remains enforced across legacy and current role-assignment payloads.
- Protected production release evidence now uploads successfully from the hidden evidence directory.

### Next

- Refine organisation selection for multi-club, multi-league and multi-role users, with explicit current organisation and role context.
- Add a safe Coach Hub administration route for club managers without treating coach-only access as club-wide authority.
- Add concise cross-product alerts and subscription state to Daxora Home without duplicating Mission Control.
- Introduce product-level entitlements alongside the existing Ground Control feature entitlements.
- Separate the public and authenticated surfaces onto canonical `www.daxora.co.uk` and `app.daxora.co.uk` routes after staging and DNS acceptance.
- Add public-site commercial essentials: contact/enquiry route, product detail pages, privacy notice, terms, cookie position and support route.
- Establish a shared Daxora design system so future product shells remain recognisably related without losing their specialist identities.

### Daxora Pay boundary

- Shared Daxora identity, organisation and role context.
- Separate payment permissions, audit events and financial data policies.
- Regulated payment provider owns raw payment credentials.
- Daxora owns member billing schedules, collection status, arrears workflows, reconciliation and reporting.

## Ground Control work continues in parallel

Platform work must not suspend operational improvements. Each release should include a bounded platform increment alongside the highest-value Ground Control reliability or workflow improvement, with regression coverage for both.
