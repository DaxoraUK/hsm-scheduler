# Ground Control v3.10.3.2 — Coach Hub auth confirmation repair

## Faults repaired

1. Ground Control did not provide Supabase with the deployed return URL during account creation. Supabase therefore used the project's default Site URL, which was still a localhost address and caused `ERR_CONNECTION_REFUSED` after email confirmation.
2. `accept_coach_hub_invitation` linked the coach and then called `public.record_audit_event`. That audit function is deliberately restricted to club operators, so PostgreSQL rolled back the complete acceptance transaction with `Club operator access required`.

## Application repair

- Signup and password-recovery requests now include the active Ground Control URL as `redirect_to`.
- Coach, club and league invitation query parameters are preserved through email confirmation.
- Supabase confirmation sessions returned in the URL fragment are consumed before any older browser session is validated.
- A confirmation opened while an administrator is signed in replaces that browser session with the confirmed coach account.
- The pending Coach Hub token is retained locally until acceptance succeeds, then removed.

## Database repair

Migration `202607160006_coach_hub_auth_callback_and_self_service_audit.sql` installs a private, access-checked audit helper and redirects only Coach Hub self-service functions to it. Admin/operator audit behaviour remains unchanged.

The repair covers invitation acceptance, request submission, alternative responses, coach profile updates, request conversations, contact verification and bookings created from coach requests.

## One-time Supabase Auth setting

Set the hosted Supabase project's Auth URL configuration to:

- **Site URL:** `https://ground-control-five.vercel.app`
- **Redirect URL:** `https://ground-control-five.vercel.app/**`

This setting belongs to Supabase Auth configuration and cannot be changed by a database migration. The installer opens the correct dashboard page after deployment.
