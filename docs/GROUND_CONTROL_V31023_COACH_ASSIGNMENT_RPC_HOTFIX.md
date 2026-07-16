# Ground Control v3.10.2.3 — Coach Assignment and Contacts RPC Hotfix

## Fault corrected

The v3.10.2.2 multi-team directory correctly saved new assignments with `source_slot = 'directory'`, but the original table constraint still allowed only `coach`, `assistant` and `manual`. Supabase therefore rejected valid multi-team roles with:

`coach_hub_team_assignments_source_slot_check`

The same deployment also exposed an intermittent PostgREST 404 for `list_team_contacts` after the RPC was replaced.

## Changes

- Extends the assignment source constraint to allow `directory`.
- Preserves existing `coach`, `assistant` and `manual` records.
- Adds a versioned `list_team_contacts_v2` RPC.
- Explicitly grants the contacts RPC to authenticated users.
- Reasserts the legacy contacts RPC permission for rollout compatibility.
- Requests an immediate PostgREST schema-cache reload.
- Updates the browser client to use v2 and fall back to the legacy RPC only during rollout.
- Includes manually created and directory-created additional contacts in Communications.

## Result

One adult can be assigned to several teams and roles without violating the database constraint. The Team and Communications contact list reloads after a role is saved.
