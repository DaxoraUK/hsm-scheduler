# Ground Control v3.10.8.1

## Scheduling rule scope, time choices and season mode persistence

This follow-up release repairs the first Smart Allocation master-rule workflow after the v3.10.8 pilot review.

## Problems corrected

- The Applies to field did not provide a dependable target-selection workflow.
- Preferred start times were entered as free text and could contain invalid or inconsistent values.
- Coach preferences used the same free-text pattern.
- Manual, Assisted and Automatic Draft mode was held only in component state and could revert after refresh.
- The master-rule form did not clearly show whether changes had actually been saved.

## Delivered behaviour

### Rule targeting

Master rules can target:

- all teams;
- a team type;
- an age group;
- a specific team.

The Applies to options are generated from the club's current team register. Specific-team rules have the highest inheritance priority.

### Half-hour preferred times

Master rules, operator team profiles and Coach Hub preferences use one shared selectable time component.

Options:

- advance in 30-minute intervals;
- start no earlier than the rule's earliest start;
- allow the full selected session duration to finish before the latest finish;
- are validated again in Supabase.

### Season scheduling mode

The club default rule for each season now stores one of:

- Manual;
- Assisted;
- Automatic Draft.

The Smart Allocation header reloads the saved value for the selected season. Unsaved mode changes are clearly identified and are committed through the Club default master rule.

### Save state

The master-rule panel now shows:

- unsaved changes;
- saving progress;
- successful save verification;
- failed-save status.

## Security and data integrity

The migration keeps club administration as the only authority for saving master rules. Coach submissions remain limited to active Coach Hub team assignments and are validated against the resolved club, team-type, age-group or specific-team rule.

## Migration

`202607170008_scheduling_rule_scope_time_mode_persistence.sql`
