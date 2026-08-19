# Ground Control v3.10.3.3 — Coach Hub access recovery

## Fault

A confirmed coach account could reach Ground Control successfully but still see **No club access found**. The invitation token was stored in the browser that started registration. When the Supabase confirmation email opened in another browser, private window, or device, that browser did not always have the raw token needed to complete invitation acceptance.

## Repair

- Adds a secure recovery RPC that claims only unexpired Coach Hub invitations whose email exactly matches the authenticated Supabase JWT email.
- Requires an active coach person, an active team assignment, an active club and the Annual Planner entitlement.
- Refuses to replace a person already linked to a different user.
- Repairs historically accepted invitations whose person link was missing.
- Runs recovery automatically before the application displays the no-access gate.
- Reloads accessible workspaces immediately after recovery.

No generic club membership is created. Coaches continue to receive team-scoped Coach Hub access only.
