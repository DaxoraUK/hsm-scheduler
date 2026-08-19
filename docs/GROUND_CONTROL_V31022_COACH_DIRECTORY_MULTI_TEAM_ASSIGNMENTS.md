# Ground Control v3.10.2.2 — Coach Directory and Multi-Team Assignments

**Release date:** 16 July 2026

## Problem corrected

Saving a team coach could fail with `column reference "person_id" is ambiguous`. The Coach Hub contact-sync trigger used `person_id` as both a PL/pgSQL variable and a table column inside an `ON CONFLICT` assignment path.

The trigger now uses an unambiguous `resolved_person_id` variable and has regression coverage for the exact failure.

## Coach directory

Coach Hub is now the club's adult people directory. An administrator can create or edit one adult record and reuse it across teams instead of entering the same person repeatedly.

Each person can hold several active assignments, including:

- Manager
- Lead coach
- Coach
- Assistant coach
- Team secretary
- Welfare contact
- Emergency contact

The same person may be attached to several teams and may hold more than one role where needed.

## Team contact relationship

The Teams page remains the quick setup for the main manager and optional assistant. Those two source-managed roles are labelled in Coach Hub and remain editable from Teams.

Additional people and roles are managed through:

`Settings → Coach Hub → Teams & roles`

Administrators can control per-assignment permissions for training, friendlies, booking changes, team contacts and booking costs.

## Communications integration

Additional Coach Hub assignments are returned with the protected team-contact data and automatically included in Communications. Recipients are deduplicated by channel and destination, so the same adult is not sent the same message twice when they hold overlapping roles.

Communications refreshes protected contacts when opened, meaning newly assigned coaches do not require the whole Daxora workspace to be reloaded.

## Security

All directory and assignment changes use role-checked Supabase RPC functions. The Annual Planner entitlement remains required. Direct table access remains revoked and every directory or assignment change writes an audit event.
