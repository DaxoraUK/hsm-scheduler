# Daxora v3.8.2 — Analytics Delivery and Reporting Automation

## Purpose

v3.8.2 converts the governed Analytics and Reports workspace introduced in League Operations v3.8 into an operational delivery system. It adds report distribution lists, delivery queues, retry history, scheduled automation, formatted Excel exports, server-backed notifications, user preferences, installed-app push and a reporting archive.

The release deliberately keeps the reporting figures grounded in immutable snapshots. A scheduled delivery is not allowed to silently regenerate figures from an unknown state or email stale data without recording the failure.

## Analytics delivery workspace

League Manager → Command → Analytics & reports → Reports & evidence now provides:

- scheduled report definitions with weekly, monthly, quarterly and annual cadence;
- HTML, CSV and Excel XML workbook output;
- direct recipients and reusable distribution lists;
- a configurable maximum source-snapshot age;
- email or archive-only delivery;
- governed source snapshot capture;
- due, queued, processing, delivered, failed, skipped and retry states;
- provider reference, attempt count and failure reason;
- manual **Run now** delivery;
- controlled retry of failed runs;
- archived snapshot download from the exact data used for delivery;
- data-freshness indicators and stale-data protection.

The existing browser Print / Save as PDF route remains available for manually produced board packs. Automated attachments are HTML, CSV or Excel workbook files; v3.8.2 does not falsely label an HTML attachment as a server-rendered PDF.

## Scheduled execution

`vercel.json` registers one daily automation call:

```text
/api/automation/daily at 07:15 UTC
```

The worker:

1. queues report definitions whose next-due time has arrived;
2. claims up to 20 ready report runs;
3. validates the governed source snapshot and recipient list;
4. generates the selected artifact;
5. sends it through the configured Daxora email provider;
6. records provider reference, artifact name, attempt count and final state;
7. creates in-app activity and requests installed-app push for affected operators;
8. processes daily and weekly notification digests.

The endpoint requires an `Authorization: Bearer …` secret. On Vercel, configure `CRON_SECRET`; the same value may also be stored as `DAXORA_AUTOMATION_SECRET` for controlled manual or alternative automation calls.

## Governed snapshot boundary

The worker delivers the newest compatible snapshot captured for that report definition and filter scope. An authorised operator loading Analytics refreshes source snapshots when they are missing or older than six hours.

The unattended worker does not reconstruct the entire live league analytics model by bypassing the application’s role and data-loading boundaries. Therefore:

- missing source snapshot → run recorded as skipped/failed with `REPORT_SNAPSHOT_MISSING`;
- source older than the report’s freshness limit → delivery blocked with `REPORT_SNAPSHOT_STALE`;
- no recipients → delivery blocked with `REPORT_RECIPIENTS_MISSING`.

This is safer than emailing old or partially loaded figures. A future warehouse/materialised-view phase can provide fully server-generated live snapshots without requiring an operator visit.

## Email delivery

Report delivery reuses the existing server-side communications configuration and Resend integration.

Required server variables include:

```text
COMMUNICATIONS_EMAIL_ENABLED=true
COMMUNICATIONS_EMAIL_FROM=Ground Control <matchday@YOUR_VERIFIED_DOMAIN>
RESEND_API_KEY=YOUR_SERVER_ONLY_RESEND_API_KEY
```

Staging retains the existing redirect-pilot controls. When pilot mode is enabled, intended league recipients are not contacted; messages are redirected to the authorised internal test inbox.

Attachments are generated from the governed snapshot and sent as Base64 content with a controlled filename. The delivery record stores the Resend provider reference for audit and support.

## Notification centre and preferences

The v3.8.1 Daxora activity centre is now server-backed and follows the signed-in user across devices.

Each user can control:

- in-app activity-centre visibility;
- email alerts;
- daily digest;
- weekly digest;
- installed-app/browser push;
- quiet hours and timezone;
- categories for system, fixtures, results, reports, discipline and registrations.

Read, unread and dismissed state is synchronised through Supabase. Existing local notifications are merged with the remote centre so the upgrade does not discard recent activity.

Disabling the in-app centre or a category hides those items from the unread badge and visible queue while preserving the governed server record.

## Installed-app and browser push

v3.8.2 adds:

- `/daxora-sw.js` service worker;
- browser subscription registration and removal;
- secure server-side subscription storage;
- VAPID-signed payloadless push;
- quiet-hour suppression;
- expired-subscription cleanup;
- a user-controlled **Send test** action;
- Daxora name, icon and click-through behaviour;
- application badge updates from unread activity.

The push is intentionally payloadless. The operating system displays a generic Daxora update and the user opens the secure activity centre to read account-specific detail. Confidential league or player information is not sent through the third-party push transport.

The surrounding Windows, Edge, Android or browser notification shell remains controlled by that platform. Daxora controls the application name, icon, default wording and destination.

## Excel output

The Excel option produces a SpreadsheetML workbook that opens directly in Microsoft Excel. Depending on report type it includes structured worksheets for:

- executive measures;
- competition delivery;
- club scorecards;
- official coverage and workload;
- governance and compliance;
- funding evidence.

This is a real multi-sheet workbook rather than a CSV file renamed with an Excel extension.

## Performance improvements

League Manager’s heavy child workspaces now load through React lazy boundaries. The main League Manager entry chunk is reduced from roughly 627 KB in the prior build to approximately 70 KB minified, with Analytics loaded as a separate approximately 82 KB chunk.

The broader application entry chunk remains above the preferred 500 KB warning threshold. It is a known platform-level optimisation task rather than a League Manager blocker.

## Database additions

Migration `202607140010_daxora_reporting_delivery_notifications.sql` adds or upgrades:

- `daxora_notification_preferences`;
- `daxora_notifications`;
- `daxora_push_subscriptions`;
- `league_report_distribution_lists`;
- `league_report_delivery_runs`;
- extended report-definition delivery settings;
- notification-centre, preferences and push-subscription RPCs;
- report queue, claim, complete and retry RPCs;
- daily/weekly digest claim and completion RPCs;
- due-report automation and audit events;
- RLS and grants for league, club and user isolation.

A successful delivery advances the report definition’s last-run and next-due dates. Capturing a snapshot by itself no longer pretends that a scheduled report ran.

## Security and privacy

- Browser clients never receive the Supabase service-role key, VAPID private key, Resend key or automation secret.
- Report queue claims are performed through role-checked RPCs.
- The user-triggered delivery endpoint verifies the Supabase access token and league context.
- Automated delivery uses server-only service-role RPCs.
- Push-subscription secrets are visible only through controlled RPCs and service processes.
- Notification rows are scoped to their intended user.
- Report snapshots continue to exclude player names, dates of birth, evidence documents and confidential case notes.
- Payloadless push avoids exposing notification content to push transports.
- Quiet hours apply to disruptive push; the activity remains available in Daxora.

## Deliberate boundaries

The release does not claim the following are complete:

- server-rendered branded PDF attachments;
- live server-side reconstruction of every analytics source without a governed snapshot;
- arbitrary drag-and-drop report designer;
- finance reporting before the finance ledger exists;
- SMS or WhatsApp report distribution;
- guaranteed identical notification styling across operating systems;
- encrypted push payload content.

## Recommended next phase

The next major phase is **League Operations v3.9 — League Finance and Commercial Administration**:

- affiliation, team-entry and cup-entry fees;
- club invoices, credits, receipts and statements;
- fines reconciliation;
- referee expenses;
- overdue-debt and payment queues;
- finance permissions and audit;
- financial dashboards and board reporting.
