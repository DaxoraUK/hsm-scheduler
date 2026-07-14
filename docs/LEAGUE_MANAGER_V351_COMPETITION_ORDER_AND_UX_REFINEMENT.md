# League Operations v3.5.1 — Competition Order and UX Refinement

## Why this pass was required

League divisions created through the bulk setup import inherited the order in which each division first appeared in the CSV. A file containing clubs grouped in a mixed order could therefore produce selectors such as Premier Division, Division Two, Division Four, Division One and Division Three.

That ordering was not limited to the League Tables selector. The same workspace collection feeds Fixture Command, Schedule Builder, Results, Adjustments, Match Officials, Club Operations, calendar subscriptions, cup eligibility, blackout scopes and new-record forms.

v3.5.1 fixes the data contract rather than correcting one dropdown.

## Competition hierarchy fix

A shared League Manager ordering module now recognises common football hierarchy labels:

- Premier / Premiership;
- Championship;
- Division or Div followed by Arabic numbers, Roman numerals or number words;
- Tier and Section equivalents;
- Reserve, Development, Academy and Veterans competitions as later fallback groups.

The normalised league workspace orders divisions once before any League Manager screen receives them. Teams are then grouped by ordered division and sorted naturally by team name.

The scheduling engine uses the same comparator, so generation and preflight no longer depend on arbitrary CSV encounter order.

## Database repair

Migration `202607140005_league_division_ordering_and_v351_ux.sql`:

- adds a server-side division-name rank function;
- resequences existing division `sort_order` values by season;
- exposes a guarded administrator RPC for future bulk-import resequencing;
- records resequencing in the league audit trail;
- keeps unrecognised competition names in their existing relative order.

The setup importer calls this RPC after a successful CSV import.

## UX refinements

### Persistent navigation

League Manager now records the selected workspace and deep child destination in the URL using `lm_area` and `lm_view`. Browser back and forward navigation restores the selected League Manager area rather than always returning to Command Centre.

### Queue counts in contextual navigation

After the command picture has loaded, contextual tabs show live badges for:

- result verification and missing results;
- club change requests and publication acknowledgements;
- official gaps, replacement appointments and overdue rearrangements;
- unplaced schedule entries;
- league setup gaps.

### Role-focused command priorities

Fixture, officials and results secretaries retain the league-wide command picture, but queues relevant to their role are prioritised within each severity level and the command-centre introduction reflects their operational focus.

### Clearer fixture terminology

`Fixture registry` is renamed `Fixture records` to separate source records from Fixture Command and the Schedule Builder.

### Narrow-screen navigation

Contextual tabs now use a horizontal overflow treatment instead of wrapping into a tall, uneven block on narrower screens.

## Deferred follow-up

The remaining v3.5 refinement items are:

- shared unsaved-change protection for long forms and boards;
- league-wide command search across clubs, teams, venues, fixtures and officials;
- persistence of workspace-specific filters, not only the area and deep view.

The next major product phase remains v3.6 Compliance, Discipline and Case Management after this refinement is validated in the live league pilot.
