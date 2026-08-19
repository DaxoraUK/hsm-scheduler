# League Operations v3.9.1 — Finance Automation and Reconciliation

**Release date:** 15 July 2026
**Baseline:** League Operations v3.9 and Ground Control v3.8.5.1

## Why this release exists

Finance v3.9 established a secure ledger for charges, invoices, payments, credits, discipline fines and expenses. It still left the league officer repeating the highest-volume work club by club. v3.9.1 changes the value proposition from “store finance records” to “run the league billing cycle”.

The release is deliberately workflow-led. It targets work that costs a volunteer or paid administrator hours every season: creating the same charge for every club, maintaining treasurer details, matching bank payments, issuing evidence and chasing overdue balances.

## Delivered capability

### Club billing profiles

Each league club can now have a controlled finance profile containing:

- billing and CC email addresses;
- league account reference;
- payment terms;
- reminder cadence;
- purchase-order requirement;
- restricted finance notes.

Profiles are league-scoped and protected through finance-role RPCs rather than direct table access.

### Reusable billing templates

Finance officers can define reusable charge templates against the existing charge catalogue. A template can charge:

- once per active club; or
- once per active team in a selected season.

The preview calculates the eligible clubs, unit count, tax and run total before any invoices are created.

### Bulk seasonal billing

A confirmed billing run creates a controlled invoice for every selected eligible club. It supports:

- draft-first review or immediate issue;
- season and date selection;
- selective club inclusion;
- team-count billing;
- exact run totals;
- an idempotency key to prevent accidental duplicate execution;
- run history and audit evidence.

### Professional invoice and statement documents

League officers and clubs can now:

- open a branded printable invoice;
- print or save it as PDF through the browser;
- download the invoice as a standalone HTML document;
- print a branded club account statement;
- export the statement ledger as CSV.

The generated document shows invoice lines, tax, payments, credits, balance, account reference and league context.

### Invoice and reminder email delivery

Issued invoices can be emailed to the club finance profile through the existing server-side Resend integration. Delivery is prepared by an authenticated finance RPC and completed only by the service role.

Each delivery records:

- recipients;
- invoice and delivery type;
- provider and provider reference;
- status and error message;
- start and completion timestamps;
- league audit event.

### Automatic overdue reminders

The existing protected daily automation route now claims due finance reminders. It uses each club’s configured reminder thresholds, sends the branded reminder, records delivery evidence and avoids duplicate sends for the same threshold.

A reminder is only eligible when:

- the invoice is issued and still has a balance;
- the due date has passed or is today;
- the club has reminders enabled;
- a valid billing recipient exists;
- the relevant reminder threshold has not already been processed.

### Payment-file reconciliation

Finance officers can upload a CSV bank export and review matches before posting anything. The parser accepts common headings for date, amount, reference, invoice and payer/club.

Daxora attempts to match by:

1. invoice number in the payment reference;
2. club name;
3. an amount that fits the outstanding balance.

Ambiguous or unmatched rows remain unposted until the operator chooses an invoice. The database rejects unavailable invoices, invalid values and overpayments. The complete import is retained as an auditable batch.

## Security model

Seven new finance tables have forced row-level security. Direct anonymous and authenticated table access is revoked. Changes flow through security-definer RPCs that re-check the league finance role.

The email provider completion function and automated reminder claim are service-role only. The private service key remains server-side.

## User experience decisions

- Bulk billing is preview-first and requires branded confirmation.
- Payment import is review-first; automatic matching never silently posts an ambiguous payment.
- “Issue immediately” describes portal publication accurately and does not imply email delivery.
- Failed deliveries remain visible in finance history.
- Club finance uses the same invoice model as the league, preventing competing balances.
- Existing Daxora dialogs and toasts are used throughout; native browser prompts are not used.

## Current boundaries

This release does **not** claim:

- a direct bank feed or Open Banking connection;
- card collection or a payment gateway;
- native accounting-software synchronisation;
- server-rendered binary PDF files;
- tax or VAT advice;
- automatic credit-note documents or locked accounting periods.

Invoices and statements are print-ready HTML and can be saved as PDF by the browser. Those boundaries are intentional and are carried into the roadmap rather than hidden.

## Commercial value

v3.9.1 makes League Manager materially easier to sell because it connects operational events to administration and collection:

- annual affiliation and team charges can be raised in one run;
- discipline fines already flow into the finance ledger;
- clubs receive a secure self-service statement;
- payment files can be reconciled as a controlled batch;
- overdue chasing can run without a finance officer remembering every date;
- every action leaves evidence for the league board and auditors.

The strongest sales claim is reduced administration and improved financial control—not “accounting software”.
