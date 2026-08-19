# Daxora v3.9.2 — Pilot Hardening and Launch Confidence

**Release date:** 15 July 2026

## Purpose

Daxora already has broad operational capability across Ground Control and League Manager. This release deliberately avoids adding another large business module. It makes the existing platform safer to pilot, easier to support and more credible for a controlled paid launch.

## Platform health and support diagnostics

A new platform-only **System health** workspace provides sanitised deployment checks for:

- Supabase browser and service-role configuration
- email delivery
- live weather mode
- daily automation
- scheduled reports
- finance document delivery
- installed-app push configuration
- release, environment and deployment region

The endpoint never returns credential values. The downloadable support pack excludes tokens, cookies, passwords, fixtures, players and private documents.

## Recovery and monitoring

- React render failures remain contained by the branded recovery boundary.
- Recovery now includes a copyable support reference with release and route information.
- Unhandled promises and browser runtime failures receive separate sanitised telemetry categories.
- Support references can be matched to platform client-event records without exposing customer data.

## Accessibility hardening

- A keyboard-visible **Skip to main content** link is available on every authenticated workspace.
- Main content receives programmatic focus after primary workspace navigation.
- Reduced-motion preferences disable non-essential animation and smooth scrolling.
- System-health state is conveyed with text and icons, not colour alone.

This does not replace a formal external WCAG audit. It closes high-confidence platform-wide issues before that audit.

## Performance

Platform administration now lazy-loads Billing & legal, Pilot & launch and System health panels only when opened. The release evidence records the largest production JavaScript chunk and warns when it exceeds the pilot guardrail.

## Automated launch evidence

`npm run pilot:hardening` creates JSON and Markdown evidence under `.release-evidence` and checks:

- health endpoint and diagnostics workspace
- recovery and telemetry contracts
- keyboard and reduced-motion support
- absence of native browser dialogues
- deployment security headers
- production build output
- bundle-size guardrail
- pilot, incident and deployment runbooks

Set `PILOT_REMOTE_CHECK=true` and `STAGING_URL` after deployment to add live staging checks.

## Remaining acceptance work

This release improves the platform foundation but cannot replace real-user evidence. Before unrestricted launch Daxora still needs:

1. Real tablet and touch-device Matchday Planner acceptance.
2. End-to-end pilot journeys using production-shaped club and league data.
3. A formal accessibility review with documented remediation.
4. A Supabase backup and restore rehearsal performed by an authenticated operator.
5. Incident-response and support escalation rehearsal.
6. Measured onboarding time and operator time saved.
7. Controlled cohorts before broader commercial availability.

## Roadmap position

The next major product module is the committed **Annual Pitch Booking and Training Planner**, covering pre-season, winter training, recurring bookings and friendlies across the calendar year. It follows pilot acceptance because it should be built on a proven, supportable platform rather than adding scope before reliability is demonstrated.
