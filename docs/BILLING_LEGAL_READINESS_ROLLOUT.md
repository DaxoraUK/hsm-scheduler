# Daxora Ground Control — Billing and Legal Readiness Rollout

Use this as a controlled test-mode rollout. Do not enable live payments until the legal documents and business details have been reviewed and the complete test flow has passed.

## 1. Create a checkpoint

From PowerShell:

```powershell
cd C:\Development\hsm-scheduler

git add .
git commit -m "Checkpoint before billing and legal readiness"
```

## 2. Install the application patch

Extract `ground-control-billing-legal-readiness.zip` directly into:

```text
C:\Development\hsm-scheduler
```

Choose **Replace files in the destination**.

Run:

```powershell
npm run check
npm run test:coverage
```

Do not proceed if either command fails.

## 3. Back up Supabase

Confirm a current Supabase database backup or restore point before applying migration 006.

## 4. Apply migration 006

In **Supabase → SQL Editor → New query**, open the local project file:

```text
supabase\migrations\202607030006_billing_legal_readiness.sql
```

Copy the entire file into the SQL Editor and press **Run**.

This migration seeds legal-document records as drafts and leaves Stripe mode disabled. It does not make Horwich St Mary’s billable.

## 5. Restart and verify the fail-closed state

```powershell
npm run dev
```

Check:

- **Daxora Admin → Billing & legal** exists;
- **Settings → Billing & legal** exists for the club owner;
- Horwich St Mary’s still shows **Elite / Internal / Billing exempt**;
- checkout says it is not live;
- no Stripe customer is created merely by opening the page; and
- existing fixtures, settings and history remain intact.

## 6. Create Stripe test products and recurring prices

Use Stripe test mode or a Stripe sandbox first. Create recurring prices matching the current Ground Control catalogue:

| Package | Interval | Current catalogue price |
|---|---:|---:|
| Link | Monthly | £29/month |
| Link | Annual | £290/year |
| Core | Monthly | £149/month |
| Pro | Monthly | £249/month |

Elite remains manual/contact-led and has no self-service Price ID in this phase.

Copy the four resulting `price_...` IDs. Do not paste secret keys or webhook secrets into ChatGPT.

## 7. Configure Stripe business and invoice settings

In Stripe test mode, configure:

- legal sole-trader name and Daxora trading name;
- business/service address;
- customer support details;
- statement descriptor;
- invoice footer and numbering where appropriate;
- tax/VAT treatment based on professional accounting advice; and
- customer portal features.

At minimum, configure the customer portal to show invoices and payment methods. Decide deliberately whether clubs may cancel, upgrade or downgrade themselves. Ground Control currently creates portal sessions but Stripe controls the enabled portal actions.

## 8. Install and link the Supabase CLI

If the Supabase CLI is not already available, follow Supabase’s current official installation method. Then:

```powershell
supabase login
supabase link --project-ref YOUR_PROJECT_REF
```

Your project reference is the subdomain before `.supabase.co`.

## 9. Set server-side Edge Function secrets

Hosted Supabase Edge Functions provide their Supabase URL and server credentials. Do not put a service-role key in `.env.local`, Vite variables or browser code.

Set only the billing-specific deployed secrets:

```powershell
supabase secrets set STRIPE_SECRET_KEY=YOUR_STRIPE_TEST_SECRET
supabase secrets set STRIPE_PRICE_LINK_MONTHLY=price_xxx
supabase secrets set STRIPE_PRICE_LINK_ANNUAL=price_xxx
supabase secrets set STRIPE_PRICE_CORE_MONTHLY=price_xxx
supabase secrets set STRIPE_PRICE_PRO_MONTHLY=price_xxx
supabase secrets set SITE_URL=http://localhost:5173
supabase secrets set ALLOWED_ORIGINS=http://localhost:5173
```

`STRIPE_WEBHOOK_SECRET` is set after the Stripe webhook endpoint is created.

For local Edge Function serving only, copy `.env.edge.example` to a private ignored file and replace its placeholders. Never commit that private file.

## 10. Deploy the Edge Functions

The project’s `supabase/config.toml` marks the three functions as `verify_jwt = false`. This is intentional:

- checkout and portal verify the bearer token inside the handler;
- Stripe cannot send a Supabase JWT, so the webhook verifies Stripe’s signature instead.

Deploy:

```powershell
supabase functions deploy create-checkout-session --no-verify-jwt
supabase functions deploy create-billing-portal --no-verify-jwt
supabase functions deploy stripe-webhook --no-verify-jwt
```

## 11. Create the Stripe webhook endpoint

Create a Stripe test-mode webhook/event destination pointing to:

```text
https://YOUR_PROJECT_REF.supabase.co/functions/v1/stripe-webhook
```

Subscribe to:

```text
checkout.session.completed
customer.subscription.created
customer.subscription.updated
customer.subscription.deleted
invoice.paid
invoice.payment_failed
```

Copy the webhook signing secret and set it:

```powershell
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_xxx
```

Redeploy `stripe-webhook` if your deployment platform requires a fresh deployment after secret changes.

## 12. Configure Daxora Admin in test mode

Open **Daxora Admin → Billing & legal** and enter the real business details. Because Daxora is operating as a sole trader, use:

- the sole trader’s full legal name;
- the Daxora trading name;
- an address where legal documents can be delivered;
- support and privacy contact addresses;
- the correct tax/VAT status; and
- **Stripe mode: Test**.

Do not post the service address or any secret credentials in chat.

## 13. Complete and review the legal documents

The files under `docs/legal` are drafting checklists only. Complete the real documents and obtain appropriate UK legal/privacy advice.

Publish reviewed documents at stable public HTTPS URLs. At minimum, the application expects these three current documents before checkout:

- Business Service Terms;
- Data Processing Addendum;
- Acceptable Use Policy.

Also publish the final Privacy Notice, Cookie and Storage Notice, Security Overview and Subprocessor List when ready.

In **Daxora Admin → Billing & legal**, publish each exact version and URL. Publishing a new required version causes clubs to accept that new version before a future checkout.

## 14. Preserve Horwich as the internal design-partner workspace

Do not remove Horwich St Mary’s billing exemption to test payments. Keep it:

```text
Plan: Elite
Status: Internal
Billing: Exempt
```

Create a separate staging/test club. In Daxora Admin, give that staging club a normal trial or active status and make sure `billing_exempt` is false.

## 15. Test the complete owner checkout flow

Using the staging club owner account:

1. Open **Settings → Billing & legal**.
2. Read the published documents.
3. Confirm authority and accept the current required versions.
4. Choose Link, Core or Pro.
5. Complete Stripe test checkout with a Stripe test card.
6. Return to Ground Control.
7. Wait for the verified webhook to update the subscription.
8. Refresh and confirm the package/status changed.
9. Open the Stripe customer portal.
10. Confirm invoices and payment-method management work as configured.

A success URL alone must not change entitlements. The verified webhook must be responsible for the subscription update.

## 16. Test payment failure, recovery and cancellation

In Stripe test mode, verify:

- `invoice.payment_failed` moves the club into grace status;
- the failed-payment counter increases once per Stripe event;
- retrying the same event does not double-process it;
- `invoice.paid` restores active status and clears the counter;
- cancellation updates the club subscription correctly; and
- the customer portal returns safely to Ground Control.

Review **Daxora Admin → Billing & legal** for failed or unprocessed webhook metrics.

## 17. Run the staging SQL security proof

The file below is for a controlled staging database with suitable test users and clubs:

```text
supabase\tests\billing_legal_readiness.sql
```

Read and replace every placeholder before running it. Do not run destructive or identity-switching test SQL against live customer data.

## 18. Commit the phase

After the migration and test-mode checks succeed:

```powershell
git add src supabase tests docs .env.edge.example
git commit -m "Add Stripe billing and legal readiness controls"
```

## 19. Live-payment gate

Do not switch Daxora Admin to **Live** until all of these are complete:

- legal documents professionally reviewed and published;
- privacy/cookie position checked against the technologies actually deployed;
- Stripe live account identity and bank details verified;
- live Products and Price IDs created;
- live Customer Portal configured;
- live webhook endpoint and signing secret configured;
- production `SITE_URL` and `ALLOWED_ORIGINS` set;
- invoice and VAT treatment confirmed;
- test-mode failure/recovery/cancellation evidence retained;
- first pilot-club acceptance and support process agreed; and
- rollback and incident contacts documented.

Test and live Stripe Price IDs and webhook secrets are different. Never reuse test credentials in production.
