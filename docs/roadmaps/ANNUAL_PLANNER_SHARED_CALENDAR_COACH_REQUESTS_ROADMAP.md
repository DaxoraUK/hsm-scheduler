# Annual Planner, Shared Calendar and Coach Requests roadmap

**Roadmap status:** Active
**Current implementation release:** Ground Control v3.10.6
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

## 3. Current implementation through v3.10.6

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

### Remaining limitations after v3.10.6

- The approval dialog supports allocation changes, but the full side-by-side calendar comparison and coach acceptance of an offered alternative still need refinement.
- Weather reinstatement, completion-after-rearrangement and delivery-status reporting for notifications remain later lifecycle work.
- Winter-site provider contacts, accessibility, travel and cancellation automation require a deeper inventory phase.
- Smart Manual, Assisted and Automatic Draft team allocation is not yet implemented.
- Capacity utilisation, unmet demand, preferred-slot success and cost-per-delivered-hour need further analytical modelling.
- Closure-impact resolution, coach notifications and bulk relocation need further hardening.

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

## 6. Next implementation phase - v3.10.7 smart summer and winter allocation

### Scheduling modes

Clubs can select at club, season and team level:

- **Manual:** club assigns every slot; Ground Control validates and recommends.
- **Assisted:** Ground Control ranks suitable slots; the operator accepts or edits suggestions.
- **Automatic draft:** Ground Control prepares a full unpublished allocation for review.

Assisted should be the recommended default. Automatic allocation must never publish without operator review.

### Allocation inputs

The scoring model should consider:

- previous and preferred slots;
- acceptable alternatives and unavailable days;
- age group and appropriate start time;
- team format, squad size and required area;
- session duration and weekly frequency;
- site, surface, floodlights and seasonal suitability;
- fixed winter-provider slots;
- coach availability and coaches shared across teams;
- linked teams or shared-player constraints where configured;
- travel, access and accessibility;
- curfews and changeover buffers;
- cost and contracted slot commitments;
- performance-pathway or club priority;
- fairness in prime-slot allocation;
- locked and already-approved allocations.

### Allocation outputs

The engine produces:

- proposed allocation for every team;
- unassigned teams;
- hard conflicts;
- soft compromises;
- confidence score;
- explanation for each recommendation;
- comparison with previous allocation;
- total cost and capacity summary.

Example explanation:

> Assigned Monday 18:00 on Pitch 4 Half A because it matches the team’s established slot, is suitable for the age group, avoids the coach’s Wednesday conflict and preserves later slots for adult teams.

Manual overrides remain possible and are retained as future preferences where the operator chooses.

---

## 7. Subsequent phase — closure impact, notifications and calendar refinement

### Closure-impact workflow

Creating a blackout or closure must identify affected approved bookings before final confirmation.

The operator can:

- relocate a booking;
- offer an alternative;
- postpone;
- cancel;
- acknowledge that no action is yet available.

A closure must never silently delete or hide existing bookings. Affected coaches receive an in-app and enabled-channel notification. Unresolved impacts appear in an action queue.

### Notifications

Events requiring notification:

- request received;
- information requested;
- alternative offered;
- alternative accepted or declined;
- request approved or rejected;
- booking amended or cancelled;
- weather postponement;
- replacement slot offered;
- closure affecting a booking;
- new conversation message.

Initial delivery remains in-app and email. SMS and WhatsApp depend on the Communications module roadmap and package decisions.

### Calendar UX

- Clear Full Pitch and named-area labels.
- Month, week, day and mobile agenda views.
- Capacity indicator for each resource/slot.
- My Teams filter for coaches.
- Site, pitch, area, status and season filters.
- Click-to-request on an available slot.
- Request and status updates without page jumps.
- Current-time marker and persistent legend.
- Accessible patterns/icons alongside colour.
- Google, Apple and Outlook-compatible private feeds.

---

## 8. Later opportunities

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

## 9. Analytics and grant evidence

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

## 10. Data model and integration requirements

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

## 11. Security, permissions and audit

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

## 12. UX and accessibility standards

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

## 13. Testing and acceptance criteria

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

## 14. Packaging and entitlements

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

## 15. Commercial opportunities

- Annual planner add-on subscription.
- Advanced allocation and optimisation tier.
- Winter-site contract/cost management.
- Grant evidence packs and board-ready facility reports.
- Multi-site and multi-club organisation command for Elite.
- Provider utilisation reports for local authorities or facility partners, subject to data-sharing agreements.
- League-linked fixture and training conflict intelligence after League Manager integration.

Commercial claims must remain grounded in validated operational data and should not imply guaranteed grant success.

---

## 16. Decisions and open decisions

### Confirmed

- Roadmaps are maintained one module at a time.
- Manual, Assisted and Automatic Draft allocation modes are required.
- Full Pitch must coexist with named areas as an explicit resource option.
- Weather disruption and winter training are first-class workflows.
- Planner data feeds both Annual Planner Insights and main Analytics through one data layer.
- The module is a bolt-on and included in Elite.

### To confirm during implementation/design

- Whether Pro includes the module or receives discounted add-on pricing.
- Default weighting and fairness policy for automatic allocation.
- Exact retention period for detailed request conversations and audit events.
- Whether provider costs are visible to operators or admin/owner only.
- Scope of SMS/WhatsApp notifications by package.
- Whether external providers receive a portal in a later module.

---

## 17. Delivery order

1. Commit this roadmap baseline.
2. v3.10.6: Full Pitch semantics, operator alternatives, weather workflow foundation, winter-site inventory foundation and shared analytics contract.
3. Validate with HSM using real summer/winter slot examples.
4. Smart allocation phase: Manual, Assisted and Automatic Draft.
5. Closure-impact, notifications and calendar refinement.
6. Grant analytics, evidence statements and facility scenario planning.
7. Update this roadmap after each completed phase before starting the next module roadmap.

---

## 18. Change history

| Release | Change |
|---|---|
| v3.10.5.4 | Initial committed module roadmap covering baseline through v3.10.5.3 and agreed next phases. |


---

## 13. Release history

| Release | Status | Scope |
|---|---|---|
| v3.10.5.4 | Complete | Committed module roadmap baseline. |
| v3.10.6 | Complete | Full Pitch authority, winter-site inventory, weather disruption foundation, operator allocation changes and shared analytics foundation. |
| v3.10.7 | Next | Manual, Assisted and Automatic Draft summer/winter team allocation with explainable recommendations and locks. |

The roadmap must be updated after each implementation release and before the next module roadmap is started.
