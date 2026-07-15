# League Operations v3.9 — Finance and commercial administration

## Purpose

v3.9 adds a controlled league-finance workspace around the operational records already managed by League Operations. It gives league staff one auditable place to create charges, issue club invoices, collect payments, apply credits, convert discipline fines into debt, manage official expenses and provide club statements.

This is an operational league ledger and administration system. It is not positioned as statutory accounting software, a bank feed or a replacement for the league's formal accounts package.

## Finance command centre

The Administration workspace now includes **Finance & commercial** for league owners, administrators and Finance Officers.

The command view surfaces:

- outstanding and overdue club balances;
- draft invoices;
- received payments and applied credits;
- active discipline fines not yet invoiced;
- approved official or league expenses awaiting payment;
- direct routes into the relevant invoice, fine or expense record.

Finance priorities also appear in the main League Operations command centre for authorised finance roles.

## Charge catalogue

Reusable charge types support:

- affiliation;
- team and competition entry;
- cup entry;
- discipline fines;
- official fees;
- facilities and administration;
- other league charges;
- default amount and tax rate;
- active/inactive control and notes.

## Invoices

Authorised users can:

- create and edit draft club invoices;
- add multiple priced lines and tax rates;
- use reusable charge types;
- link source records such as discipline sanctions;
- issue an invoice into the secure club portal;
- view subtotal, tax, payments, credits and live balance;
- identify overdue and part-paid debt;
- void an invoice only when no active payment or credit exists.

Server controls block zero-value issue, overpayments and credits above the outstanding balance.

## Payments and credits

The payment register records:

- invoice and club;
- amount and payment date;
- method and reference;
- notes and audit actor;
- received, cleared or reversed state in the data model.

Credits require a reason and reference. Invoice balances and statuses are recalculated after every financial movement. An overdue part-paid invoice remains in the overdue queue until its balance is cleared.

## Discipline integration

An active discipline fine can be converted into a draft invoice for the respondent club. The source sanction is attached to the invoice line and a unique database constraint prevents the same fine being invoiced twice.

## Expenses

The expense register supports official and league expenditure including:

- referee and assistant match fees;
- travel, mileage and parking;
- equipment and administration;
- fixture and official references;
- submission, approval, rejection and payment status;
- payment references and audit history.

## Club portal

Each linked club can see only its own issued finance data. The club view provides:

- outstanding and overdue balances;
- issued, part-paid, overdue and paid invoices;
- invoice lines, payments and credits;
- downloadable club statement.

Draft and void invoices are not exposed to clubs.

## Reports

CSV exports include:

- invoice register;
- payment register;
- expense register;
- individual club statements;
- a league-wide statement export with a separate running balance for each club.

## Security and governance

- Dedicated `finance` league role.
- League owners and administrators retain finance access.
- Finance tables use forced row-level security and no direct authenticated-table grants.
- Reads and writes are exposed through security-definer functions with league-role checks.
- Club-portal access is restricted to the authenticated club link.
- Every material action writes to the league audit history.

## Deliberate boundaries

Not included in v3.9:

- card or bank payment processing;
- bank-feed reconciliation;
- automated invoice email delivery;
- VAT returns or statutory accounting journals;
- direct integration with Xero, Sage or QuickBooks;
- payment plans, direct debit mandates or automated debt collection.

These are future integrations built on the v3.9 ledger rather than reasons to weaken the current operational controls.
