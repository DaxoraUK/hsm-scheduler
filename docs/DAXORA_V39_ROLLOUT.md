# Daxora v3.9 rollout — League Finance and Ground Control v3.8.5 corrections

## Release contents

This combined release contains:

1. Ground Control v3.8.5 planner-density and live-weather corrections.
2. League Operations v3.9 Finance and Commercial Administration.
3. Supabase migration `202607150001_league_finance_commercial_administration.sql`.

## Automated installer

Extract the release fully and double-click:

`DOUBLE-CLICK-THIS-INSTALL-AND-DEPLOY.cmd`

The installer targets `C:\Development\hsm-scheduler` by default and prompts for another repository path if required.

It performs:

- branch and working-tree protection;
- payload SHA-256 validation;
- pre-install backup;
- exact file installation and verification;
- lint;
- the complete regression suite in four shards;
- TypeScript and Vite production build;
- an exact non-interactive Git commit;
- release-evidence generation;
- linked Supabase migration list and database push;
- `staging` push and remote-commit verification.

## Required preconditions

- The repository is on `staging`.
- Local `staging` is not behind or diverged from `origin/staging`.
- Ground Control v3.8.4 and League Operations v3.8.2 are present.
- Git, Node/npm and the Supabase CLI are available.
- The local Supabase CLI session is authenticated and linked to the staging project.
- No unrelated tracked or untracked files are present in the working tree.

## Staging acceptance

### Ground Control

- Open Saturday with two non-overlapping fixtures on one pitch.
- Confirm both use one horizontal lane.
- Create or load a genuine overlap and confirm a second lane appears.
- Check compact pitch rows at Fit Day and a zoomed interval.
- Open Operations Centre and confirm provider, refresh and risk agree with Dashboard/Matchday.
- Simulate unavailable provider data and confirm the readiness action reports the real state.

### League Finance

- Assign a user the Finance Officer role and verify access.
- Create affiliation and cup charge types.
- Create a multi-line draft invoice and issue it.
- Confirm the linked club can see only its own issued invoice.
- Record a part payment and confirm the balance.
- Confirm an overdue part-paid invoice remains overdue.
- Attempt an overpayment and excessive credit; both must be rejected.
- Apply a valid credit and confirm recalculation.
- Convert a discipline fine into a draft invoice and confirm duplicate conversion is blocked.
- Submit, approve and pay an official expense.
- Download invoice, payment, expense and club-statement CSV files.
- Verify finance activity in league audit history.

## Rollback behaviour

Before the database migration, an installation or validation failure restores the affected files and removes a local release commit created by the installer.

After the database migration succeeds, the installer deliberately retains the release commit and files. Database migrations are not automatically reversed. If the later Git push fails, resolve the network or Git issue and run:

`git push origin staging`

## Post-release roadmap

Recommended next work:

1. v3.9.1 finance automation and reconciliation: invoice PDFs/email delivery, bulk seasonal billing, payment imports, debt reminders and controlled reversals.
2. Ground Control pilot acceptance: touch planner testing, move-history comparison, visual capacity overlays and matchday performance review.
3. Platform-wide final UX/information-architecture review before controlled commercial launch.
