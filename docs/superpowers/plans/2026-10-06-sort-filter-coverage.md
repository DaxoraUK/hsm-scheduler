# Sort/filter coverage and release record

Default: named records A–Z; teams youngest age then name; histories chronological; rankings, operational priorities and calendar geometry retain domain order. Sorting is display-only. This is not a claim of authenticated browser verification.

## Integrated accessible collections

| Area | Actual collections | Evidence |
| --- | --- | --- |
| Settings | Teams, pitches, officials, fixture sources, venues, saved matchweeks; Coach contacts and request queue; club members, invitations and support sessions | settings-sort-filter-runtime; sort-filter-coverage-runtime; workspace-security-context-runtime |
| Operations Sat/Sun/Midweek | Real shared MatchdayScheduleCard, full officials intervention queue; Assistant actions; Command priority actions and incidents | operations-sort-filter-runtime; sort-filter-coverage-runtime |
| Annual Planner | Booking register and five clickable headings; requests, offers, closures and impacts; bulk booking choices and calendar feeds; resources, waiting list, season rollovers; winter sites; training profiles/draft allocations/policy requests; pitch utilisation headings | planner-coach-communications-sort-filter-runtime; sort-filter-coverage-runtime |
| Coach Hub | Connected teams, team directory, requests, offers, alternatives, messages and calendar-feed team buttons | planner-coach-communications-sort-filter-runtime; sort-filter-coverage-runtime |
| Communications | Home matchday review queue; age/name/date sorting; existing day/readiness/search combined with new filters; original review/send IDs | planner-coach-communications-sort-filter-runtime; communications-batch-and-settings-workflow |
| Analytics | Facility usage and numeric headings, non-pitch references, source records; funding documents/snapshots/tasks/monitoring; grant opportunities and requirement matrix | analytics-report-sort-filter-runtime |
| Reports | A–Z report choices; print documents use original full scope, no controls | analytics-report-sort-filter-runtime; existing print regressions |
| League registries | Seasons, divisions, clubs, teams, venues, fixture windows, play dates and blackouts on actual routed RegistryWorkspace | league-admin-sort-filter-runtime |
| League schedules/fixtures | Actual fixture ListView and all five exception queues, preflight headings and allocation board headings; sort before existing Show more; original schedule objects | league-admin-sort-filter-runtime |
| League results | Verification/missing queues, verified result table, standings with rank default, points adjustments | league-admin-sort-filter-runtime |
| League registrations | Players, applications, transfers, rules, dispensations; club applications and eligibility request history | league-admin-sort-filter-runtime |
| League discipline | Case register, sanctions, compliance, hearings/appeals; club case register | league-admin-sort-filter-runtime |
| League finance | Invoice/charge/expense/payment/credit registers, billing templates; club invoice list | league-admin-sort-filter-runtime |
| League officials | Pool, requirement table headings, appointment board headings, availability/conflicts, postponements and workload | league-admin-sort-filter-runtime |
| League cups | Cup selector; rounds/ties retain sporting structure | league-admin-sort-filter-runtime |
| League club operations | Publications, users, invitations, change requests, communications, feeds; club portal fixture/actions/requests/messages/feeds/result choices | league-admin-sort-filter-runtime |
| League analytics/reports | Competition/club/official tables and numeric headings; report definitions and distribution lists | league-admin-sort-filter-runtime |
| League Access | All members and invitation history; original role/remove/revoke targets | league-admin-sort-filter-runtime |
| League Command | Full priority action queue with ranked default | league-admin-sort-filter-runtime |
| Daxora Admin | All authorised club pages loaded atomically through existing offset/total interface; selected-club member metadata; pilot club register | league-admin-sort-filter-runtime; sort-filter-coverage-runtime |
| Organisation | Sites, ranked action queue, funding projects and deadlines | sort-filter-coverage-runtime |

Team dropdowns in Coach request/calendar/preferences, League registration/results/schedule/officials/discipline, Settings access/Coach and Planner use the shared age comparator. Explicit configured Adult metadata overrides legacy U-names for display only; scheduler classification is untouched. Record adapters retain configured team metadata by original embedded configuration, unambiguous stable key or unique name; unknown/ambiguous keys do not silently borrow another team's age. Communications Date sort uses actual fixture dates or the authoritative selected matchday date.

## Backend-limit blockers (not complete collection filtering)

No new database or permission interface is authorised. The following histories/queues need a separately scoped paging/query change before whole-history sorting/filtering can be truthful:

| Collection | Verified current boundary |
| --- | --- |
| Communications audit / Coach delivery history | Up to 50 / 30; no supported offset/total; new partial-list toolbars removed and recent labels shown |
| Club access audit | Up to 60; selected-club support metadata is bounded separately |
| League access audit | Up to 75 |
| Admin support cases / activity | Up to 200 / 50 (activity max 100), no offset/total |
| Admin club detail audit / support sessions | Up to 25 / 20 |
| Pilot unresolved client events / evidence activity | Recent capped data, not a full event register |
| League finance billing runs / delivery events / payment imports | Up to 60 / 100 / 50 |
| League report runs / snapshots | RPC caps 80 / 72; current visible previews 40 / 12 labelled recent |
| Elite approvals / audit | RPC cap 100 each; audit preview up to 50 |
| Notifications | Existing All/Unread controls act on loaded remote window, not proof of full historical coverage |

These are remaining work, not exemptions. They prevent claiming every historical record is covered.

## Deliberate exclusions / existing domain views

- Calendars/timelines/month/day agendas: chronological geometry and existing date/team/status filters retained. Arbitrary sorting would break their meaning.
- League standings: official rank remains default; display alternatives do not recalculate ranks.
- Cup brackets/rounds/ties: sporting progression retained. Eligibility checkboxes, matchday team-sheet checkboxes and selected-record detail child rows are configuration/detail forms, not independent record registers.
- League ground map: geographic layers and ranked ground list with existing search remain domain views; map markers and selected-ground next-fixture preview are not arbitrary tables.
- Summary metrics, charts, readiness/checklist steps, grant narratives, top-six/next-eight previews and fixed configuration fields: not full record collections; underlying registers receive controls where accessible.
- Selected case documents/events/charges, invoice lines, role assignments and training-area editors remain subordinate detail views; not claimed as independently filtered histories.
- Public/privacy/marketing/sign-in pages: no operational records.
- Print-only documents: no interactive controls and no display-filter narrowing.
- FixturesPage placeholder and unused Analytics.jsx/HistoryPanel/RefManager/PitchClosuresSettingsPanel: no current consumers; do not refactor dead code.

## Verification status

Targeted runtime tests cover shared state, natural/numeric/date ordering, age buckets, missing values/ties, nonmutation, original edit indices/contact alignment, context resets, stale filters, complete Admin pagination/failure retention and print separation. Independent whole-branch review resumed and completed. All five Important findings are corrected with RED/GREEN evidence; no Critical/Minor findings reported. Upstream League filter recovery is included. Full suite 213 files / 1158 tests, TypeScript and production build passed. Code commit d6260c0 is deployed to ground-control and promoted to https://app.daxora.co.uk. Candidate and stable root/23 checked assets/configuration health passed; public/sign-in browser startup passed with no captured console errors. Fresh test/build/release results are recorded in the verification handoff. Authenticated UI access and backend-limit blockers must be reported separately from build/HTTP success.
