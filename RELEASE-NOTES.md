# Daxora Ground Control v3.10.41 - Multi-Role Access Architecture

## v3.10.41 - Multi-Role Access Architecture

Introduces the club multi-role access foundation without replacing the existing primary membership role model.

### Delivered

- Multiple functional roles per club member.
- Explicit club/team/site scope on additional roles.
- Access & Security role assignment and removal.
- Effective client permission calculation across applicable roles.
- Role-aware Coach Hub compatibility.
- Supabase role assignment/listing RPCs with the real composite membership key.
- Dashboard/Club Command roadmap dependency recorded.

### Deliberately deferred

- Package-aware navigation.
- Authoritative team/site role picker UI.
- Migration of every privileged RPC to capability-based authorization.
- Full dashboard redesign.
- Full-Time FA integration repair.

## Acceptance

- Existing primary roles continue to work.
- Additional roles can be assigned and revoked.
- Scoped roles only contribute when their scope matches the active context.
- No role assignment bypasses subscription entitlement.
- Migration targets `club_memberships(club_id, user_id)` correctly.
