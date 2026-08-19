# Daxora v3.9.1 — Rollout and Acceptance

## Release contents

- League finance club profiles.
- Reusable club/team billing templates.
- Previewed bulk billing runs with duplicate-run protection.
- Branded printable invoice and statement documents.
- Authenticated invoice and reminder email delivery.
- Daily automated overdue reminders.
- CSV payment matching and controlled batch posting.
- Finance delivery, billing-run and import history.
- Product audit and full roadmap.

## Database migration

Apply:

```text
202607150002_league_finance_automation_reconciliation.sql
```

The migration creates seven forced-RLS tables and finance-role/service-role RPCs.

## Required environment

The release uses the existing automation and email configuration:

```text
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
RESEND_API_KEY
DAXORA_EMAIL_FROM
CRON_SECRET
```

`DAXORA_EMAIL_REPLY_TO` remains optional. No private value should use a `VITE_` prefix.

Vercel already calls `/api/automation/daily` each day. Automated finance reminders join the existing report-delivery and notification-digest run.

## Staging acceptance

### Migration and access

- `npx supabase migration list --linked` shows `202607150002` locally and remotely.
- A Finance Officer can open Finance → Automation.
- A viewer and unrelated club cannot access league finance data.
- The service-only reminder claim cannot be called as a normal authenticated user.

### Billing profiles

- Save a valid treasurer address, CC, account reference and payment terms.
- Reject an invalid email address.
- Confirm one league cannot read another league’s profile.

### Billing templates and runs

- Create a once-per-club affiliation template.
- Preview the run total and selected clubs.
- Create draft invoices and inspect every line and tax value.
- Repeat the same RPC idempotency key and confirm it does not create duplicates.
- Test a once-per-team template against the active team count.
- Issue a controlled test run and confirm invoices appear in club portals.

### Documents and delivery

- Open an invoice and print/save it as PDF.
- Download the standalone invoice HTML.
- Open the club statement from both operator and club portal views.
- Email an issued invoice to an approved test recipient.
- Confirm the delivery event records provider evidence.
- Attempt delivery without a club billing email and confirm a helpful error.

### Automated reminders

- Configure a test club with reminders enabled and threshold `0`.
- Set an issued test invoice due today with a positive balance.
- invoke the protected daily automation route.
- Confirm one reminder is delivered and recorded.
- invoke it again and confirm a duplicate reminder is not created.

### Payment reconciliation

- Upload a CSV containing one invoice-number match, one ambiguous row and one unmatched row.
- Confirm only the exact match is selected automatically.
- Manually select the ambiguous row.
- Attempt an amount above the invoice balance and confirm posting is blocked.
- Apply a valid batch and confirm invoice balances, import history and audit events.

## Release evidence

After commit:

```powershell
$env:RELEASE_ENVIRONMENT="staging"
$env:RELEASE_ID=(git rev-parse --short HEAD)
npm run release:evidence
```

Then push and verify:

```powershell
git push origin staging
git fetch origin staging
git rev-parse HEAD
git rev-parse origin/staging
```

The final two hashes must match.

## Rollback

The installer creates a timestamped backup before copying files. If validation fails before migration or push, it restores the affected files. A database migration that has already been applied must be treated as forward-only: correct it with a new migration rather than deleting production finance tables.

## Known boundaries

- Print-ready HTML is used for browser PDF saving; no binary server PDF is generated.
- Payment matching begins with uploaded CSV, not a live bank feed.
- Email requires a verified Resend sender.
- The platform records finance operations but does not provide accounting or tax advice.
