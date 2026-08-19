# Daxora v3.8.1 — Notifications, Dialogues and Interaction System

## Purpose

v3.8.1 removes generic Edge-owned application prompts and establishes one branded interaction language across Daxora Ground Control and League Manager.

This is a platform-wide UX and operational-safety release. It is deliberately completed before finance workflows, where unclear confirmations or transient error messages would create greater commercial and audit risk.

## Delivered

### Branded confirmation and guided-response dialogues

- Replaced product use of native `alert()`, `confirm()` and `prompt()` calls.
- Added Daxora confirmation dialogues for destructive, publishing, access and workflow actions.
- Added guided-response dialogues for rejection reasons, approval notes, disputes, appeals and corrections.
- Added clear action labels, severity treatments, contextual descriptions and optional record details.
- Added escape, backdrop, focus and body-scroll behaviour suitable for modal workflows.
- Updated unsaved-change protection to use the branded dialogue for navigation inside the application.

The browser-owned warning shown when a user closes or reloads a tab with unsaved work remains native by design. Browsers do not allow applications to restyle that security-controlled prompt.

### Branded toast system

- Replaced direct Sonner imports with a single Daxora notification gateway.
- Standardised success, information, warning, action-required and critical states.
- Added Daxora visual styling, icons, close controls and action support.
- Preserved existing component call sites so the upgrade does not rewrite operational business logic.
- Retains critical errors, warnings and action-required updates after the transient toast closes.

### Persistent activity centre

- Added a notification bell to the global product header.
- Added unread counts, all/unread filters, read state, dismissal and clear-read controls.
- Shows severity, workspace and relative time.
- Supports links back to the relevant Daxora workspace.
- Stores up to 120 retained notifications in the current browser profile.
- Synchronises changes across open tabs through browser storage events.

The v3.8.1 activity centre is intentionally browser-local. Server-synchronised, multi-device notification delivery is planned for v3.8.2.

### Daxora PWA identity

- Added a Daxora web app manifest.
- Added 192px and 512px standard and maskable icons.
- Added standalone display, theme colour and application identity metadata.
- Enables correctly branded installation identity where Edge or another compatible browser installs the application.

The operating system still owns the outer Windows notification shell. Daxora can control its application name, icon, content and actions once push delivery is added, but cannot restyle Windows itself.

### Regression protection

The v3.8.1 regression contract now fails if product source reintroduces a bare or browser-global `alert()`, `confirm()` or `prompt()` call.

## UX decisions

- Reversible actions should increasingly use an Undo pattern rather than a blocking modal.
- Destructive, publication, permissions and governance actions retain an explicit confirmation step.
- Routine success messages remain transient unless the caller explicitly requests persistence.
- Warnings, critical errors and action-required messages persist in the activity centre.
- Technical provider details may remain in logs while user-facing messages should explain the recovery action.
- Duplicate toast-and-banner messages should be removed during subsequent workspace reviews.

## Known boundaries

- No database migration is required for v3.8.1.
- Notifications are not yet shared across devices or users.
- Browser/Windows push permission and service-worker delivery are not included.
- Email digests and report-delivery automation are not included.
- The existing native `beforeunload` prompt remains for closing or reloading a tab with unsaved work.
- The existing large League Manager and main application bundle warnings remain and should be addressed through code splitting.

## Next phase: v3.8.2

Analytics Delivery and Reporting Automation should build on this interaction layer with:

- Server-backed notification records and recipient routing.
- Per-user notification preferences, quiet hours and category controls.
- Browser push and installed-PWA badges.
- Email alerts and daily or weekly digests.
- Background-job progress, retry and failure recovery.
- Scheduled report execution rather than schedule records alone.
- PDF and formatted Excel generation.
- Distribution lists, delivery history and failed-delivery queues.
- Report archive, data-freshness indicators and underlying-record drill-downs.
- Dynamic imports and bundle splitting for League Manager and platform administration.

After v3.8.2, the next major product module remains v3.9 League Finance and Commercial Administration.
