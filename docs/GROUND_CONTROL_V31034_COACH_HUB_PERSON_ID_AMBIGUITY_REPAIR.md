# Ground Control v3.10.3.4 — Coach Hub person ID ambiguity repair

## Fault

After Coach Hub invitation recovery completed, workspace loading failed with:

```text
person_id is ambiguous
```

Several Coach Hub PostgreSQL functions declared a local variable called `person_id` while querying tables that also expose a `person_id` column. PostgreSQL refused to guess which value the function intended.

## Repair

The local value is now named `coach_person_id`, with table columns kept explicit.

The repair covers:

- Coach Hub workspace loading
- Training, friendly, change and cancellation requests
- Alternative-slot responses
- Coach profile updates
- Contact verification
- Personal calendar feeds
- Team calendar feeds

Existing team restrictions, Annual Planner entitlement checks, self-service audit controls and pgcrypto protection remain in place.

## Migration

```text
202607160008_coach_hub_person_id_ambiguity_repair.sql
```

No new invitation or data reset is required.
