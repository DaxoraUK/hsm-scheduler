# Ground Control Pilot and Launch Readiness Implementation

## Scope delivered

This phase converts the remaining launch-preparation work into controlled product and platform workflows.

### User profile

- Every signed-in user can open **My profile** from the header menu.
- Display names are validated, saved to `public.user_profiles`, reflected in Supabase Auth metadata and mirrored to Daxora staff records where applicable.
- Email, password and account identity are not changed.

### Pilot operations

The Daxora Admin area now contains **Pilot & launch** with:

- launch gates and evidence;
- pilot-club stage and health;
- target start and review dates;
- a standard pilot checklist;
- internal pilot notes;
- current plan, subscription and onboarding context;
- unresolved client-error telemetry.

Only platform administrators can change launch gates or pilot records. Support operators can review launch readiness and resolve client events.

### Client telemetry

Authenticated application crashes and unhandled promise rejections are recorded through an RPC. The browser removes tokens, email addresses and high-risk context keys before submission. PostgreSQL removes sensitive context keys again.

No fixture, player, team, password, authentication token, cookie or API key is intentionally stored.

### Database security

Migration `202607030007_pilot_launch_readiness.sql` adds:

- `platform_launch_gates`;
- `platform_pilot_clubs`;
- `platform_client_events`;
- `update_my_profile`;
- `record_client_event`;
- platform-admin launch and pilot RPCs;
- platform-support telemetry resolution.

All three tables use forced Row Level Security and have no direct browser insert, update or delete grants.

## Explicitly not completed by code

The following require operator action or third-party access:

- public production deployment;
- DNS and TLS configuration;
- Stripe test and live credentials;
- final legal review and publication;
- production backup restoration exercise;
- live alert routing;
- real pilot-club training and sign-off.

Those actions are covered by the rollout and runbook documents.
