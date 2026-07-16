# Daxora v3.10.2.2 rollout

## Installation

Run the supplied double-click installer from an extracted folder. It applies migration:

`202607160002_coach_directory_multi_team_assignments.sql`

## Acceptance checks

1. Open **Settings → Teams** and save a primary coach name, email and mobile number.
2. Confirm no `person_id is ambiguous` notification appears.
3. Open **Settings → Coach Hub** and confirm the person appears once.
4. Select **Teams & roles** and assign that person to a second team.
5. Add an assistant, coach or team-secretary role.
6. Confirm both team badges appear against the same person.
7. Open Communications and confirm additional assigned contacts are available without duplicating the primary recipient.
8. Invite the person and confirm Coach Hub shows every assigned team permitted by the assignment records.

## Rollback

The installer creates a local file backup before applying the release. Database rollback should be handled through a forward repair migration rather than deleting coach people or assignment history.
