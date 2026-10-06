# App-wide sorting and filtering

Date: 6 October 2026
Branch: referee-flow-staging
Status: written design approved on 6 October 2026; implementation plan awaiting review

## Outcome

Make record lists easier to find, compare and use throughout Ground Control, Coach Hub, Annual Planner, League Manager and Daxora Admin. Provide consistent Sort and Filter controls and clickable table headings. This is a presentation change, not a change to scheduling priorities or stored records.

The user approved alphabetical defaults, teams ordered by age group, meaningful ordering retained for chronological/ranked views, and clickable column headings.

## Approach

Use a small shared presentation layer for comparators, controlled list state, Sort/Filter controls and sortable headings. Integrate it with existing lists and filters rather than replace their data access or domain logic.

Alternatives considered:

- Independent page implementations: smaller initial edits but inconsistent behaviour and repeated accessibility/testing work.
- Replace every table with a new table framework: unnecessary dependency and migration risk for this request.

The shared approach is recommended. It does not require a database migration, new preference storage or a new scheduling implementation.

## Sorting rules

- Named record lists default to A–Z, using case-insensitive English natural sorting (Pitch 2 before Pitch 10).
- Teams default to youngest youth age group first, then A–Z within the group. Adult/open-age teams follow youth; unknown-age teams come last. Extract actual age from configured age-group metadata, falling back to an explicit U-number in the team name. Do not infer age from pitch, format or scheduler priority.
- Keep the existing alphabetical comparator available; add a separate age-group display comparator. Do not modify scheduler `ageOrder` or reorder source configuration arrays in place.
- Numeric, date and text columns use their corresponding comparison type. Missing values sort last in either direction. Equal values retain deterministic ordering using a stable record identifier where available, otherwise original order.
- Calendars, timelines, conversations and activity histories retain chronological order. League standings retain official rank; division hierarchy and operational priority queues retain their meaningful defaults. Alternative sorting belongs in their record-list views, not the timeline or ranking calculation.
- Initial view state uses these defaults. This change does not persist filter contents or sort choices across sessions.

## Controls and table headings

- Place compact, consistently styled Sort and Filter controls beside the existing list search or toolbar. Reuse existing filters rather than duplicate them.
- A sortable heading contains a real button. First activation sorts ascending; another activation on that column toggles descending. Selecting a different column starts ascending. Show an arrow on the active column and expose `aria-sort` on the heading.
- The Sort control and headings share the same state. Action columns and headings without a meaningful comparison remain non-sortable.
- Keyboard and touch interaction must work; filter panels fit small screens and have labelled fields.
- Filters combine with existing search using AND. Provide a visible result count, active-filter indication, and Clear filters action; clearing filters retains the selected sort. Reset view restores filters and default sorting.
- Show a helpful empty-results state with Clear filters. Changing filters resets pagination to the first page.
- Filtering must cover the accessible collection, not just the first loaded page. Server-paginated screens reuse supported query parameters and sorting. Any new backend interface needed must be identified before implementation, not silently replaced with first-page filtering.

## Coverage

Every eligible record collection receives controls; detail forms, marketing/public pages, summary cards and fixed schedule grids do not receive decorative controls that cannot act on a collection.

| Area | Eligible collections and filters |
| --- | --- |
| Settings | Teams, pitches, officials, adult contacts, members/invitations and fixture sources. Use available age, format, role, status, team and site fields. Team pickers elsewhere use the same age-group default. |
| Fixtures and Operations | Fixture lists, allocation/intervention lists and saved schedules. Use existing date/day, team, lifecycle, pitch and Home/Away fields. Saturday/Sunday/Midweek use shared components. Timeline geometry and allocation order remain unchanged. |
| Annual Planner and Coach Hub | Booking/request lists, assignments and contact/access lists. Use existing team, date, activity and status fields. Calendar events remain chronological. |
| Communications | Coach message/review and delivery-history lists. Reuse day, readiness, team, channel and status filters. Conversation threads remain chronological. |
| Analytics and Reports | Facility/team usage tables, report lists and other tabular breakdowns. Sort displayed text/numbers correctly; reuse date, team, site and activity filters. Totals continue to follow the existing report scope. |
| League Manager | Team/club, fixture, registration, result, discipline and finance record lists. Reuse their domain filters; retain official standings rank and division hierarchy. |
| Daxora Admin | Organisation, user and operational record tables. Reuse authorised status/product/role filters without exposing additional records. |
| Dashboard and Command views | Sort/filter actionable record lists where present; retain risk/priority ordering as the default for ranked alerts. Summary metrics themselves are not sortable lists. |

Implementation must inventory actual collections in these areas and record each as integrated, already compliant, or intentionally exempt with a reason. Do not claim whole-program coverage from a few example pages.

## Safety and data flow

Apply presentation sorting/filtering after existing access scoping and data preparation. Preserve stable IDs and original configuration indices used by edit actions, selected teams and aligned contact records. Sorting must not change which record an action edits.

Do not change fixture identity, rebuild logic, allocations, capacity calculations, canonical Home/Away state, permissions or contact privacy boundaries. No fixture rebuilds or data cleanup are required to verify this feature.

Existing export/print scope stays unchanged unless the view already exports filtered results. Do not silently omit schedule fixtures because a display filter is active. Controls must not change aggregate totals or official ranks inadvertently.

Unsupported or failed server-side queries show clear feedback and retain the last successful results; never fall back to misleading partial results.

## Verification and completion

Use failing tests first for shared ordering/filter behaviour and integrations. Cover:

- Natural A–Z, numeric/date comparisons, missing values and deterministic ties.
- U7/U10/U17 ordering, alphabetical ties, adult and unknown-age placement; no age inference from 11v11/P1 or scheduling priority.
- Source arrays remain unchanged; editing a sorted team/pitch/contact still targets the correct record.
- Header ascending/descending toggles, accessible state, and synchronization with Sort controls.
- Combined filters/search, clearing/resetting, counts, empty states and pagination scope.
- Representative integrations across every area in the coverage inventory; existing domain defaults and access restrictions remain intact.

Integrate in manageable batches: shared layer and Settings/Fixtures; Operations/Planner/Coach Hub/Communications; Analytics/Reports/League/Admin. Complete all approved coverage before calling the request finished.

Run targeted integration tests during each batch, then TypeScript and production build. Because this is app-wide presentation infrastructure, run the full regression suite once at completion. Browser-check representative desktop and mobile layouts and record any authenticated views that cannot be verified. Deployment follows existing release checks and the user's confirmed Ground Control destination; no unrelated database or access-control changes are authorised by this design.

## Review gate

After written-design approval, prepare the implementation plan and obtain approval of that plan and execution method. No product code has been changed at this design stage.
