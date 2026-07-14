# League Operations v3.5 — Command Centre and UX Review

## Phase decision

The highest-priority next phase after v3.4.1 is operational consolidation, not another isolated feature module.

League Manager already contains fixture scheduling, venue controls, publication, club access, communications, calendar feeds, Full-Time reconciliation, results, tables, deductions, exceptional outcomes, cup progression, officials and rearrangements. The main risk was that these capabilities were spread across eleven equally weighted top-level buttons with no single view showing what a league operator needed to do next.

v3.5 therefore introduces an action-first operational command centre and simplifies the information architecture before further expansion.

## What v3.5 changes

### 1. Action-first command centre

The previous pilot-readiness overview has been replaced by a live command picture that combines:

- overdue postponement and rearrangement deadlines;
- results awaiting league verification;
- played fixtures with no recorded result;
- club fixture-change requests;
- declined appointments and replacement requirements;
- referee and assistant gaps inside the next 35 days;
- clubs awaiting publication acknowledgement;
- unplaced schedule entries;
- mandatory league setup gaps;
- missing active fixture publication.

Critical work is shown before review work. Every queue links directly to the relevant child workspace rather than dropping the operator at a generic page.

### 2. Simplified navigation

Eleven flat top-level buttons are consolidated into five areas:

1. **Command** — operational command centre.
2. **Fixtures** — Fixture Command, Schedule builder, Fixture registry, venues and availability, match officials.
3. **Competitions** — results and tables, cups.
4. **Clubs** — publication, club access, change requests, communications, calendar feeds and Full-Time fixture reconciliation.
5. **Administration** — league structure, access and audit.

Secondary navigation appears only for the selected area. This reduces visual noise while preserving every v3.4 capability.

### 3. Deep workspace hand-offs

The command centre can open a specific child view, including:

- Results → Result command;
- Clubs → Change requests;
- Clubs → Publication;
- Match officials → Appointments;
- Match officials → Postponements;
- Fixture Command → Fixture list.

A navigation token ensures that repeated clicks on the same queue still reset the destination workspace to the correct child view.

### 4. Clearer Full-Time labels

The two different reconciliation jobs are now explicitly separated:

- **Full-Time fixtures** under Club Operations;
- **Full-Time results** under Results and Tables.

This removes a duplicated “Full-Time” label that previously depended on the user remembering which parent workspace they were in.

### 5. Data-contract protection

The command centre now normalises schedule-version rows and entries returned directly from Supabase before building the operational view. This protects the UI from losing dates, teams or venues when database payloads use snake_case.

Unplaced counts are taken from the selected schedule version when one exists, rather than relying only on the base fixture registry.

## Full UX review findings

### Resolved in v3.5

| Area | Previous issue | v3.5 resolution |
|---|---|---|
| Orientation | The landing view described a pilot outcome rather than current operational work. | Replaced with live priority queues and current status. |
| Navigation | Eleven equal top-level choices created scanning and scrolling overhead. | Grouped into five operational areas with contextual sub-navigation. |
| Workflow continuity | Operators had to remember where each issue was managed. | Queue items deep-link to the relevant child view. |
| Terminology | Two separate tabs were both called Full-Time. | Renamed to Full-Time fixtures and Full-Time results. |
| Status language | Readiness percentage dominated even when urgent queues existed. | Critical and review-level operational work now controls the headline state. |
| Data reliability | Raw schedule payload casing could produce an empty operational window. | Schedule payloads are normalised and regression-tested. |
| Fixture truth | Unplaced totals could diverge from the selected schedule version. | Command totals use current schedule entries first. |

### Priority follow-up — v3.5.1

These are refinement tasks, not blockers for the v3.5 deployment:

1. **Persist navigation in the URL.** A browser refresh currently returns to the default command-centre route rather than preserving area, child view and filters.
2. **Add queue counts to contextual tabs.** Change requests, appointments, postponements and result command should show small badges without forcing the user back to Command.
3. **Separate source records from operational records more explicitly.** “Fixture registry” should become “Source fixtures” or “Fixture records” to distinguish it from Fixture Command and Schedule builder.
4. **Standardise unsaved-change protection.** Long forms and appointment boards should share one dirty-state warning and one save pattern.
5. **Add league-wide search.** Clubs, teams, venues, fixtures and officials should be searchable from one command palette.
6. **Improve small-screen navigation.** The five areas are manageable, but secondary tabs need an accessible compact overflow treatment on narrower devices.
7. **Add role-specific command views.** Fixture, officials and results secretaries should see their own queues first while retaining the league-wide picture.

### Next product phase after UX stabilisation — v3.6

The next major phase should be **League Compliance, Discipline and Case Management**:

- discipline and suspension register;
- player/team eligibility and registration exceptions;
- abandoned-match and misconduct case workflow;
- document and evidence attachments;
- hearing/decision deadlines;
- fines, sanctions and appeal status;
- automatic fixture/official/result impact warnings;
- club-facing case notices with acknowledgement;
- complete audit trail and exports.

This should follow v3.5 pilot feedback rather than being added before operators have validated the consolidated command workflow.

## Verification

The v3.5 implementation is covered by a dedicated regression suite that verifies:

- critical queue prioritisation;
- results, postponement, request, acknowledgement, official and setup counts;
- unplaced entries from the active schedule version;
- raw Supabase schedule-row normalisation;
- upcoming fixture rendering;
- five-area navigation;
- deep child-workspace hand-offs.

The complete repository check passes: lint, 442 regression tests, TypeScript/Vite production build and release evidence.
