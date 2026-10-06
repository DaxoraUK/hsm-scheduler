# Capacity-First Scheduling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Allocate Home fixtures at the earliest legal time across configurable playing areas, without parking-driven delays, and make drawer/calendar moves obey the same constraints and stable fixture identity.

**Architecture:** Extend the existing pitch registry and scheduler rather than replacing rebuild/import. Pure helpers own physical footprints, effective availability, duration and interval constraints; build, manual moves and recommendation validation adapt to those helpers. Keep shared protected-booking context, identity-owned atomic overrides and tenant-scoped local drafts distinct from explicit Save Week/publication.

**Tech Stack:** Existing React 19, JavaScript/JSDoc, Vite, Vitest, jsdom, TypeScript build and authenticated REST repository. No new product or test dependencies are planned.

**Spec:** `docs/superpowers/specs/2026-10-06-capacity-first-scheduling-design.md` (approved by the user on 2026-10-06).

## Global Constraints

- Branch: `referee-flow-staging`; planning baseline `72b77db`. Before execution, inspect current HEAD/status and use the using-git-worktrees skill; reuse a suitable existing isolated worktree.
- "Parking capacity must not prevent allocation or force a later initial kick-off."
- "The current timing control is **maximum concurrent games**." Do not add an unrelated consecutive-use policy.
- "Support at least ten." Playing areas are generic, not P2a/P2b/Astro exceptions; training capacity remains separate.
- "Zero is valid." Timing buffers must not fall back through `||`.
- "Available until 13:00" means clear the pitch by 13:00; "Latest youth kick-off 12:00" does not mean finish by 12:00.
- "No identity is derived from KO, pitch, area position, array index or generated fixture number." Reuse existing explicit canonical identity; do not alter import identity/deduplication.
- "Referee-aware automatic allocation, travel time or consecutive referee appointments" are not included. Preserve existing manual referee checks.
- "No application code, fixture data or settings were changed during investigation." Execution uses synthetic tests; no live rebuild, cleanup, database migration or deployment is authorized by this plan.
- Preserve unrelated `supabase/.temp/cli-latest`; stage named intended files only. `sources/` remains read-only.

## Review Focus

- Deleted/renamed parent or area while editing: reject dangling mappings and preserve existing IDs; never silently reinterpret them. Tests in Tasks 1 and 7.
- Non-quarter-hour start such as 09:10 and finish such as 10:05: automatic/drag grid is anchored to the configured start, while pitch-only moves preserve exact typed times. Tests in Tasks 2, 4 and 6.
- Dated Midweek and UK daylight-saving changes: resolve weekday from the supplied local calendar date, never browser UTC conversion or the word "midweek". Tests in Tasks 1 and 3.
- Lock, fixture ordering or booking changes between preview and release: reject a stale candidate without affecting a different fixture or showing success. Tests in Tasks 5 and 6.
- Club/user switch during asynchronous resource loading or draft saving: do not read/write another tenant's draft, or reuse their booking context. Tests in Tasks 3 and 4.

## File and interface map

New focused modules (pure helpers except the injected loader, draft storage and editor):

- `src/lib/scheduling/pitchResourceModel.js`: normalized scheduling-only pitch fields, footprints, closure targets and weekday availability. No React, repository, scheduler or Annual Planner imports.
- `src/lib/scheduling/fixtureTiming.js`: team classification and reservation duration. No scheduler import, avoiding a scheduler/validator dependency cycle.
- `src/lib/scheduling/scheduleConstraints.js`: shared hard interval/resource/team/concurrency checks. Consumes the two modules above and existing stable identity/suitability utilities.
- `src/lib/scheduling/scheduleResourceContext.js`: injected, dated protected-booking load; explicit ready/disabled/error semantics.
- `src/lib/scheduling/fixtureMove.js`: identity resolution, complete move patches and current-state validation for atomic application.
- `src/lib/storage/matchdayScheduleDraft.js`: local, versioned, tenant/day/date draft persistence; not publication/history.
- `src/lib/engines/plannerPointerEngine.js`: pure scroll-aware pointer-to-time/grab-offset conversion.
- `src/components/Settings/PitchSchedulingFields.jsx`: focused area mapping and availability editor used by the existing pitch panel.

Existing integration files are named in each task. Retain public positional scheduler wrappers and existing field-by-field override callbacks for metadata/reversal compatibility; add an atomic allocation callback without refactoring unrelated callers.

Shared shapes (JSDoc, not a new TypeScript conversion):

- `Window`: `{startMins:number,endMins:number}`; half-open reservation interval.
- `ResourceContext`: `{status:'ready'|'disabled',clubId:string,matchDate:string,bookings:array,blackouts:array}`; a failed enabled load throws, never returns an empty ready context.
- `Failure`: `{ok:false,type:string,reason:string,clash?:object,meta?:object}`; preserve old failure types where meanings remain unchanged, add `pitch_availability`, `pitch_surface`, `schedule_concurrency`, `team_clash`, `stale_fixture` for the corresponding new hard rules.
- `MoveResult`: `{ok:boolean,blocked:boolean,fixtureIdentity:string,fixtureIndex:number,patch:object|null,previousPatch:object|null,advisories:array,...existing display fields}`. Index is recomputed from identity at commit, not used as ownership.

Execution commands below are PowerShell from the checkout. Runtime is `D:/Program Files/nodejs/node.exe`; prefix `&` when invoking it. Use local tool entrypoints to avoid the previously unreliable global npm shim. Each test task ends with its targeted test passing and an explicit intended-file commit.

## Task 1: Generic physical resources and availability

**Files:** Create `src/lib/scheduling/pitchResourceModel.js`, `tests/helpers/capacitySchedulingFixtures.js`, `tests/regression/capacity-pitch-resources.test.js`; modify `src/lib/registry/pitchRegistry.js`.

**Interfaces:** Produce `normalisePitchSchedulingFields(pitch)->object`, `validatePitchSchedulingConfig(pitches)->{ok,errors:array}`, `getPitchFootprint(pitchId,pitches)->string[]`, `pitchesShareSpace(firstId,secondId,pitches)->boolean`, `getPitchClosureTargets(closedPitchIds,pitches)->string[]`, `getPitchAvailability({pitchId,pitches,matchDate})->Window[]`. Normalize optional `playingAreas:[{id,label}]`, `playingAreaIds:string[]` and `availabilityByDay:{[weekday]:null|{from,to}[]}` while retaining every unrelated field. Unrestricted legacy availability is `[0,1440]` before competition bounds are applied. Namespace area tokens by root pitch ID; a legacy/unmapped child occupies the whole root footprint.

- [x] Write failing tests named `separate_two_three_ten_areas`, `parent_conflicts_with_last_child`, `alternative_layouts_overlap`, `legacy_children_are_conservative`, `partial_closure_leaves_separate_sibling_open`, `window_inheritance_and_intersection`, `invalid_mapping_is_rejected`, `weekday_is_local_date`. Synthetic helper exports `modelPitches({parentId='AST',count=3,format='5v5',independent=false,availabilityByDay})`, `modelTeam(overrides={})`, `modelFixture(overrides={})`: defaults are stable ID `source:one`, active U10 Home fixture, 45-minute 5v5 game, 09:00-10:00 reservation, 15-minute turnaround. Builders do not access storage/network.
  ```js
  const pitches = modelPitches({availabilityByDay:{sunday:[{from:'09:00',to:'13:00'}]}});
  expect(pitchesShareSpace('AST-1', 'AST-2', pitches)).toBe(false);
  expect(pitchesShareSpace('AST', 'AST-10', tenAreaPitches)).toBe(true);
  expect(getPitchAvailability({ pitchId:'AST-1', pitches, matchDate:'2026-10-25' }))
    .toEqual([{ startMins:540, endMins:780 }]);
  expect(validatePitchSchedulingConfig(danglingMapping).ok).toBe(false);
  ```
- [x] Run `& 'D:/Program Files/nodejs/node.exe' node_modules/vitest/vitest.mjs run tests/regression/capacity-pitch-resources.test.js`; expect new-module/import failure or the pinned incorrect relation behavior, not unrelated setup failure.
- [x] Implement the named interfaces and normalization adapter. Explicitly reject missing/duplicate pitch or area IDs, nonexistent/cyclic/nested parents, child area IDs from another parent, malformed/overlapping/overnight windows. Empty day list is unavailable; absent/null inherits. Keep existing `getLinkedPitchIds` for structural consumers until callers migrate in Task 4; do not change its meaning silently.
- [x] Rerun the same test plus `tests/regression/pitch-identity-allocation-v31087.test.js`; expect all pass and immutable IDs survive label changes.
- [x] Commit only the four named files: `feat: model generic pitch footprints and availability`.

## Task 2: Consistent duration and hard scheduling checks

**Files:** Create `src/lib/scheduling/fixtureTiming.js`, `src/lib/scheduling/scheduleConstraints.js`, `tests/regression/capacity-schedule-constraints.test.js`; modify `src/lib/domain/fixtureLifecycle.js` only for the shared demand predicate, `src/lib/engines/{validationEngine,rulesEngine,recommendationEngine}.js`, `src/lib/intelligence/pitch/pitchRules.js`, `src/lib/intelligence/scheduling/kickOffRules.js` and `src/lib/intelligence/parking/parkingRules.js` only at scheduling adapters.

**Interfaces:** Consume Task 1. Produce `classifyFixtureTeam(fixture)->'youth'|'adult'|'unknown'`, `getFixtureOccupancyMinutes(fixture,{club={},bufferMap={},preserveExisting=true}={})->number`, `getScheduleResourceFailure({fixtures,fixtureIdentity,next,pitchCfg,closedPitches,club,matchDate,resourceContext})->Failure|null`. Extend `validateFixtureUpdate` with optional `fixtureIdentity,matchDate,resourceContext` and an `advisories` array without removing its existing parameters/result fields. Keep `getFixtureDuration` as a compatibility wrapper. `bufferYouth/bufferAdult` take precedence for resolved youth/adult; legacy format bufferMap is a fallback. U-age/name wins over a stale Adult flag; explicit youth/adult/women/veterans team type and existing recognized open-age team names precede format, and format/pitch never classify a team. The runtime `club` context includes current timing, `bufferYouth`, `bufferAdult`, `maxConcurrent` and `useAstro`; explicit `useAstro:false` excludes artificial resources, while an absent value retains compatibility for old callers.

- [x] Add `isFixtureSchedulingDemand(fixture)->boolean` in the existing lifecycle domain; exclude Away venue/flags and recognized inactive `postponed`, `cancelled`, `canceled`, `abandoned`, `void`, `withdrawn` states. Its consumers filter demand, never delete canonical records. Write red tests `zero_buffer_is_real`, `move_preserves_45_minutes`, `u17_generic_11v11_on_p1_is_youth`, `open_age_is_adult`, `concurrency_checked_at_interval_changes`, `parking_warning_does_not_hide_hard_conflict`, `team_cannot_play_twice`, `latest_ko_is_not_pitch_finish`, `invalid_pitch_fails_closed`, `grid_can_start_at_0910`, `inactive_away_retained_without_demand`. This checkbox defines/tests the new interface; implement it only in the implementation step below.
  ```js
  const fortyFiveMinuteFixture = modelFixture({endMins:585});
  expect(getFixtureOccupancyMinutes(fortyFiveMinuteFixture, {club:{bufferYouth:0}})).toBe(45);
  expect(getFixtureOccupancyMinutes(modelFixture(), {club:{bufferYouth:0},preserveExisting:false})).toBe(45);
  expect(classifyFixtureTeam({cfg:{name:'U17 Lisbon',format:'11v11',defaultPitch:'P1',teamType:'adult'}})).toBe('youth');
  expect(validateFixtureUpdate(validParkingRiskMove)).toMatchObject({ok:true});
  expect(validateFixtureUpdate(overConcurrentLimitMove)).toMatchObject({ok:false,type:'schedule_concurrency'});
  ```
- [x] Run `capacity-schedule-constraints.test.js`; verify each reproduced failure is red before edits.
- [x] Implement identity-excluded half-open overlap checks and accurate sweep-line concurrency. Keep independent-resource exemptions separate from physical layout separation and `affectsParking`; descendants inherit independence unless explicitly set. Evaluate hard failures before car-space advisory results, even when parking is disabled. Reuse existing referee rule for move validation, not build allocation. Recommendation candidate generation must use the same duration and hard rules; parking improvement can remain a ranking criterion only in intelligence.
- [x] Run that file and `pitch-validation.test.js`, `scheduler-recommendations.test.js`, `fixture-team-identity-p0.test.js`. Update only old tests whose behavior the approved spec intentionally changes; replace source-string parking assertions with behavioral assertions in Task 5, not weakened tests.
- [x] Commit intended files: `fix: share duration and scheduling constraints across moves`.

## Task 3: Protected-booking context shared by rebuild and moves

**Files:** Create `src/lib/scheduling/scheduleResourceContext.js`, `tests/regression/capacity-planner-context.test.js`; modify `src/lib/planning/annualPlannerEngine.js`, `src/components/Operations/shared/MatchdayTimelineCard.jsx` at resource loading, and `src/AppCore.jsx` at build context loading.

**Interfaces:** Consume footprints/constraints. Produce `loadScheduleResourceContext({clubId,matchDate,plannerEnabled,loadWorkspace})->Promise<ResourceContext>`, calling injected `loadWorkspace(clubId,{startDate,endDate})`, bound to the existing `DB.listAnnualPlannerWorkspace` in production. Query the selected local date plus the adjacent dates so existing setup/clear-down buffers cannot be missed at midnight, then select overlapping reservations for the requested date. Add `bookingToScheduleReservation(booking,{pitchCfg,matchDate})->{fixtureIdentity,pitchId,footprint,startMins,endMins,teamKey}|null`; inactive/non-overlapping rows return null. Preserve Annual Planner's public arguments, booking fields and training-capacity checks. A booking against an explicitly configured child pitch uses that child's mapped footprint; an unmapped partial training area against a parent conservatively occupies that parent for match interaction. Do not infer physical mapping from a training-area label or add a new booking/database field.

- [x] Write red tests `full_parent_booking_blocks_child`, `disjoint_child_booking_does_not_block_sibling`, `unmapped_training_area_blocks_match_parent`, `own_sync_booking_is_ignored_only_by_identity`, `uk_date_window_and_midweek_weekday`, `resource_load_failure_is_not_ready`, `club_switch_ignores_old_response`.
  ```js
  await expect(loadScheduleResourceContext({clubId:'a',matchDate:'2026-10-25',plannerEnabled:true,loadWorkspace:rejectingLoader})).rejects.toThrow();
  expect(detectAnnualPlannerConflicts(childCandidate,{bookings:[parentBooking],pitches})).not.toHaveLength(0);
  expect(detectAnnualPlannerConflicts(childCandidate,{bookings:[otherChildBooking],pitches})).toHaveLength(0);
  ```
- [x] Run `capacity-planner-context.test.js` and capture failures.
- [x] Implement supplied-date parsing (no `new Date('YYYY-MM-DD').getDay()`), padded setup/clear-down reservation intervals and identity-specific self exclusion. Enabled failures surface retry/loading state and prevent committing allocations based on unknown protected bookings. Scope all asynchronous responses to club/date/permission; never replace a failed context with empty ready data. Do not touch Supabase schema/RLS/API routines.
- [x] Run that file plus `annual-planner-v310.test.js`, `annual-planner-full-pitch-weather-winter-analytics-v3106.test.js`, `ground-control-timeline-drag-v383.test.js`.
- [x] Commit intended files: `fix: share protected resource bookings with matchday scheduling`.

## Task 4: Earliest-first scoped allocation and draft persistence

**Files:** Modify `src/lib/scheduler.js`, `src/AppCore.jsx`, `src/hooks/useFixtureDayScheduling.js`, `src/components/Operations/shared/PitchClosuresCard.jsx`, `src/components/Operations/SaturdayPitchAssignmentsCard.jsx` and shared `src/pages/MatchdayPage.jsx` rebuild integration; create `src/lib/storage/matchdayScheduleDraft.js`, `tests/regression/capacity-first-rebuild.test.js`, `tests/regression/matchday-schedule-draft.test.js`, `tests/regression/capacity-rebuild-runtime.test.js`.

**Interfaces:** Extend `scheduleFixtureDay` with `club={},matchDate='',resourceContext=null,bufferYouth,bufferAdult`; extend positional wrappers only through their existing last `options` parameter. Keep output `scheduled,unresolved,metadata`. Produce `writeMatchdayScheduleDraft({context,dayKey,matchDate,scheduled,unresolved,overrides})->boolean`, `readMatchdayScheduleDraft({context,dayKey,matchDate})->object|null` and `removeMatchdayScheduleDraft({context,dayKey,matchDate})->boolean`. Capture `{userId,clubId}` at operation start; refuse a changed active tenant before writing. Keys are tenant-scoped day/date, payload `version:1`, IDs unchanged.

- [x] Write red allocator tests `free_0900_beats_later_grouping`, `earlier_alternative_beats_later_preference`, `three_areas_fill_0900_to_1300`, `zero_buffer_next_grid`, `non_grid_start_0910`, `reserve_manual_and_fixed_adult_before_flexible`, `invalid_manual_intent_is_retained_as_unresolved`, `parent_checks_every_child`, `u17_and_genuine_adult`, `twenty_rebuilds_same_id_set`, `reversal_once_away_inactive_excluded`, `distinct_similar_fixtures_preserved`.
  ```js
  expect(result.scheduled.find(x=>x.sourceFixtureKey==='source:free').koTime).toBe('09:00');
  expect(astroResult.scheduled.map(x=>x.koTime).sort()).toEqual(['09:00','09:00','09:00','10:00','10:00','10:00','11:00','11:00','11:00','12:00','12:00','12:00']);
  expect(new Set(rebuilt.scheduled.map(getFixtureFlowIdentity)).size).toBe(rebuilt.scheduled.length);
  expect(twentiethSourceIds).toEqual(firstSourceIds);
  ```
- [x] Run the three new Task 4 files. Runtime tests mount the actual scoped Matchday control with synthetic callbacks; assert Sat/Sun/Midweek each call only their callback, two immediate clicks cause one invocation, updated maxConcurrent reaches the scheduler, and a rejected resource/draft write leaves the prior schedule unchanged.
- [x] Implement fixed/valid-manual reservation pass, followed by stable age/identity ordered flexible fixtures. Search times ascending on the 15-minute grid anchored to configured start; pitch preference breaks equal-time ties. Enumerate all suitable enabled resources, reject hard failures using the shared context, and retain detailed unresolved constraints. Do not rewrite source identity or append generated schedules; retain existing apply-overrides/partition/merge boundaries. Replace hook conflict and closure displays with shared footprint/closure semantics. Keep the pure scheduler synchronous; the surrounding build callbacks await context loading and draft saving, return their success/failure, and include current date, club limits and Astro/timing settings in dependencies. The rebuild guard spans this whole asynchronous operation, including import and context loading.
- [x] Integrate a validated proposed result: persist its **local draft** before swapping the selected day state; failure leaves the old schedule. Local drafts are not published history or proof of a saved/approved week. Rehydrate only the selected tenant/day/date after authorization and before enabling edits; reject corrupt/version-mismatched drafts. Existing explicit Save Week remains the only shared publication/history action, with its existing approval policy. Do not auto-call `saveWeek` during rebuild. This makes the spec's persistence step concrete without adding a database endpoint.
- [x] Run new tests plus `scheduler-recommendations.test.js`, `fixture-venue-flow.test.js`, `scoped-rebuild-action.test.js`, `fixture-team-identity-p0.test.js` and `core-matchweek-date-control.test.js`; mocks must prove other days and tenants are untouched.
- [x] Commit intended files: `feat: rebuild earliest-first scoped schedules without parking delays`.

## Task 5: Atomic identity-owned manual allocation and history

**Files:** Create `src/lib/scheduling/fixtureMove.js`, `tests/regression/fixture-move-identity.test.js`, `tests/regression/fixture-move-runtime.test.js`; modify `src/lib/domain/fixtureVenueFlow.js`, `src/AppCore.jsx`, `src/pages/{MatchdayPage,SaturdayPage,SundayPage,MidweekPage}.jsx`, `src/components/Operations/shared/FixtureDrawer.jsx`, `src/lib/engines/{timelineDragEngine,matchdayPlannerEngine,recommendationEngine}.js` and `tests/regression/manual-parking-override.test.js`.

**Interfaces:** Produce `resolveFixtureMoveTarget(fixtures,fixtureIdentity)->{ok,fixtureIndex,fixture}|Failure`, `buildFixtureAllocationPatch({fixture,pitch,koMins,club})->object`, `validateFixtureMove({fixtures,fixtureIdentity,patch,pitchCfg,closedPitches,club,matchDate,resourceContext,readOnly})->MoveResult`, `updateFixtureOverridePatch(overrides,fixtureIdentity,patch)->object`. Add `onAllocationChange({fixtureIdentity,patch,expectedPreviousPatch}) -> {ok,reason?}` to scoped pages/drawer; AppCore revalidates against current complete day state before one state update and local-draft write. Retain existing `onOverride` for unrelated metadata and reversal actions. Add `validateFixtureMoveBatch({fixtures,moves,...sameContext})->{ok,moves,failures}`; a batch is validated cumulatively, never as independently safe stale patches.

- [x] Write red tests `away_first_drag_targets_home_only`, `postponed_first_sort_and_rebuild_do_not_retarget`, `missing_or_ambiguous_identity_rejected`, `duration_45_move_ends_1045`, `pitch_only_keeps_1007`, `metadata_and_reversal_survive`, `changed_booking_or_lock_rejects_old_preview`, `undo_uses_identity`, `batch_recommendations_cannot_conflict`, `local_save_failure_no_false_success`.
  ```js
  expect(resolveFixtureMoveTarget([away,home], getFixtureFlowIdentity(home)).fixtureIndex).toBe(1);
  expect(buildFixtureAllocationPatch({fixture:fortyFive,pitch:areaB,koMins:600,club})).toMatchObject({koMins:600,endMins:645});
  expect(applyResult.ok).toBe(false); expect(afterRejectedMove).toEqual(beforeMove);
  expect(afterValidMove.find(x=>x.id==='away')).toEqual(away);
  ```
- [x] Run the new test files; verify wrong-owner/current-duration failures before replacing the application path.
- [x] Implement exact-one identity lookup, complete allocation patches, stale previous-allocation check and atomic updates. Preserve canonical identity, reversal and metadata. Use a latest-state scoped snapshot/ref at the transaction boundary so rapid sequential applications cannot both validate against an old render. Revalidate apply/undo/redo/discard and recommendation batches against current hard constraints; do not use unrelated-index fallbacks. Feed Task 3 context into drawer/recommendations as well as timeline. Parking-only warnings remain visible but no Apply Anyway step is required; a concurrency failure remains blocked.
- [x] Run new files plus `fixture-reversal-drawer-runtime.test.js`, `manual-parking-override.test.js`, `ground-control-matchday-planner-v384.test.js`, `scheduler-direct-publish.test.js`. Rewrite manual-parking tests as actual component interactions asserting success with a visible advisory and hard blocking under schedule concurrency; keep metadata/reversal callbacks compatible.
- [x] Commit intended files: `fix: apply schedule moves atomically by stable fixture identity`.

## Task 6: Reliable calendar pointer interaction and full legal range

**Files:** Create `src/lib/engines/plannerPointerEngine.js`, `tests/regression/planner-pointer-geometry.test.js`, `tests/regression/planner-drag-runtime.test.js`; modify `src/components/Operations/shared/MatchdayTimelineCard.jsx`, `src/lib/engines/{timelineEngine,timelineDragEngine,matchdayPlannerEngine}.js` and existing `ground-control-planner-drag-v3851.test.js`.

**Interfaces:** Produce `getPlannerPointerTime({clientX,rowLeft,rowWidth,displayStart,displayEnd,grabOffsetMins})->number`, `getPlannerGrabOffset({clientX,rowLeft,rowWidth,displayStart,displayEnd,fixtureKoMins})->number`, `snapPlannerTime(value,{anchorMins,interval=15})->number`. Extend `buildTimelineMoveCandidate` with stable `fixtureIdentity`, configured legal context and optional `snapTime=true`; visual display range is not an allocation constraint. Task 5 supplies complete duration-preserving patches and commit validation.

- [x] Write red tests `whole_card_keeps_grab_offset`, `fit_quarter_half_hour_scroll_coordinates`, `0910_anchor_and_exact_pitch_only`, `1100_not_clamped_to_0945`, `preview_patch_same_time_at_window_edge`, `release_recalculates_without_pointermove`, `outside_row_does_not_commit`, `escape_cancel_unmount_lock_clear_state`, `mouse_and_touch_threshold_preserves_click`. jsdom tests mount the real card with mocked rectangles, scroll, `elementFromPoint` and pointer capture; assertions must observe callback patches and rendered feedback, not strings in source.
  ```js
  expect(getPlannerPointerTime({clientX:300,rowLeft:0,rowWidth:600,displayStart:540,displayEnd:720,grabOffsetMins:30})).toBe(600);
  expect(snapPlannerTime(595,{anchorMins:550})).toBe(595);
  expect(candidate.patch).toMatchObject({koTime:'11:00',endMins:705});
  expect(onMoveRequest).not.toHaveBeenCalled(); // cancel / outside row / stale lock
  ```
- [x] Run both new files; capture missing-offset, narrow-range and stale-release behavior.
- [x] Implement a single candidate calculation used on pointermove and pointerup. Capture initial time offset rather than card-pixel width, use current canvas/row geometry after scrolling, and re-resolve the fixture by identity. Draw/scroll the full legal range, including fixed Adult reservations and finish buffers; show empty eligible pitch rows. Snap only an intentional time move on the day grid; reject/explain unavailable edges instead of silently selecting a distant time. Use cleanup on all cancellation/lock/unmount paths.
- [x] Rerun those files and `ground-control-timeline-drag-v383.test.js`, `ground-control-planner-drag-v3851.test.js`, `ground-control-matchday-planner-v384.test.js`, `matchday-planner-layering.test.js`. Keep only useful existing static accessibility checks; behavioral tests are the proof of movement.
- [x] Commit intended files: `fix: make calendar dragging match valid scheduling windows`.

## Task 7: Playing-area and availability settings with save/load proof

**Files:** Create `src/components/Settings/PitchSchedulingFields.jsx`, `tests/regression/pitch-scheduling-settings-runtime.test.js`, `tests/regression/pitch-scheduling-persistence.test.js`; modify `src/components/Settings/PitchSettingsPanel.jsx`, `src/lib/pitches.js` only where new child creation needs stable IDs, and `src/AppCore.jsx` settings validation boundary. Do not change `supabase.js` unless a mocked round trip demonstrates a specific loss; the current `DB.savePitches` stores full objects as `data: pitch` and `loadPitches` returns row data.

**Interfaces:** `PitchSchedulingFields({pitch,pitches,onPitchPatch,onAddPlayingArea,onRemovePlayingArea,errors})`; `createPlayingAreaId(existingAreas)->string` uses an immutable generated ID, not list position. Add child via the existing creation/entitlement rules and map it explicitly to a physical unit; inherit site/surface and independent policy. Validate the entire configuration with Task 1 before invoking existing `saveTab('pitches',{pitchCfg})`.

- [x] Write red component tests `add_three_and_ten_areas`, `rename_keeps_area_and_pitch_ids`, `cannot_remove_referenced_area_or_parent`, `map_disjoint_and_alternative_layouts`, `inherit_override_closed_and_split_day_windows`, `reject_overnight_and_malformed_times`, `pitch_limit_preserved`, `training_fields_unchanged`, `filter_select_edit_correct_pitch`. Add a mocked authenticated REST save/load plus normalization round trip with exact `playingAreas`, `playingAreaIds`, `availabilityByDay`, unrelated metadata and stable IDs assertions; no live connection or SQL.
  ```js
  expect(reloadedChild.playingAreaIds).toEqual(savedChild.playingAreaIds);
  expect(reloadedParent.availabilityByDay.saturday).toEqual([{from:'09:00',to:'13:00'}]);
  expect(saveTab).not.toHaveBeenCalled(); // dangling mapping or invalid window
  expect(afterRename.playingAreas[0].id).toBe(beforeRename.playingAreas[0].id);
  ```
- [x] Run both new files and verify the editor and round-trip gaps.
- [x] Implement focused fields labelled **Playing areas** and **Available from / Available until**, separate from training controls. Show **Inherit**, **Unavailable**, or explicit per-day windows. Explain latest KO versus clear-by. Do not silently change existing layout mappings. Guard deleting/reparenting a referenced layout/area and entitlement-bound child creation before save, using the existing panel feedback. Settings save must not report success on repository failure.
- [x] Run new files plus `settings-sort-filter-runtime.test.js`, `pitch-identity-allocation-v31087.test.js`, `pitch-area-calendar-refresh-v31051.test.js`, `training-rule-scope-time-mode-persistence-v31081.test.js`. If an actual schema/API limitation appears, stop for specific approval; do not manufacture a migration.
- [x] Commit intended files: `feat: configure playing areas and day-specific availability`.

## Task 8: Integrated verification and handoff

**Files:** Create `tests/regression/capacity-scheduling-flow-runtime.test.js`, `docs/superpowers/plans/2026-10-06-capacity-first-scheduling-verification.md`; update this plan's checkboxes as evidence is collected. A local browser harness, if required, belongs under a clearly disposable scratch directory and is never deployed with test data.

**Interfaces:** Consume real Settings/Matchday/timeline components and the existing Sat/Sun/Midweek adapters, with an injected in-memory repository and synthetic fixtures. No new public API or dependency.

- [x] Add and run an integration scenario: configure three Astro areas 09:00-13:00, build twelve 45+15-minute Home fixtures, drag one valid fixture without changing another row, save/reload settings and draft, then repeat rebuild twenty times. Assert identical source-ID sets, no resource overlaps, max-concurrent compliance, no Away/inactive demand, manual move preservation and refreshed parking/officials outputs. Include a rejected stale move and a failed local save with no false success.
- [x] Run all new test files from Tasks 1-8 together, plus the explicitly listed affected legacy tests. Use `& 'D:/Program Files/nodejs/node.exe' node_modules/vitest/vitest.mjs run <explicit paths>`; record actual file/test counts and exit status. Expand only to additional affected callers where a failure or import-boundary analysis warrants it; do not automatically run the whole unrelated suite.
- [x] Run `& 'D:/Program Files/nodejs/node.exe' node_modules/typescript/bin/tsc -b --pretty false`; expect exit 0, no TypeScript errors.
- [x] Run `& 'D:/Program Files/nodejs/node.exe' node_modules/vite/bin/vite.js build`; expect exit 0 and complete `dist/index.html` plus referenced assets. Run `git diff --check`; expect clean output.
- [x] Before starting a local server/browser, read the applicable browser/computer-use and browser-verification skills. Verify with isolated in-memory data the real settings save/reload and mouse/touch drag at multiple zoom/scroll positions, including a separate-area concurrent drop and parent clash. Capture actual console errors and visible results. Do not use the club's real data to exercise rebuilds, or claim browser success from HTTP/build checks alone. Record any unavailable authenticated/device coverage honestly.
- [ ] Use the requesting-code-review skill after implementation; for the proposed Native method, one fresh independent reviewer checks the complete intended diff against the approved spec. Address substantive issues with failing tests and rerun affected checks. Do not spawn implementation agents unless the user selects Subagent-driven execution.
- [ ] Commit only final verification documentation and intended last corrections; report root causes, scope/files, tests, TypeScript/build and browser status. No push, Vercel deployment, production promotion or live migration is included; request release direction after verification.

## Execution handoff

Recommended approach: **Native** (implement in this session, then one independent whole-branch review), keeping context and usage lower across tightly coupled resource/move interfaces. **Subagent-driven** remains available if the user wants per-task independent reviews at higher context cost.

Execution was approved inline. Tasks 1–8 have been implemented and checked locally; the final independent review is the remaining completion gate at this checkpoint. Release and live-data actions remain outside this plan.
