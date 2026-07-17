# Annual Planner, Shared Calendar and Coach Requests roadmap

**Roadmap status:** Active
**Current implementation release:** Ground Control v3.10.9
**Roadmap baseline release:** v3.10.5.4
**Primary product area:** Annual Pitch Booking, Training and Friendlies Planner
**Related areas:** Coach Hub, Settings > Pitches, club-wide Analytics, Reports, Communications and calendar feeds

---

## 1. Purpose

This module gives a club one operational plan for training, friendlies, seasonal facilities, coach requests, pitch capacity, closures and shared calendars across the full year.

It must cover:

- pre-season training and friendlies;
- regular in-season training;
- winter training at separate internal or external sites;
- recurring and one-off bookings;
- whole-pitch and subdivided-pitch use;
- coach-led requests and club approval;
- blackout dates, maintenance and pitch closures;
- weather postponement, cancellation and rearrangement;
- operational insights and grant-quality facility evidence.

The module must support small clubs that allocate everything manually and large clubs that need assisted or automatic scheduling.

---

## 2. Module boundaries

### Included

- Annual Planner calendar, requests, bookings, closures and Insights.
- Coach-facing shared calendar and request workflow.
- Training capacity, named pitch areas and seasonal venue inventories.
- Training/friendly approval, alternatives and request conversations.
- Weather and closure impact on approved sessions.
- Smart summer and winter allocation.
- Operational and strategic analytics generated from planner data.
- Calendar-feed representation of relevant bookings and restrictions.

### Connected but governed by separate future roadmaps

- Coach directory, invitations, account activation and identity management.
- Matchday fixture scheduling and referee allocation.
- League Manager competition scheduling.
- Communications delivery channels and campaign management.
- Funding application workflow.
- Main Analytics and Reports information architecture.

This roadmap defines the integration contract with those areas without replacing their own roadmaps.

---

## 3. Current implementation through v3.10.8.1

### Shared calendar

- Coach Hub and Annual Planner can display shared bookings, requests, blackouts and pitch closures.
- Calendar and agenda views are available.
- Team, request and closure filters are available.
- Calendar colours use a shared status map.
- Event identity includes booking, team, pitch, area and start time so concurrent area bookings do not overwrite each other.
- Calendar and request conversations support silent background refresh.
- Annual Planner request refresh updates the request queue rather than replacing the entire page.
- A visible manual refresh action remains available.

### Coach requests

- Coaches can submit training and friendly requests for assigned teams.
- Submitted and needs-information requests can be edited.
- Requests can be created from a calendar date.
- The request journey uses a guided multi-stage form.
- Pitches are selected from saved club settings rather than entered as arbitrary text.
- Acceptable alternatives, flexibility and recurring-request information can be recorded.
- Validation errors are shown in the request interface rather than failing silently.
- Availability checking, submission and approval use aligned pitch-area rules.
- Request conversations refresh silently and preserve the current scroll position.

### Pitch capacity and areas

- A pitch can define simultaneous training-team capacity.
- Named areas such as Half A and Half B can be configured.
- Separate named areas can host simultaneous training bookings.
- Duplicate use of the same area is blocked.
- A third overlapping booking is blocked where capacity is two.
- Friendlies and fixtures remain exclusive under the current rules.
- Pitch-area names accept spaces and legacy area objects are normalised for display.

### Closure and blackout visibility

- Shared blackout dates and pitch closures are represented in relevant coach and operator calendars.
- Coach-facing and private operator notes can be separated.
- Approved bookings affected by a later closure can be identified for operator attention.

### Access and data integrity

- Coach requests operate through team-scoped Coach Hub access.
- Database checks protect final submission and approval rather than relying only on browser validation.
- Club isolation and active-club access remain mandatory.

### v3.10.6 implementation delivered

- Split pitches expose an explicit **Full Pitch** allocation alongside every configured named area.
- Full Pitch blocks all overlapping named areas; any active named-area booking blocks Full Pitch.
- Friendlies default to Full Pitch and receive resource-specific availability wording.
- Operators can approve a request while changing its pitch, area, date, time or fixed winter slot.
- Weather actions support postponement, cancellation and linked rearrangement while preserving the original booking.
- Winter sites and fixed weekly slots are first-class seasonal inventory with dates, capacity, surface, floodlights, costs, access notes and restrictions.
- Annual Planner Insights and the main Analytics page use the same shared planner analytics model.
- Weather-lost hours, winter hours and external facility costs are available as grant-evidence measures.

### v3.10.7 implementation delivered

- A dedicated Smart allocation workspace supports Manual, Assisted and Automatic Draft season runs.
- Per-team scheduling profiles can inherit the season-run mode or override it.
- Team preferences include preferred and unavailable days, start times, pitch/site choices, duration, minimum area, priority, current-allocation protection and manual-only control.
- Summer/pre-season, regular-season and winter inventories are allocated separately.
- The engine scores usual slots, historic allocations, age-group timing, pitch format, named-area efficiency, winter costs and team priority.
- All active Coach Hub people assigned to a team are considered, preventing clashes where any coach is shared across teams.
- Drafts include confidence, reasons, warnings, alternative slots, locks and unassigned teams.
- Automatic allocation remains an unpublished draft until an authorised operator publishes it.
- Publication creates recurring confirmed bookings only after final database conflict validation.
- Manual-only or unassigned teams block publication rather than being silently omitted.
- Smart-run activity and allocation scores feed the shared Annual Planner and main Analytics model.

### v3.10.8 implementation delivered

- Club administrators can define master training rules separately for pre-season, regular-season and winter planning.
- Built-in defaults permit Monday to Friday and disable Saturday and Sunday training unless a club explicitly enables weekends.
- Rules can be targeted at the whole club, a team type or an age group.
- Master controls cover permitted days, time windows, preferred starts, duration, pitch area, sessions per week, permitted club pitches, permitted winter sites and coach-edit policy.
- Team profiles inherit the applicable master rule before operator preferences are applied.
- The smart allocator excludes resources, days and times blocked by the resolved master rule and explains the policy source used.
- Coach Hub includes a Training preferences workspace for every assigned team.
- Coaches can rank days and times, record unavailable days, select preferred club pitches or winter sites, choose session duration and area preference, and add operational notes.
- Coaches cannot enable weekends, prohibited facilities or times outside the club window.
- Clubs can choose approval-required, immediate-valid-update or club-managed-only coach editing.
- Approval-required changes enter an Annual Planner review queue; approval updates the team profile and rejection notifies the coach.
- Policy saves, coach proposals and review decisions are club scoped and audited.

### v3.10.8.1 scheduling-rule UX and persistence delivered

- The Applies to selector now supports All teams, team type, age group and a specific team.
- Specific-team rules sit above age-group and team-type defaults in the inheritance hierarchy.
- Preferred start times are selected from 30-minute options rather than entered as free text.
- Available start choices respect the earliest start, latest finish and selected session duration.
- The same half-hour selector is used for master rules, operator team profiles and Coach Hub preferences.
- Manual, Assisted and Automatic Draft mode is saved against the club default for each season.
- The Smart Allocation header reloads the saved season mode and clearly marks unsaved changes.
- Master-rule saves show saved, unsaved and failure states and are verified after workspace reload.
- Supabase validates rule scope, half-hour intervals, time-window completion and season mode.

### v3.10.9 closure recovery and Coach alternatives delivered

- Every closure impact can be reviewed in a dedicated operator resolution dialog.
- Operators can relocate immediately, offer an alternative, postpone, cancel or acknowledge an affected booking.
- Proposed alternatives retain the original allocation and do not change the shared calendar until the coach accepts.
- Coach Hub shows the original and proposed slot side by side with Accept and Decline actions.
- Acceptance rechecks pitch, area or winter-slot capacity transactionally before updating the booking.
- Declining returns the impact to the operator action queue instead of losing the workflow.
- In-app Coach Hub messages and the existing email reminder worker receive closure, alternative, relocation, postponement and cancellation notifications.
- Public coach messages remain separate from internal operator notes.
- Closure resolution status, relocation, postponement, cancellation and response rates feed the shared Annual Planner and main Analytics model.

### Remaining limitations after v3.10.9

- Automatic alternative expiry and waiting-list promotion are not yet implemented.
- Bulk relocation of several affected bookings still requires a dedicated workflow.
- Weather reinstatement and completed-after-rearrangement reporting need a final lifecycle pass.
- Winter-site provider contacts, accessibility, travel and cancellation automation require a deeper inventory phase.
- Capacity utilisation, unmet demand, preferred-slot success and cost-per-delivered-hour need further analytical modelling beyond the current measures.
- Week/day calendar views and external Google, Apple and Outlook calendar-feed polish remain later UX work.

---

## 4. Product principles

1. **One source of truth.** Availability, submission, approval, calendar display and analytics must use the same booking and capacity rules.
2. **No silent movement.** Automatic or administrative changes must never move a team without a visible draft, decision, notification and audit record.
3. **Manual control remains valid.** Automation must assist clubs, not force a particular operating model.
4. **Seasonal inventories stay separate.** Summer grass pitches and winter external sites must not accidentally share availability or capacity rules.
5. **Explain every decision.** Recommendations and conflicts must state why a slot is suitable or unavailable.
6. **Preserve history.** Postponed, cancelled and replaced sessions remain reportable; they are not deleted from the operational record.
7. **Analytics are transactional outputs.** Grant evidence must be produced from real bookings, changes and outcomes rather than manually re-entered totals.
8. **Mobile-first for coaches.** Requesting, responding, checking calendars and reading messages must work comfortably on a phone.

---

## 5. Implementation phase delivered in v3.10.6

### 5.1 Full-pitch resource semantics - delivered

Every subdivided pitch must support an explicit hierarchy:

- Full Pitch
- Half A
- Half B
- Other configured areas where relevant

Rules:

- A Full Pitch booking consumes the entire pitch for the overlapping period.
- Full Pitch blocks every named area.
- Any active area booking makes Full Pitch unavailable for that overlapping period.
- Different named areas may coexist when pitch capacity and area rules permit.
- A duplicate area booking is blocked.
- A booking without an area cannot bypass the hierarchy.
- Friendlies and fixtures default to Full Pitch.
- Training may request Full Pitch or a named area.
- Operator overrides require a reason and audit entry; unsafe capacity overrides should remain prohibited.

Availability wording must be selected-resource aware:

- `Full pitch available`
- `Full pitch unavailable — Half A is already booked`
- `Half B available — one of two training areas remains`
- `Pitch unavailable — full pitch booking already exists`

A friendly request for Full Pitch must never report remaining training-area capacity as though it were relevant availability.

### 5.2 Operator approval workspace - foundation delivered

The operator review should show the request and relevant calendar capacity together.

Actions:

- Approve as requested.
- Change pitch, site or area before approval.
- Offer another date or time.
- Offer a saved alternative pitch/area.
- Ask for more information.
- Reject with a required reason.
- Cancel or amend a previously approved booking.

Alternative offers must show the original request and proposed alternative side by side. Coaches can accept, decline or message the club. Final approval must recheck capacity transactionally to protect against two operators approving conflicting requests at the same time.

### 5.3 Weather disruption lifecycle - foundation delivered

Approved training sessions and friendlies must support:

- postponed due to weather;
- cancelled due to weather;
- moved to another pitch or site;
- moved to another date/time;
- awaiting rearrangement;
- rearranged;
- reinstated;
- completed after rearrangement.

Each weather action records:

- original booking and slot;
- affected pitch/site and area;
- disruption category and reason;
- decision timestamp and operator;
- public coach message and optional internal note;
- replacement booking where created;
- notification result;
- audit timeline.

The original event must remain visible in history and analytics. Rearrangement should link the original and replacement rather than creating an unrelated booking.

### 5.4 Winter-site inventory and fixed slots - foundation delivered

Winter training must be a separate seasonal resource inventory.

Each site should support:

- venue name and address;
- internal or external provider;
- available start and end dates;
- pitch, court, hall or training-area resources;
- fixed bookable slots and slot duration;
- full-resource and subdivided-resource rules;
- simultaneous capacity;
- surface and floodlight information;
- age, format and footwear restrictions;
- access, parking and keyholder notes;
- accessibility information;
- cost per slot and cancellation terms;
- recurring allocations;
- provider contact and reference information.

Planner views and allocation runs must distinguish:

- pre-season;
- regular season;
- winter training;
- friendlies;
- all-year overview.

Availability and capacity from one seasonal inventory must not leak into another.

### 5.5 Shared analytics data foundation - delivered

Introduce a common analytics contract for planner activity, used by both Annual Planner Insights and the main Analytics page.

Initial measures:

- hours requested, approved, scheduled and delivered;
- full-pitch and area hours;
- capacity utilisation;
- unmet demand;
- weather-lost hours;
- sessions rearranged, reinstated and permanently cancelled;
- closure downtime;
- winter external-site hours and cost;
- approval turnaround;
- preferred-slot success;
- booking changes and overrides.

The same query/view or service layer must supply both interfaces so headline totals cannot diverge.

---

## 6. Implementation phase delivered in v3.10.7 - smart summer and winter allocation

### Scheduling modes - delivered

Each allocation run selects:

- **Manual:** recommendations and validation only; publication is blocked.
- **Assisted:** ranked suggestions for operator review and publication.
- **Automatic draft:** a complete proposed allocation, never published automatically.

Team profiles can follow the selected run mode or use a specific override. Manual-only teams always remain recommendations and must be resolved separately before publication.

### Allocation inputs - initial delivery

The scoring model now considers:

- previous and preferred day, time and resource;
- unavailable days and acceptable start times;
- age group and appropriate start time;
- team format and minimum pitch area;
- session duration;
- regular, pre-season and winter inventory separation;
- fixed winter-provider slots and costs;
- all active coaches shared across teams;
- pitch/site preferences;
- priority weighting;
- current-allocation protection;
- existing confirmed, provisional and requested training allocations.

Travel, accessibility, linked-player constraints, curfews, changeover buffers and provider-contract commitments remain later scoring inputs.

### Allocation outputs - delivered

Each draft includes:

- a proposed or suggested allocation for every eligible team;
- manual-only recommendations;
- unassigned teams;
- hard-conflict warnings;
- confidence and numeric score;
- concise reasons for each recommendation;
- up to three alternative slots;
- operator locks;
- summary totals and publication readiness.

### Publication controls - delivered

- Only club operators/admins with Annual Planner authority can save or publish runs.
- Manual runs cannot publish.
- Runs containing unassigned or manual-only recommendation items cannot publish.
- Every publishable item requires a valid day, time and resource.
- Final booking creation rechecks database capacity for every weekly occurrence.
- Any conflict rolls back the publication transaction.
- Published allocations create linked recurring booking series and an audit event.
- Nothing moves or publishes silently.

### Shared analytics - initial delivery

Both Annual Planner Insights and main Analytics now receive:

- smart allocation run count;
- published run count;
- automatic draft count;
- teams allocated through smart runs;
- unresolved/unassigned allocation items;
- average allocation score.

Preferred-slot success, fairness, override rate, cost optimisation and unmet-demand analysis remain next analytical increments.
---

## 7. Implementation phase delivered in v3.10.8 - master rules and coach preferences

### Master rule hierarchy

The scheduling hierarchy is now:

`Club master rule -> season rule -> team-type/age-group rule -> specific-team rule -> team profile -> coach preference proposal`

Club rules remain authoritative. A coach preference can improve the scoring input but cannot bypass a blocked day, restricted time, prohibited pitch/site or club-only control.

### Default behaviour

- New seasonal policies default to Monday-Friday.
- Weekend training is disabled until explicitly enabled.
- Winter and regular-season rules remain separate.
- New team profiles inherit permitted days, time windows, default duration, area requirement and resource restrictions.
- The allocator leaves a team unassigned rather than placing it on a blocked weekend.

### Coach controls

Coaches can maintain preferences for assigned teams only. Available fields include preferred days, unavailable days, start times, duration, minimum space, club pitches, winter sites and notes. Each submission is validated again in Supabase.

Club administrators choose one policy per rule scope:

- **Approval required:** changes create a pending proposal.
- **Apply immediately:** valid changes update the team profile and remain auditable.
- **Club managed only:** coaches can view inherited rules but cannot submit changes.

### Review and explanation

The Annual Planner shows pending coach changes in a review queue. Approved proposals become the team preference used by smart allocation. Rejected proposals retain the decision note and generate a Coach Hub message. Recommendation explanations identify the inherited policy source and state when no permitted allocation exists.

### v3.10.8.1 rule targeting, half-hour choices and persistence

- Rule targeting now includes club, team type, age group and specific team scopes.
- The Applies to selector must always contain real values derived from the current team register.
- Preferred times use selectable 30-minute starts only.
- Start choices are recalculated whenever the rule window or session duration changes.
- A selected start must allow the complete session to finish before the latest permitted finish.
- The season scheduling mode is part of the saved club default and must survive sign-out, refresh and a new browser session.
- The UI must visibly distinguish a saved season mode from an unsaved mode change.
- Saving a narrower age, type or team rule must not accidentally overwrite the club season mode.

---

## 8. v3.10.9 delivery - closure recovery, alternatives and notifications

### Closure-impact workflow

Creating a blackout or closure identifies affected approved bookings. Operators can now:

- relocate a booking immediately;
- offer a coach-controlled alternative;
- postpone while awaiting rearrangement;
- cancel with a recorded reason;
- acknowledge that no booking change is currently required.

The original booking, closure, decision, public message and private operator note remain auditable. Unresolved, awaiting-coach and postponed impacts stay visible in the action queue.

### Coach alternatives

- The original and offered allocation are shown side by side.
- The coach can accept, decline and include a reply.
- Acceptance rechecks capacity and then updates the shared calendar.
- Decline returns the booking to operator review.
- No calendar movement occurs merely because an alternative was offered.

### Notifications

The release queues in-app and email-worker notifications for:

- alternative offered;
- alternative accepted or declined;
- booking relocated;
- weather or facility postponement;
- cancellation caused by closure or weather.

Broader request and conversation notification coverage remains connected to the Communications roadmap.

### Shared analytics

The shared analytics layer now includes affected bookings, resolved impacts, awaiting-coach responses, relocations, postponements, cancellations and resolution percentage. These measures feed both Annual Planner Insights and main club Analytics.

### Next implementation phase - v3.10.10 recurring seasonal operations and resource depth

- Recurring seasonal allocation editing and rollover.
- Bulk closure relocation and multi-booking alternatives.
- Waiting lists with optional offer expiry.
- Equipment, changing rooms and shared-resource reservations.
- Setup and changeover buffers.
- Maximum-player and deeper area-capacity rules.
- Provider cancellation deadlines and winter-site operational contacts.
- Deeper unmet-demand, fairness and facility-pressure analytics.

---

## 9. Later opportunities

- Pitch diagrams with selectable areas.
- Quarter-pitch, third-pitch and goalkeeper-zone templates.
- Equipment and shared-resource reservations.
- Setup and changeover buffers.
- Waiting lists and automatic offer expiry.
- Provider contract and invoice reconciliation for winter sites.
- Weather forecast risk indicators without automatic cancellation.
- Drainage, surface-condition and maintenance histories.
- Scenario planning for a proposed 3G pitch or floodlight project.
- Allocation optimisation by travel, cost, fairness or development pathway.
- Cross-club external-site marketplace, subject to a separate commercial and safeguarding review.

---

## 10. Analytics and grant evidence

### Annual Planner Insights

Operational detail and drill-downs for planners:

- bookings and delivered hours by team, pitch, area, site and season;
- summer versus winter usage;
- slot occupancy and spare capacity;
- full-pitch versus area usage;
- preferred-slot success;
- unallocated teams and unresolved demand;
- weather loss and rearrangement performance;
- external-site cost and cost per delivered team-hour;
- approval times and request outcomes;
- allocation confidence and manual override rate.

### Main Analytics page

Club-wide, cross-module and grant-ready measures:

- total scheduled and delivered activity;
- training plus fixture pressure on facilities;
- hours lost to weather and closures;
- teams and participants affected;
- external winter-facility dependency and cost;
- demand exceeding available capacity;
- seasonal facility pressure;
- evidence supporting drainage, floodlights, resurfacing, 3G or new-space investment;
- comparisons between participation growth and facility supply.

### Shared analytics rule

Annual Planner Insights, main Analytics and grant/report exports must use the same analytics data layer. For any period and filter set:

`Annual Planner total = Main Analytics total = Grant evidence export total`

Differences may only arise from clearly displayed scope or filter choices.

### Example evidence statements

- `74 scheduled training hours were lost to waterlogged grass pitches.`
- `19 sessions moved to external winter facilities because no floodlit club space was available.`
- `Winter demand exceeded contracted capacity by 31 team-hours.`
- `Pitch 4 operated at 92% of available training-area capacity during peak weekday hours.`

Evidence statements must be traceable to underlying booking records.

---

## 11. Data model and integration requirements

Likely entities or extensions:

- seasonal facility inventories;
- sites and bookable resources;
- resource hierarchy: full resource and named areas;
- fixed provider slots;
- team training preferences;
- allocation runs, scores, explanations and locks;
- disruption events and linked replacement bookings;
- closure impacts and resolution state;
- booking audit events;
- analytics facts or stable reporting views.

All records must be organisation/club scoped. Foreign keys should use durable IDs; names are presentation fields and matching fallbacks only. Calendar and analytics identities must include the specific resource area where relevant.

Integrations:

- Coach Hub team assignments and permissions;
- Settings pitch/site configuration;
- Communications notifications;
- fixture and friendly calendar events;
- main Analytics and Reports;
- funding evidence workspace;
- private calendar feeds.

---

## 12. Security, permissions and audit

### Coach

- View calendars for assigned teams and relevant shared restrictions.
- Create and edit permitted requests.
- Accept/decline alternatives and participate in request conversations.
- Cannot view private operator notes, other teams’ private details, costs or internal allocation scoring unless explicitly permitted.

### Club operator

- Review requests and availability.
- Approve, offer alternatives, postpone, relocate and cancel within assigned authority.
- View operational notes and impact queues.

### Club admin/owner

- Configure sites, areas, seasonal inventories, allocation modes, priorities and costs.
- Publish allocations and manage overrides.
- Access full analytics and audit history.

### Controls

- RLS must enforce club and team scope.
- Final booking changes require transaction-level conflict checks.
- Security-definer functions use restricted search paths and explicit qualification.
- Every override, approval, cancellation, postponement and automatic recommendation decision is auditable.
- Calendar feeds use revocable tokens and reveal only authorised information.

---

## 13. UX and accessibility standards

- Coaches should complete a normal request comfortably on mobile.
- Availability must be explained in plain language, not only a red/green result.
- Full Pitch and named areas must be visually and semantically distinct.
- Background refreshes must not move the page, close dialogs, reset forms or lose scroll position.
- Save/submit actions require visible progress and a clear success or error state.
- Status cannot rely only on colour; use text and icons.
- Calendar density must remain readable with concurrent area bookings.
- Operator actions should be reversible where safe and always confirm destructive changes.
- Recommendation explanations should be concise, with detail available on demand.

---

## 14. Testing and acceptance criteria

### Full-pitch hierarchy

- Full Pitch prevents overlapping Half A and Half B bookings.
- Existing Half A prevents an overlapping Full Pitch booking.
- Half A and Half B coexist where capacity permits.
- Same-area duplicate and third-capacity bookings fail in UI and database.
- Friendly availability never displays irrelevant area-capacity wording.

### Requests and approval

- Availability, submission and approval produce the same result for the same data.
- Two operators cannot approve conflicting requests concurrently.
- Alternatives preserve the original request and conversation.
- Error messages are visible and actionable.

### Weather and closures

- Original and replacement bookings remain linked.
- Postponed/cancelled sessions remain in audit and analytics.
- Coaches receive the correct public reason.
- Private notes remain private.
- Closure creation identifies every affected booking.

### Winter inventory

- Fixed slots cannot be booked outside provider dates or times.
- Summer and winter capacity cannot contaminate each other.
- Recurring allocations honour excluded dates and provider restrictions.
- Costs aggregate correctly.

### Smart allocation

- Locked allocations remain unchanged.
- Hard constraints are never violated.
- Every recommendation has an explanation and score.
- Automatic runs create drafts only.
- Manual overrides survive refresh and publication.

### Analytics

- Shared totals reconcile across Annual Planner Insights, main Analytics and exports.
- Weather-lost, delivered and rearranged hours are mutually understandable and not double counted.
- Drill-down records reproduce headline totals.

### Quality gates

- Focused regression tests for each rule.
- Full regression suite before release.
- TypeScript/Vite production build.
- Lint with zero new errors.
- Migration dry-run and linked staging migration.
- Multi-club isolation checks.
- Mobile and desktop acceptance checks.
- Controlled HSM pilot scenario covering summer, winter, weather and split-pitch use.

---

## 15. Packaging and entitlements

The Annual Pitch Booking, Training and Friendlies Planner remains a **bolt-on module**, not standard Core functionality.

Committed direction:

- **Core:** paid add-on; not included by default.
- **Elite:** included.
- **Pro:** final decision to be confirmed during pricing design; either included or offered at a lower add-on price than Core.
- **Link:** not available as a standalone planner; future league-connected calendar visibility may be considered separately.

Potential entitlement layers inside the add-on:

- Manual planning and shared calendar.
- Coach requests and approvals.
- Winter-site and cost management.
- Assisted/automatic allocation.
- Advanced grant analytics and scenario planning.

Avoid fragmenting the workflow so heavily that a club cannot complete a basic annual plan. Advanced automation and evidence features are the strongest candidates for higher-tier differentiation.

---

## 16. Commercial opportunities

- Annual planner add-on subscription.
- Advanced allocation and optimisation tier.
- Winter-site contract/cost management.
- Grant evidence packs and board-ready facility reports.
- Multi-site and multi-club organisation command for Elite.
- Provider utilisation reports for local authorities or facility partners, subject to data-sharing agreements.
- League-linked fixture and training conflict intelligence after League Manager integration.

Commercial claims must remain grounded in validated operational data and should not imply guaranteed grant success.

---

## 17. Decisions and open decisions

### Confirmed

- Roadmaps are maintained one module at a time.
- Manual, Assisted and Automatic Draft allocation modes are implemented, with team-level inheritance/override and operator-only publication.
- Full Pitch must coexist with named areas as an explicit resource option.
- Weather disruption and winter training are first-class workflows.
- Planner data feeds both Annual Planner Insights and main Analytics through one data layer.
- The module is a bolt-on and included in Elite.

### To confirm during implementation/design

- Whether Pro includes the module or receives discounted add-on pricing.
- Default weighting, fairness policy and advanced constraint priorities for automatic allocation.
- Exact retention period for detailed request conversations and audit events.
- Whether provider costs are visible to operators or admin/owner only.
- Scope of SMS/WhatsApp notifications by package.
- Whether external providers receive a portal in a later module.

---

## 18. Delivery order

1. Maintain this roadmap after every Annual Planner release.
2. v3.10.8: master scheduling rules, weekday defaults and coach-managed preferences under club control.
3. v3.10.8.1: functional rule targeting, half-hour time choices and persisted season modes.
4. Validate master rules and coach proposals with HSM across regular and winter scenarios.
5. v3.10.9: closure-impact resolution, coach alternative acceptance, notifications and weather recovery - delivered.
6. v3.10.10: recurring seasonal allocations, waiting lists, equipment/resources and deeper facility-demand analytics.
7. Grant evidence statements and facility scenario planning.
8. Start the next module roadmap only after this module phase is validated.

---

## 19. Change and release history

| Release | Status | Scope |
|---|---|---|
| v3.10.5.4 | Complete | Initial committed module roadmap through v3.10.5.3. |
| v3.10.6 | Complete | Full Pitch authority, winter-site inventory, weather disruption and shared analytics foundation. |
| v3.10.7 | Complete | Manual, Assisted and Automatic Draft smart summer/winter allocation. |
| v3.10.7.1 | Complete | Annual Planner workspace navigation refinement. |
| v3.10.8 | Complete | Club master scheduling rules, weekday defaults and coach-managed preferences with approval controls. |
| v3.10.8.1 | Complete | Functional Applies to scopes, 30-minute preferred-time selectors and persisted season scheduling modes. |
| v3.10.9 | Complete | Closure impacts, Coach alternatives, notification queues, weather recovery and shared analytics. |
| v3.10.10 | Next | Recurring seasonal operations, waiting lists, resources and deeper capacity analytics. |

The roadmap must be updated after each implementation release and before the next module roadmap is started.
