# Ground Control Entitlements and Subscription Architecture

## Outcome

Ground Control now has a central, provider-neutral subscription and entitlement layer. The entry product is named **Link** throughout the application, catalogue and migration.

This phase does not connect Stripe or collect payments. It creates the commercial source of truth and enforcement needed before live billing is added.

## Product catalogue

| Plan | Current price architecture | Primary position |
|---|---:|---|
| Link | £29/month or £290/year | League-connected operational foundation for clubs with up to four teams |
| Core | £149/month | Full matchday operations, parking, weather, officials, reports and core analytics |
| Pro | £249/month | Advanced analytics, reporting, integrations and increased limits |
| Elite | From £399/month | Multi-site scale, premium support and bespoke capacity |

Plan names do not drive access checks directly. Each plan supplies explicit entitlement keys and numeric limits, allowing packaging to change later without rewriting the operational features.

## Subscription states

The database supports:

- `trialing`
- `active`
- `grace`
- `suspended`
- `cancelled`
- `internal`

Active, unexpired trial, unexpired grace and internal subscriptions receive full access. Suspended, cancelled and expired trial/grace subscriptions retain read access but cannot mutate club data.

## Existing and future clubs

Applying the migration does not make the current pilot club billable. Every club that already exists when the migration runs receives:

- Elite
- Internal status
- Manual billing interval
- Billing-exempt status
- Unlimited operational limits

Clubs created after the migration receive a 14-day Core trial automatically.

## Database model

The migration adds:

- `subscription_plans`
- `club_subscriptions`
- plan entitlements as `text[]`
- plan limits as `jsonb`
- per-club entitlement and limit overrides
- optional external customer and subscription identifiers for a future billing provider
- guarded subscription-read and platform-assignment RPCs

Row Level Security is enabled and forced on the new tables. Authenticated club members may read their own club subscription. Direct browser mutation of subscription records is not granted.

Only an active record in `platform_support_staff` can call `platform_set_club_subscription`. Every manual assignment writes a trusted audit event with the previous plan, next plan, previous status, next status and reason.

## Server enforcement

Supabase independently enforces:

- read-only subscription states
- team limits
- pitch limits
- venue limits
- active-user and pending-invitation limits
- history count and retention limits
- matchday-history entitlement
- officials entitlement
- pitch-intelligence entitlement

The browser hides or locks unavailable functions for clarity, but the database remains authoritative if somebody bypasses the interface.

## Application behaviour

The application now:

- loads the club subscription after secure club access is established
- combines role permissions with subscription access
- fails closed when the subscription cannot be verified
- filters navigation by entitlement
- shows upgrade-required screens for unavailable routes
- displays trial, grace, suspended, cancelled and internal status
- displays a plan badge and read-only notices
- enforces team, pitch and venue limits before saving
- locks workspace modules not included in the current plan
- adds **Settings → Plan & subscription** for the club owner

The plan page is informational in this phase. Club owners cannot change their own plan or grant themselves entitlements.

## Validation

The implementation passed:

- Oxlint with 0 errors
- 16 regression test files
- 103 automated tests
- TypeScript compilation
- Vite production build
- migration regression assertions
- a supplied transactional SQL security proof covering guarded plan assignment, Link restrictions, capacity limits, Core enablement and suspended read-only behaviour

Eighty-eight pre-existing non-blocking lint warnings remain. The main JavaScript bundle is still above Vite's recommended chunk size and remains a later performance task.

## Deferred to later phases

- Stripe or another live payment provider
- checkout and customer portal
- webhook processing
- invoices, tax and failed-payment automation
- self-service upgrades and downgrades
- proration and refunds
- the internal Daxora administration console
- final commercial legal wording
