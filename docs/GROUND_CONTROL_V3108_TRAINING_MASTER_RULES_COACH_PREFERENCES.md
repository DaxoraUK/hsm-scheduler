# Ground Control v3.10.8 - Training master rules and coach preferences

## Purpose

Ground Control v3.10.8 places club scheduling policy above team and coach preferences. It gives administrators safe seasonal defaults while allowing coaches to explain what works for their assigned teams.

The release extends the Annual Planner smart allocation work delivered in v3.10.7. It does not allow coaches to publish bookings or bypass club restrictions.

## Master scheduling rules

Administrators can create rules for:

- the whole club;
- a team type, such as youth or adult;
- an age group, such as U14;
- pre-season, regular-season or winter planning.

Each rule controls:

- permitted training days;
- whether Saturday or Sunday training is allowed;
- earliest start and latest finish;
- default preferred start times;
- default session duration;
- minimum pitch-area requirement;
- sessions per week;
- permitted club pitches;
- permitted winter sites;
- coach editing policy;
- an internal explanation note.

Built-in rules permit Monday-Friday and disable weekend training. A team remains unassigned when no valid weekday slot exists rather than being placed on a weekend because spare capacity is available.

## Coach Hub training preferences

Coaches receive a Training preferences workspace for teams to which they have an active Coach Hub assignment.

Within the applicable master rule, a coach can set:

- preferred and unavailable days;
- ranked preferred start times;
- preferred session duration;
- preferred space requirement;
- preferred club pitches;
- preferred winter sites;
- operational notes.

The interface identifies inherited days, times, space rules and coach-edit policy. Prohibited days and facilities remain unavailable.

## Club control modes

Administrators choose one coach-edit policy:

1. **Approval required** - a coach submission enters the Annual Planner review queue.
2. **Apply immediately** - a valid submission updates the team profile without a separate approval step.
3. **Club managed only** - coaches can view inherited rules but cannot submit changes.

Approval required is the default.

## Review and audit

Pending proposals appear in the Smart allocation workspace. Administrators can approve or reject each proposal.

Approval updates the team scheduling profile used by the allocation engine. Rejection preserves the proposal and decision. Both decisions create audit records and a Coach Hub message for the coach.

## Smart allocation integration

The allocation engine resolves the applicable club, team-type and age-group policy before it scores candidates. It excludes:

- blocked weekdays and weekends;
- starts or finishes outside the permitted time window;
- club pitches outside the permitted set;
- winter sites outside the permitted set;
- pitch areas that do not satisfy the minimum-space rule.

Recommendation explanations state the policy source. The engine leaves a team unassigned when all candidates violate the rule.

## Security

- Policies and proposals are club scoped.
- Coaches can submit only for active team assignments.
- Coach submissions are revalidated in Supabase.
- Club-managed rules require owner/admin authority.
- Proposal approval or rejection requires club-management authority.
- Security-definer functions use an empty search path and explicitly qualified relations/functions.
- Team keys retain their stored identity rather than being silently changed during coach submission.

## Database migration

`202607170007_training_master_rules_and_coach_preferences.sql`

The migration adds:

- `annual_planner_scheduling_policies`;
- `annual_planner_coach_preference_proposals`;
- inheritance metadata on `annual_planner_team_preferences`;
- secured scheduling-policy and coach-preference RPCs;
- weekday-only starter policies for existing clubs.

## Package position

The functionality remains part of the Annual Pitch Booking, Training and Friendlies Planner bolt-on and is included in Elite. It does not move into standard Core functionality.
