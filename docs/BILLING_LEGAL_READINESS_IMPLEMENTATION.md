# Daxora Ground Control — Billing and Legal Readiness Implementation

**Phase:** Billing and legal readiness  
**Date:** 3 July 2026  
**Status:** Code complete; database migration, Edge Function deployment, Stripe configuration and professional legal review still required.

## Outcome

Ground Control now has a fail-closed billing architecture prepared for Stripe subscriptions and a controlled legal-document acceptance process. Payment collection cannot begin merely because the interface exists. Checkout remains unavailable until Daxora has:

1. configured its sole-trader business identity;
2. published reviewed commercial documents;
3. selected Stripe test or live mode;
4. deployed the server-side billing functions;
5. configured matching Stripe Price IDs; and
6. obtained the club owner's acceptance of the current required document versions.

The existing Horwich St Mary’s workspace remains **Elite / Internal / Billing exempt** and is not converted into a chargeable account by this phase.

## Billing architecture

### Club billing workspace

A new **Settings → Billing & legal** area provides club owners with:

- current package and subscription status;
- payment-provider and invoice state;
- current published commercial and privacy documents;
- a versioned acceptance process for required documents;
- Link, Core and Pro self-service checkout options;
- Link monthly or annual billing;
- access to Stripe’s hosted customer portal after a customer is created; and
- clear blocked, exempt, test and live states.

Elite remains a manually assigned/contact-led package rather than self-service checkout.

### Daxora Admin controls

A new **Daxora Admin → Billing & legal** area allows a platform administrator to:

- enter the sole trader’s legal name and Daxora trading name;
- enter the service address, website, support and privacy contacts;
- record VAT/tax status and invoice prefix;
- select disabled, test or live Stripe mode;
- review billing/webhook readiness metrics; and
- publish, retire and version legal documents.

These controls do not store Stripe secret keys in the browser or database.

### Server-side Stripe boundary

Three Supabase Edge Functions have been added:

- `create-checkout-session`
- `create-billing-portal`
- `stripe-webhook`

The checkout and portal functions manually verify the signed-in Supabase user and require an active club-owner membership. Stripe secret keys and the Supabase service-role key are read only inside server-side Edge Functions.

The webhook function:

- verifies the Stripe signature against the raw request body;
- records provider events by unique Stripe event ID;
- handles completed checkout, subscription lifecycle, paid invoice and failed-payment events;
- maps Stripe Price IDs back to Ground Control plans;
- updates subscription periods, grace status and payment-failure state;
- ignores already completed duplicate events;
- retries failed or stale event processing safely; and
- records processing failures for Daxora Admin review.

## Database changes

Migration `202607030006_billing_legal_readiness.sql` adds:

- Stripe/payment metadata to `club_subscriptions`;
- `platform_legal_settings`;
- versioned `legal_documents`;
- `club_legal_acceptances`;
- idempotent `billing_provider_events`;
- `billing_checkout_attempts`;
- owner-only club billing status and document-acceptance functions;
- platform-admin billing/legal configuration functions; and
- forced Row Level Security and restricted grants.

Required legal documents must use public HTTPS URLs. Direct acceptance-record visibility is limited to club owners and administrators. Public browser code receives no Stripe secret or service-role credential.

## Legal-readiness scaffold

The patch includes draft outlines for:

- Business Service Terms;
- Data Processing Addendum;
- Acceptable Use Policy;
- Privacy Notice;
- Cookie and Storage Notice;
- Security Overview; and
- Subprocessor List.

These are deliberately marked as drafts. They are operational scaffolding, not final legal documents and not legal advice. They must be completed against the real product, providers, data inventory and business arrangements, then reviewed professionally before publication or paid checkout.

Privacy and cookie notices are presented as transparency information. They are not treated as consent to process personal data. If non-essential cookies or analytics are introduced later, a separate compliant consent mechanism will be required.

## Fail-closed safeguards

Checkout remains disabled when any of these conditions applies:

- Stripe mode is disabled;
- the legal owner, trading name, service address or contact details are incomplete;
- fewer than three required reviewed documents are published;
- a required document lacks an HTTPS URL;
- the current club owner has not accepted every required current version;
- the workspace is internal or billing exempt;
- the club is inactive;
- the requested package/interval lacks an approved Price ID; or
- the caller is not the active club owner.

A successful return from Stripe does not grant entitlements by itself. Subscription state is changed by verified webhook events.

## Validation completed

- `npm run check` passed before final packaging.
- All regression test files passed.
- Production build passed.
- Oxlint reported zero errors; pre-existing non-blocking warnings remain.
- `npm run test:coverage` passed the project thresholds.
- PostgreSQL parsing succeeded for all 63 migration statements.
- PostgreSQL parsing succeeded for all 28 staging security-test statements.
- Browser-source scanning found no Stripe secret key or Supabase service-role key.
- Required HTTPS document enforcement and stale/failed webhook retry behaviour are regression-tested.

## Not completed in this environment

The following require your live services and therefore have not been claimed as complete:

- migration 006 has not been run against your Supabase project;
- the Edge Functions have not been deployed;
- Stripe products, prices, portal or webhook endpoints have not been configured;
- no real or test Stripe payment has been processed;
- webhook delivery has not been tested over the public internet;
- the draft legal documents have not been professionally reviewed; and
- Daxora’s final invoice/business details have not been entered.

## Remaining launch work after rollout

- professional legal and privacy review;
- Stripe test-mode end-to-end verification;
- invoice and tax configuration in Stripe;
- production deployment and observability;
- pilot-club acceptance and payment test;
- final account/profile polish, including **Change Display Name**;
- pilot launch checklist and support procedures.
