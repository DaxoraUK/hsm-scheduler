# Ground Control v3.10.3 — Coach Hub Contact Join Repair

## Fault confirmed from the live screenshots

A primary Coach Hub assignment existed for **Andrew Manville → U14 Spartans**, but Settings → Teams still displayed **No contact details added**. The Coach invitations list also contained repeated **Unnamed contact** cards.

## Root causes

1. `list_team_contacts_v2` returned only Coach Hub assignments created through selected source slots. Older `coach` and `assistant` assignments could therefore be visible in Coach Hub but absent from the shared Teams contact model.
2. Settings → Teams depended on shared contact state that could remain stale after a Coach Hub role change.
3. An earlier bootstrap migration created empty people records for blank team-contact rows, producing the repeated Unnamed contact cards.

## Repair

- All active Coach Hub assignment source slots are now included in the shared contact RPC.
- Settings → Teams reads the authoritative Coach Hub workspace directly and resolves the primary person against the selected team by team key and normalised team name.
- Coach Hub broadcasts a shared-contact refresh event after data reloads.
- Empty, unused bootstrap people are retired by migration and filtered client-side during rollout.
- The existing repository-level merge remains in place for Communications and other shared consumers.

## Validation

- Focused Coach Hub and Insights tests passed.
- Complete regression suite passed.
- TypeScript and Vite production build passed.
- Lint completed with existing warnings and zero errors.

## Database

Migration included:

`202607160004_coach_hub_contact_join_and_orphan_cleanup.sql`
