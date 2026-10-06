# App-wide Sort and Filter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give eligible record lists consistent sorting/filtering and clickable table headings, with age-group defaults for teams and no operational data changes.

**Architecture:** Shared pure comparators and a controlled presentation hook drive accessible toolbar/header components. Each existing screen supplies its own columns and existing filters; domain calculations, canonical arrays and permission checks remain upstream. Integrate in bounded batches, maintaining a coverage inventory.

**Tech Stack:** Existing React 19, JavaScript/JSX, Tailwind, lucide-react, Vitest/jsdom, TypeScript and Vite. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-06-app-wide-sort-filter-design.md` (approved by the user on 6 October 2026).

## Global Constraints

- "This is a presentation change, not a change to scheduling priorities or stored records."
- "Do not modify scheduler `ageOrder` or reorder source configuration arrays in place."
- "Do not infer age from pitch, format or scheduler priority."
- "Missing values sort last in either direction."
- "This change does not persist filter contents or sort choices across sessions."
- "Sorting must not change which record an action edits."
- "No fixture rebuilds or data cleanup are required to verify this feature."
- "Do not silently omit schedule fixtures because a display filter is active."
- Preserve unrelated `supabase/.temp/cli-latest`; never stage it. Synced `sources/` is read-only.
- Work on `referee-flow-staging`; no force push, rebase, unrelated refactor or database migration.

## Review Focus

1. Identical names or missing IDs: tie ordering remains stable and edit actions target original records (Tasks 1 and 3).
2. Changing club/team context with an open filter panel: choices reset and cannot expose prior-context contacts (Tasks 2 and 5).
3. Stale filter choices after refresh: selected values remain visible and zero results offer Clear filters rather than silently hiding the filter (Tasks 2 and 5).
4. Server limits or a failed later page: no incomplete collection is presented as complete (Task 7).
5. Interactive controls shared with printable reports: printed documents retain full intended scope and omit controls (Tasks 6 and 8).

## File map and verification commands

Create `src/lib/lists/listPresentation.js` (pure ordering/filtering), `src/hooks/useListPresentation.js` (display state), `src/components/lists/ListToolbar.jsx` and `SortableTableHeader.jsx` (controls). Extend `src/lib/teams/teamOrdering.js` without changing existing alphabetical exports. Screens only change display adapters and rendering.

Create `docs/superpowers/plans/2026-10-06-sort-filter-coverage.md` during Task 3. Inventory every record collection in `src/pages` and `src/components`, using columns: route/tab, collection, actual render file, default order, existing filters, paging/limits, implementation status, evidence/exemption reason. A placeholder or unused component is not proof of route coverage.

Commands below run from `work/hsm-scheduler`, using the working Node runtime:

```powershell
& 'D:/Program Files/nodejs/node.exe' node_modules/vitest/vitest.mjs run <test paths>
& 'D:/Program Files/nodejs/node.exe' node_modules/typescript/bin/tsc -b
& 'D:/Program Files/nodejs/node.exe' node_modules/vite/bin/vite.js build
```

Tests named below are new tests under `tests/regression/`. Runtime tests use the existing jsdom/React `act`/`createRoot` convention, not a new testing dependency. Run each test red before its product implementation, then green. Each task commits only its explicit intended files after verification.

### Task 1: Non-mutating ordering and filter engine

**Files:** Create `src/lib/lists/listPresentation.js`; modify `src/lib/teams/teamOrdering.js`; test `tests/regression/list-presentation.test.js`, `team-age-display-order.test.js`.

**Interfaces:** `presentList(rows, { columns, sort, filters = {}, query = '', searchText = () => '', matchesFilters = () => true, getId = row => row.id }) -> { rows, totalCount, resultCount }`. Columns are `{ key, label, type: 'text'|'number'|'date'|'team', value: row => value }`; sort is `{ key, direction: 'asc'|'desc' }`. `nextListSort(current, key) -> sort`. Teams export `getTeamDisplayAge(team) -> number|null`, `compareTeamsByAgeGroup(left,right) -> number`, `sortTeamsByAgeGroup(teams) -> array`, `sortTeamEntriesByAgeGroup(entries) -> array`.

- [ ] Write tests asserting `['Pitch 10','Pitch 2']` becomes `['Pitch 2','Pitch 10']`; numeric `[10,2,null]` becomes `[2,10,null]` ascending and `[10,2,null]` descending; ISO date ordering works; search and filters combine; input order is unchanged.
- [ ] Write age tests asserting U7, U10, U17, Adult, unknown order, alphabetical ties, and unchanged U17 classification with `format:'11v11', defaultPitch:'P1', ageOrder:11`. Read configured age metadata (`ageGroup`/`age_group`) first, then explicit U-number in `getTeamDisplayName`; recognised Adult/open-age names form a separate bucket. Duplicate labels/missing IDs retain original order as the final tie-break.
- [ ] Run both tests and confirm expected missing-export/assertion failures, not syntax failures.

Pin the shared sort contract in `list-presentation.test.js`:

```js
test('numeric descending keeps missing values last without mutating input', () => {
  const rows = [{ id: 'a', hours: 2 }, { id: 'b', hours: null }, { id: 'c', hours: 10 }];
  const result = presentList(rows, {
    columns: [{ key: 'hours', label: 'Hours', type: 'number', value: row => row.hours }],
    sort: { key: 'hours', direction: 'desc' },
  });
  expect(result.rows.map(row => row.id)).toEqual(['c', 'a', 'b']);
  expect(rows.map(row => row.id)).toEqual(['a', 'b', 'c']);
});
```

- [ ] Implement these signatures, using copy-and-sort and the existing natural English collator. Filters are screen predicates, not automatic guessing of every object property. Never feed sorted arrays back into scheduling state.
- [ ] Run both tests green; commit `feat: add safe list and team age-group display ordering`.

### Task 2: Accessible shared controls and state

**Files:** Create `src/hooks/useListPresentation.js`, `src/components/lists/ListToolbar.jsx`, `src/components/lists/SortableTableHeader.jsx`; test `tests/regression/list-controls-runtime.test.js`.

**Interfaces:** `useListPresentation({ rows, columns, defaultSort, contextKey, initialFilters = {}, emptyFilters = {}, searchText, matchesFilters, getId })` returns Task 1 counts/rows plus `sort`, `filters`, `query`, `setSort`, `toggleSort(key)`, `setFilters`, `setQuery`, `clearFilters()`, `resetView()`, `filtersOpen`, `setFiltersOpen`, `page`, `setPage`. Defaults page to zero and resets it after filter/query changes. Context changes reset the whole state. Existing externally controlled filters can use the toolbar directly rather than duplicate hook state.

`ListToolbar({ label, columns, sort, onSortChange, resultCount, totalCount, activeFilterCount, filtersOpen, onFiltersOpenChange, onClearFilters, onResetView, children, resultScopeLabel = '' })` renders labelled Sort/Filter buttons, sort selection/direction, result count, active indication, clear/reset and a filter panel supplied through children. `SortableTableHeader({ columnKey, label, sort, onSort, className })` renders a `th` with a button and `aria-sort`; callers keep action headings plain.

- [ ] Write runtime tests clicking Name twice and Hours once: `aria-sort` changes ascending/descending/ascending and displayed rows match. Sort selection and headers agree, filters combine with search, clear retains sort, reset restores defaults, counts update and empty results have a Clear action.
- [ ] Test keyboard activation, labelled controls, context resets, a stale selected filter remaining visible, and page reset after filtering.
- [ ] Run the runtime test red.

In the jsdom harness, name the toggle test `header toggles and dropdown shares state`; use columns Name/Hours and records `Zulu:2`, `Alpha:10`:

```js
await act(async () => host.querySelector('th button').click());
expect(host.querySelector('th').getAttribute('aria-sort')).toBe('ascending');
await act(async () => host.querySelector('th button').click());
expect(host.querySelector('th').getAttribute('aria-sort')).toBe('descending');
expect(host.querySelector('select[aria-label="Sort by"]').value).toBe('name');
```

- [ ] Implement the interfaces using existing visual styles/icons; responsive wrapping, visible focus, no hidden state or localStorage. Reset context-dependent selection without changing domain data. Validate unknown sort keys against declared columns.
- [ ] Run Task 1 and Task 2 tests green; commit `feat: add accessible shared sorting and filtering controls`.

### Task 3: Settings, team pickers and actual coverage inventory

**Files:** Modify `src/components/Settings/{TeamSettingsPanel,PitchSettingsPanel,RefereeSettingsPanel,CoachHubSettingsPanel,AccessSecurityPanel,IntegrationSettingsPanel,HistorySettingsPanel,VenueSettingsPanel,PitchClosuresSettingsPanel}.jsx`; create coverage file above; test `tests/regression/settings-sort-filter-runtime.test.js`.

**Interfaces:** Task 1 team comparators and Task 2 controls. Team/Pitch/Source entries remain `{ original index, record }`; do not substitute displayed indices for the existing update handlers. Existing contacts stay aligned to the original team index.

- [ ] Inventory all actual routed collections and team selectors before changes. Confirm `FixturesPage.jsx` is a placeholder, not the real fixture view. Extend the inventory to other Settings panels with record collections; exemptions must identify fixed forms, settings options or detail-only content, not merely small record counts.
- [ ] Write runtime tests for age-default teams, filter by age/day/format, pitch A–Z/site/format, officials A–Z/role, and source A–Z/enabled state. Assert sorting two identically named teams does not swap contacts and selecting/editing filtered Pitch 10 changes its original record only. Member/contact filters must not enlarge accessible data.
- [ ] Run tests red; inspect remaining team dropdown consumers with `rg` and list them in coverage.
- [ ] Integrate shared controls, preserving existing search and edit indices. Use chronological default with clickable date/count headings for saved history. Change team pickers to age-group display sorting using copied arrays; keep scheduler constants and configured priorities untouched.
- [ ] Run new tests plus existing team/pitch/contact regressions listed by the inventory; update coverage evidence and commit `feat: add sorting and filtering to settings and team selectors`.

### Task 4: Real Operations fixture and saved-schedule lists

**Files:** Modify `src/components/Operations/shared/MatchdayScheduleCard.jsx`, `src/pages/MatchdayPage.jsx`, `src/components/HistoryPanel.jsx`, `src/components/RefManager.jsx`, `src/components/Operations/shared/OfficialsIntelligenceCard.jsx`; test `tests/regression/operations-sort-filter-runtime.test.js`.

**Interfaces:** Display wrappers `{ fixture, originalIndex }` feed existing `onFixtureClick` with the original operational index. Shared list controls receive pitch/status/team/Home-Away values already prepared by the domain; all calculations still consume full `games`/`final` arrays.

- [ ] Write tests rendering Saturday/Sunday/Midweek fixtures: default team age/name list order, optional KO/pitch sorting, lifecycle/pitch filters, and correct original index on drawer open after sorting. Assert fixture count, conflict calculation inputs and allocation objects remain unchanged.
- [ ] Test saved schedule date/count headers, official assignment targeting and a zero-result message without disappearing controls. Rank-driven officials intelligence remains priority-ordered by default.
- [ ] Run tests red; integrate the single shared ScheduleCard, not three separate implementations. Retain timelines/grids in their existing order. Do not modify rebuild hooks or fixture identities.
- [ ] Run new tests and existing reversal/drawer/schedule regressions; record actual day-route coverage and commit `feat: add scoped display controls to operations lists`.

### Task 5: Planner, Coach Hub and Communications

**Files:** Modify `src/pages/{AnnualPlannerPage,CoachHubPage,CommunicationsPage}.jsx`, `src/components/planning/AnnualPlannerCompletionWorkspace.jsx`; use `src/components/coach/CoachSharedCalendar.jsx` only for filter integration, never calendar sorting; test `tests/regression/planner-coach-communications-sort-filter-runtime.test.js`.

**Interfaces:** Reuse existing day/readiness/update-type/search filter state and callbacks in Communications. Sort only display rows; selection and queue snapshots stay keyed by communication row IDs. Planner/Coach list adapters expose existing team/date/type/status fields; request and message histories keep chronological defaults.

- [ ] Write tests asserting alphabetical/age ordering of named/team lists, chronological request/message/calendar defaults, AND filtering across existing fields, count/clear/reset behaviour, and unchanged selected communication IDs after sorting.
- [ ] Test club/team switching clears prior filters and cannot show previous contacts; stale filters remain discoverable and clearable after data refresh. Assert Away/postponed/cancelled inclusion policies and review/send safeguards are unchanged.
- [ ] Run tests red; integrate toolbars in lists only and order team pickers by age. Keep existing send/acknowledge handlers, calendar event placement and bulk-action scope unchanged; do not auto-send or publish messages during verification.
- [ ] Run new and existing communications/calendar/contact runtime tests; update coverage and commit `feat: add consistent planner coach and communications list controls`.

### Task 6: Analytics, report previews and funding record lists

**Files:** Modify `src/components/analytics/{UnifiedFacilityAnalyticsDashboard,FacilityNonPitchActivity,AnalyticsVisualDashboard,FundingWorkspacePanel,FundingApplicationTracker,FundingImpactEvidencePanel,GrantImpactDashboard}.jsx`, `src/components/Analytics.jsx`, `src/pages/ReportsPage.jsx`, `src/components/reports/{ReportDocument,UnifiedFacilityReportDocument}.jsx` only where interactive previews need separation; test `tests/regression/analytics-report-sort-filter-runtime.test.js`.

**Interfaces:** Facility columns use raw `bookings`, `teamHours`, `facilityHours`, `fixtureHours`, `trainingHours`, `closureHours`, `unusedHours`, `utilisationPct` and a computed sum for Other, never formatted strings with `h`/`%`. `FacilityNonPitchActivity({ rows, interactive = true })` permits controls in analytics and `interactive={false}` in printable reports.

- [ ] Write tests clicking Facility/Hours/Use, asserting natural A–Z and numeric descending with N/A last; reuse date/site/team/activity filters and assert aggregate model totals are unchanged by display sorting.
- [ ] Test report/funding selectors sorted by title, filtered preview counts, and printed reports retaining all intended records with no interactive controls. Include empty and capacity-only data.
- [ ] Run tests red; integrate controls without changing analytics engines or CSV/print scope. Rank-driven charts retain their existing ranking; funding/project record lists receive title/status filters.
- [ ] Run new tests plus `facility-usage-capacity.test.js`; update coverage and commit `feat: add sortable analytics tables and report list filters`.

### Task 7: League and Admin collections, including result limits

**Files:** Modify `src/pages/{LeagueManagerPage,PlatformAdminPage}.jsx` and `src/components/league/{LeagueScheduleWorkspace,LeagueFixtureCommandWorkspace,LeagueOfficialsWorkspace,LeagueResultsWorkspace,LeagueRegistrationsWorkspace,LeagueDisciplineWorkspace,LeagueFinanceWorkspace,LeagueAnalyticsWorkspace,LeagueCupWorkspace,LeagueClubOperationsWorkspace,LeagueClubRegistrationsPanel,LeagueClubFinancePanel,LeagueClubDisciplinePanel}.jsx` where inventory identifies collections; test `tests/regression/league-admin-sort-filter-runtime.test.js`.

**Interfaces:** Shared columns adapt existing domain data. Keep official standing position and division hierarchy defaults. Admin's existing `platformListClubs({search,status,plan,limit,offset})` is paginated; do not present its current `limit:100` as all records. No database interface is added in this task.

- [ ] Write tests for team/club A–Z and age lists, numeric finance/result/official headers, retained standings rank and existing eligibility/access scope; existing default operational filters (such as open invoices) reset to their prior defaults, while Clear filters clears optional narrowing.
- [ ] Test multiple Admin club pages, server search/status/plan changes, and a failed later fetch: last successful results remain available with an explicit error/incomplete indicator, never a misleading complete count.
- [ ] Before product changes, verify response metadata and supported paging/filter contracts for every remote-limited collection in coverage. Load all authorised pages through existing interfaces before collection-wide client sorting. Cancel stale context requests and commit results atomically. For APIs without pagination or necessary filters, document the exact limitation and pause that integration for a separately approved interface change; do not silently claim complete app-wide coverage.
- [ ] Run tests red; integrate controls with existing league filters. Leave standings calculation, finances, eligibility, official assignment and Admin authorisation routines untouched. Do not create real invoices/invitations/access grants as test data.
- [ ] Run new tests and existing league/Admin regressions; update coverage and commit `feat: add league and admin record sorting and filters` only for verified complete integrations.

### Task 8: Whole-program coverage, review and release verification

**Files:** Finalize coverage document; modify `src/pages/{DashboardPage,EliteCommandCentrePage,OperationsCentrePage}.jsx` and any remaining inventory-listed display files only for eligible record collections; test `tests/regression/sort-filter-coverage-runtime.test.js`.

**Interfaces:** Tasks 1–7 shared presentation contracts. No separate sort/filter implementation for a leftover screen. Priority alerts retain their ranked defaults.

- [ ] Write failing coverage runtime tests for remaining routed lists. Audit every table header: data columns sortable or explicitly exempt; action columns plain. Audit every named list and team picker, including hidden tabs/mobile views. Keep public pages/detail forms/calendars/print-only tables explicitly exempt.
- [ ] Run red, implement remaining display integrations and update coverage with evidence; unresolved backend limits remain blockers, not exemptions invented to call the request complete.
- [ ] Run all new targeted tests, then the full regression suite once, TypeScript check and production build. Require exit zero for each; report existing warnings separately. Check `git diff --check` and intended-file status, preserving the unrelated temp file.
- [ ] Browser-test real routed Settings, Operations, Planner/Coach, Communications, analytics sortable tables and League/Admin where access permits. Verify keyboard headings, ascending/descending arrows, mobile filter layout, clear/counts, unchanged edit targets and print scope. Do not claim authenticated coverage for pages blocked by sign-in; request access or label unverified.
- [ ] Obtain an independent whole-branch code review through the applicable review skill, resolve important findings and rerun affected checks. Commit verified final coverage/integrations.
- [ ] Follow Vercel release skills for the confirmed `ground-control` project: build complete output, verify candidate root/referenced JS/CSS and startup before promotion, then verify stable `https://app.daxora.co.uk`. No database writes or fixture rebuilds. If a release gate fails, do not promote or claim deployment success.
- [ ] Return implemented modules, intentional exceptions, tests/build/browser results, commit/deployed URL and any unresolved limits. Complete only when coverage is satisfied or clearly report remaining work.

## Execution handoff

Recommend **Native** execution: one implementer in this session can reuse the shared interfaces across the dependent batches, avoiding a fresh implementation context for each screen. Follow the executing-plans skill after the user approves this written plan and selects execution; include one independent whole-branch review at the end. No product code has changed while writing this plan.
