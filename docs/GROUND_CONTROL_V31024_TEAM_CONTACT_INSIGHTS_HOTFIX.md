# Ground Control v3.10.2.4

## Team Contact Synchronisation and Annual Planner Insights Recovery

This hotfix addresses two pilot faults found after the multi-team Coach Hub rollout.

## Team contact synchronisation

A primary role created in **Settings → Coach Hub → Teams & roles** was stored correctly, but **Settings → Teams** only displayed the older Team-form contact fields. This produced a false “No contact details added” state.

The Teams panel now:

- Recognises active Coach Hub team assignments.
- Prefers an explicitly primary assignment.
- Falls back to manager, lead-coach or coach roles where required.
- Displays the assigned adult’s name, email, mobile and preferred channel.
- Labels the record as **Coach Hub** so its source is clear.
- Keeps Coach Hub as the authoritative place for the assigned person and role.
- Allows optional assistant details to remain managed through the Team form.
- Refreshes shared team contacts immediately when Coach Hub data changes.

This does not create a duplicate person record or a second communications directory.

## Annual Planner Insights recovery

The Insights component received a `metricsUnavailable` property but did not declare it in the component parameters. Opening the tab therefore caused a JavaScript `ReferenceError` and activated the global Daxora recovery screen.

The hotfix:

- Declares the availability flag with a safe default.
- Normalises pitch-utilisation rows before rendering.
- Adds a section-level Daxora recovery boundary around Insights.
- Keeps Calendar, Bookings, Requests and Availability operational if Insights encounters a future rendering fault.
- Provides a controlled retry action instead of collapsing the entire workspace.

## Database

No Supabase migration is required. This release depends on migration `202607160003` from v3.10.2.3.
