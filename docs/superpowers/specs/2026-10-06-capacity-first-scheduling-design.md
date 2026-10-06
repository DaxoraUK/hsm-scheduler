# Capacity-first scheduling and reliable manual moves

Date: 2026-10-06
Branch: `referee-flow-staging`
Status: written specification approved by the user on 2026-10-06; implementation plan awaiting review
Investigation baseline: `2013209` (product changes through `d6260c0`)

## Intent and scope

Build an understandable first schedule: place each eligible Home fixture at the earliest valid kick-off on an available, suitable playing resource, then use intelligence recommendations to improve parking and other operational outcomes. Parking capacity must not prevent allocation or force a later initial kick-off. Honour the configured simultaneous-game limit, duration, turnaround, competition timing, closures, physical pitch occupancy and valid manual allocations.

The user approved arbitrary separate playing areas inside any pitch, including Astro, with day-specific available-from/to windows. Three areas can host three simultaneous games and then further games as time becomes available. This is not a fixed list of three time slots. Include reliable calendar drag/drop and drawer moves in the same constraint model.

This specification changes scheduling/resource boundaries, so it follows the architectural design path. It does not authorize a live rebuild, fixture cleanup, database migration or deployment. No application code, fixture data or settings were changed during investigation.

### Not included

- Referee-aware automatic allocation, travel time or consecutive referee appointments; preserve existing referee conflict protections for manual moves.
- A new import/reconciliation implementation, fixture identity scheme, communications redesign or analytics redesign.
- A new consecutive-games limit. The current timing control is **maximum concurrent games**. A separate consecutive-use policy requires a later explicit design.
- Automatic changes to existing pitch layouts, training capacity, entitlements or live configuration.
- Mathematical proof of globally maximal allocation. The baseline is deterministic earliest-feasible placement with fixed reservations respected, not a new global optimisation service.

## Findings and evidence

These are current code findings and synthetic, read-only reproductions, not authenticated-browser observations of the user's particular fixture set.

1. **Later kick-offs are favoured by the allocator.** `src/lib/scheduler.js` uses `concurrentCount * 1000 + (endMins - time) + innerPitchPenalty` for most formats; only 3v3 selects the earliest time directly. Two existing 10:00 reservations on separate pitches caused a third fixture on a free suitable pitch to choose 10:00 rather than the available 09:00. Initial scheduling does not directly receive car-space capacity; changing only a parking flag would not remove this grouping bias.
2. **Physical conflicts differ between build and moves.** `pitchRegistry.getLinkedPitchIds` includes siblings, parents and children. `pitchClashRule` therefore blocks two separate sibling areas such as P2a/P2b. The allocator uses a different relationship check and checks only the first child when testing a full parent. The same relationship helper also handles closures, so simply removing siblings from it is unsafe.
3. **Duration changes on a drag.** `timelineDragEngine.buildTimelineMovePatch` discards the existing `endMins` and falls back to fixed 15/30-minute buffers. With a 45-minute fixture and zero configured youth buffer, a 10:00 move became a 60-minute reservation and incorrectly collided with a 10:45 booking. `scheduler.js` also uses `buffer || 15`, losing a valid zero buffer.
4. **Visible timeline bounds become legal move bounds.** `MatchdayTimelineCard` builds a display range around existing fixtures and passes that range to `buildTimelineMoveCandidate`, which clamps the requested time. A single 09:00-09:45 fixture produced an 08:30-10:30 display range; an 11:00 request became 09:45 despite a configured 12:00 latest youth kick-off. The patch then snaps again, so a clamped candidate and the committed patch can disagree at a non-grid boundary.
5. **Filtered positions can target another fixture.** The timeline receives `active`, while `applyTimelineMove` passes its candidate index to `editableOverride`, which resolves `final[index]`. With `[Away fixture, Home fixture]` in `final`, moving the sole visible Home fixture at active index 0 produced an override owned by the Away fixture. Opening the drawer already resolves identity into `final`; drag application does not.
6. **Pointer behavior needs real interaction coverage.** Whole-card dragging maps the pointer position directly to kick-off without retaining the grab offset and commits the last pointer-move candidate instead of recomputing at release. Existing whole-card tests inspect source strings, not pointer behavior. These are code-level risks; their exact mouse/touch symptoms still need browser reproduction.
7. **Parking and hard concurrency are coupled.** Manual validation runs parking-capacity and parking-concurrency rules. Timeline code treats both as advisory even though the agreed simultaneous-game limit must remain a hard scheduling constraint. Build concurrency checks occur at kick-off rather than across the candidate interval; some reservation paths bypass that check. The Saturday build callback also omits `club.maxConcurrent` from its dependencies.
8. **Planner occupancy is not consistently supplied.** Timeline moves load Annual Planner bookings and call its conflict engine without the pitch configuration; that engine largely compares equal pitch IDs and has a separate training-area model. Rebuild and manual moves must agree about bookings on parents/children and ignore only the selected fixture's own synchronized booking.

## Chosen approach

Use the existing scheduler, registry, override storage and move engines, with a small shared resource/constraint boundary. Initial allocation, manual moves and recommendation validation consume the same resource footprints, availability and occupied intervals. Keep the existing canonical rebuild and day-specific UI entry points.

Alternatives considered:

- Changing parking weights alone would leave the grouping bias, sibling blocking and wrong-fixture drag routing intact.
- Special-casing P2a/P2b or Astro would not support user-created areas and would repeat inconsistent rules in each consumer.
- A new global scheduler would be a much wider replacement and is not needed for the agreed capacity-first behavior.

## Resource model and settings

### Physical areas, not pitch-name conventions

Reuse actual stable pitch IDs for selectable schedule rows and allocations. Add optional physical-area configuration to the existing pitch configuration:

- A parent pitch defines `playingAreas`: named physical units with immutable IDs. Users can add, rename or remove areas; the count is derived from this list and is not hard-coded to two or three. Support at least ten.
- A child pitch retains its existing `innerOf` parent and can declare `playingAreaIds`, the physical units its layout occupies. A small separate pitch may occupy one unit; an alternative larger layout may occupy several.
- A full parent allocation occupies all of its units. Different children may run together only when their explicitly declared footprints do not overlap. The same resource or intersecting footprints always conflict.
- Legacy children without explicit area mappings conservatively occupy the whole parent footprint until configured. Do not guess disjointness from names such as `2a`, `2b` or `Astro 3`, and do not automatically rewrite saved pitches.
- A child mapping must reference existing units of its parent. Reject invalid parents, cycles, duplicate area IDs and dangling mappings before saving. Keep the current supported parent/child structure; no new nested-layout editor is required.

Settings exposes **Playing areas** separately from **Training areas/capacity**. Creating three Astro areas creates ordinary selectable child-pitch records with stable IDs and suitable formats, not three anonymous slots or generated fixture identities. A convenient add-area action may create the child alongside its physical unit, but must obey existing pitch creation/entitlement rules. Existing training capacity does not silently become match capacity.

Containment, physical occupancy and closure propagation are separate registry concepts. A whole-parent closure blocks all children; a closure of one area blocks that area and any layout using it, including the full parent, but does not close a separately declared sibling. Legacy layouts retain conservative closure behavior.

### Available-from/to windows

Add optional `availabilityByDay` to each pitch, keyed by local weekday. An absent/null day inherits parent availability (or existing club/competition defaults for a root). An empty list means unavailable. A configured day contains one or more non-overlapping `{from, to}` local-time windows; the basic UI shows one from/to pair and can add another window for a break.

- Effective child availability is the intersection of parent availability and its own windows. An override can narrow, but cannot extend, a parent's availability.
- The whole reservation, including the configured turnaround, must fit inside an availability window. Half-open intervals allow the next game to start exactly when the preceding reservation clears.
- Club/competition earliest kick-off, latest youth **kick-off** and fixed Adult rules remain separate restrictions. `Available until 13:00` means clear the pitch by 13:00; `Latest youth kick-off 12:00` does not mean finish by 12:00.
- Closures and protected planner bookings subtract occupied intervals from availability. Reject malformed times, finish-before-start, overlapping windows and unsupported overnight windows with clear messages.
- No field means legacy behavior, not an invented closing time. Saving/loading configuration must retain the fields. Confirm the existing configuration persistence round trip before implementation claims; if a database schema change is actually needed, stop for specific approval rather than applying one implicitly.

Astro example: three disjoint child areas available 09:00-13:00. A 45-minute game plus 15-minute turnaround fills each area at 09:00, 10:00, 11:00 and 12:00, subject to suitability and the simultaneous-game setting. Availability does not automatically assign officials or bypass other hard rules.

## Shared scheduling constraints

Use a pure shared resource contract, adapting existing engines rather than creating another rebuild implementation:

- Resolve pitch footprints and effective availability from normalized settings.
- Resolve game duration and turnaround from the existing age/team and timing configuration. Zero is valid. Preserve the valid current duration for a pitch/time-only move; rebuilding recalculates from current settings. Do not infer Adult from 11v11, a parent pitch or P1 preference.
- Validate a candidate by stable fixture identity against occupied intervals, excluding its own record and synchronized planner booking only.
- Hard failures include suitability, closures, overlapping physical footprints, protected bookings, team clashes, timing/window boundaries, locks/permissions and maximum concurrent games. Keep existing referee checks for moves; do not silently broaden the automatic referee scheduler.
- Separate parking-car warnings from hard simultaneous-game limits. Parking warnings are returned alongside validation results and never short-circuit or hide a hard failure. They remain visible in intelligence/overlays, but do not require an extra parking-only approval to make an otherwise valid manual move.
- Evaluate maximum concurrency at all interval change points during the candidate reservation, not only at kick-off and not by counting every resource that overlaps some part of a long interval. Preserve the current explicitly independent-resource exemption; do not equate physical sibling separation with exemption from the club limit. New child areas inherit the parent's independent policy unless explicitly configured through existing settings.

Annual Planner retains its existing booking and training semantics. Its resource comparison must consume the same physical-footprint resolver, including parent/full bookings and mapped partial areas. Unmapped training areas conservatively occupy their parent for match validation. Do not reinterpret existing training labels as physical unit IDs. When planner protection is enabled, loading/error states must be explicit; do not silently treat a failed resource load as proof that the pitch is free. No planner schema or public API rewrite is included.

## Initial build/rebuild behavior

For the selected Saturday, Sunday or dated Midweek scope:

1. Reuse canonical imported/manual fixture loading, stable source identities, reconciliation and persisted overrides. Retain inactive and Away records canonically without assigning them operational capacity. An active Away-to-Home override is eligible once, against the same identity.
2. Load the current settings, closures and protected bookings. Resolve identities and resource constraints before producing a proposed schedule.
3. Reserve valid manual pitch/time allocations and fixed Adult kick-offs before flexible placement. Validate them against the same rules. If constraints have changed, expose the exact invalid reservation; do not silently keep an impossible clash or discard the manual intent.
4. Place remaining eligible fixtures deterministically, retaining existing age ordering with a stable identity tie-breaker. Search all suitable open resources and allowed times, ascending by time; resource preference is a tie-breaker at the same time, not permission to choose a later preferred pitch over an earlier valid alternative.
5. Retain the existing 15-minute cadence anchored to the configured start for flexible allocation; advance to the next allowed grid point after the occupied interval. Imported/fixed and valid manually entered off-grid times remain exact. Do not force time rounding on a pitch-only manual move.
6. Use all configured, suitably compatible alternatives rather than stopping at occupied preferred pitches. Do not trade away hard constraints for parking scores. Report the actual exhausted constraint(s) when no legal candidate remains under the retained reservations.
7. Upsert/replace the scoped generated schedule through the existing canonical rebuild boundary, never append another copy. Persist the result and refresh schedule, timeline, capacity, parking and officials state through the existing downstream flow. On load/validation/save failure, leave the prior schedule intact and show failure.

Rebuilding unchanged canonical inputs and settings produces the same fixture set and deterministic flexible allocations. Keep the existing concurrency guard and visible scoped Rebuild Schedule controls. No identity is derived from KO, pitch, area position, array index or generated fixture number. A scheduling move never creates another canonical fixture.

Intelligence recommendations remain a separate reviewable step after the baseline build. Apply recommendations only after revalidating the current full schedule, especially a batch of recommendations, with the same hard resource rules. Their parking benefits do not redefine initial allocation order.

## Manual moves and drag/drop

### Targeting and atomic updates

Candidates, application, undo/redo and history must carry the existing canonical/flow identity. Resolve it into the current full day fixture set at commit; do not pass a filtered index as a full-list index or fall back to an unrelated row when a target disappears. Abort with a clear refresh message for missing or ambiguous targets. The drawer's current identity-first lookup is the useful local precedent.

Apply pitch, KO and end fields as one validated override patch for that identity, preserving unrelated metadata, reversal intent and existing save behavior. Revalidate against current settings, bookings and locks at commit, not only during preview. An intervening schedule change must not apply a stale, formerly valid candidate. Success feedback/history occurs only after the local operation succeeds; distinguish unsaved local changes from a successfully persisted week. Save failures retain an accurate dirty/error state.

### Pointer and time behavior

- Retain the grab offset so dragging the middle/right edge of a whole card does not move its kick-off to the pointer's time. Preserve click-to-open with the existing intentional-movement threshold.
- Use scroll-aware row/canvas coordinates for all zoom modes. Determine the target row and time at release, including after auto-scroll, instead of committing the last stale preview.
- Use visual bounds only for positioning. Display/scroll the legal scheduling range so valid empty time and pitch rows can be reached. Availability, not the padded extent of existing fixtures, defines legal targets.
- Resolve snap/clamp once against legal windows and the candidate's real duration. Preview and committed KO/end must agree. Never silently move the requested target far backwards because of display bounds. Explain a rejected boundary or offer the next legal slot.
- Preserve an exact existing off-grid KO for a pitch-only move. Intentional time drags snap to the common day grid; the drawer continues supporting valid exact typed times.
- Clear drag state on Escape, pointer cancellation, release outside a pitch row, lock changes and unmount. Mouse and touch must not leave a stuck cursor or ghost candidate. Locked schedules stay read-only.
- Show a precise reason for a true hard block, with alternatives checked by the same rules. Separate area siblings and parking-only warnings must not produce false hard blocks.

Undo/redo/discard must use stable identity and must not apply a historical allocation onto a different row after sorting, rebuilding or filtering. Revalidate restoration against current constraints; if history is no longer applicable, explain why instead of silently corrupting the schedule.

## Expected implementation boundaries

- `src/lib/registry/pitchRegistry.js`: generic footprints, containment and closure relations; retain stable registry IDs.
- A focused pure scheduling resource helper beside existing engines: effective windows, occupancy intervals, duration and hard concurrency contract.
- `src/lib/scheduler.js` and `src/AppCore.jsx`: earliest-first resource search, reservation checks and complete settings propagation through the existing build callbacks.
- `src/lib/engines/validationEngine.js`, `rulesEngine.js`, `timelineDragEngine.js`, `recommendationEngine.js`, relevant pitch/parking rules: adapters to the shared contract and consistent duration/advisories.
- `src/lib/planning/annualPlannerEngine.js`: resource-footprint comparison only, preserving existing training/canonical-booking behavior.
- `src/components/Settings/PitchSettingsPanel.jsx`: playing areas and availability controls; reuse existing pitch editor/save flow.
- `src/components/Operations/shared/MatchdayTimelineCard.jsx`, `src/lib/engines/timelineEngine.js`, `matchdayPlannerEngine.js`, `src/pages/MatchdayPage.jsx`: full-range rendering, pointer coordinate/drop handling, identity routing and atomic move integration.
- Targeted regression and real interaction tests. No unrelated module refactoring or replacement of fixture import logic.

## Acceptance and verification

Write failing tests first for the observed defects, then implement incrementally. Verification must include:

1. Earliest valid allocation at 09:00 despite later concurrent reservations or inadequate car-space capacity; preferred pitch only breaks equal-time ties.
2. Consecutive reservations fill each resource to the next allowed KO using configured duration/turnaround, including zero buffer and non-grid finishes.
3. Generic two, three and ten-area layouts; disjoint siblings can run together, intersecting layouts cannot; parent allocation conflicts with every occupied child, not just the first.
4. Parent/child closures and availability inheritance/overrides; finish exactly at available-until succeeds, exceeding it fails; split windows and latest youth KO retain distinct meanings. Astro remains subject to its enablement and suitability settings.
5. Maximum concurrent games holds across the entire interval and reservation paths; independent-resource policy remains as configured. Parking-only warnings never hide hard failures.
6. Ordinary Away and inactive fixtures consume no schedule capacity; reversed Home and valid manual allocations survive repeated rebuilds exactly once; genuine distinct source fixtures remain distinct.
7. A 45-minute zero-buffer fixture can move to 10:00 before a 10:45 booking; valid 11:00 movement is not constrained by a 10:30 visible extent; preview/patch duration and times agree.
8. Mixed Home/Away/postponed ordering, filtered/sorted lists and intervening rebuilds: drag, drawer, recommendations and undo target only the intended stable identity and retain unrelated edits.
9. Behavioral pointer tests, not source-string assertions: whole-card grip offset, mouse/touch, each zoom, horizontal/vertical scrolling, auto-scroll, release without another pointermove, Escape, outside-row release, unmount and locked schedules.
10. Planner full/child/partial-resource bookings and self-booking exclusion; failure/loading states do not falsely advertise free space. Settings round-trip, refresh and save-failure behavior are tested without altering real fixtures.
11. Saturday, Sunday and Midweek use the same shared constraints and scoped rebuild pipeline; double rebuild cannot run concurrently. Existing Adult rules remain unchanged; U17/youth classification is independent of pitch and format.

Run the targeted scheduling/resource/manual-move/planner boundary tests, TypeScript check and production build. This touches shared resource architecture, so expand regressions only to affected consumers as evidence requires; do not automatically run all unrelated modules. Before any release, verify the actual drag/drop and settings flow in a browser using isolated test data, then separately verify deployment assets and authenticated UI when authorized. No authenticated browser check or deployed fix is claimed by this design investigation.

## Review and safety gate

The next step is written-spec approval, then an implementation plan with sequencing and targeted test commands. Product implementation waits for plan review and the user's chosen execution method. Any needed database change or live data action requires separate, specific approval. Preserve the unrelated `supabase/.temp/cli-latest` modification; stage only intended task files.
