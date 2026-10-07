# Capacity-first scheduling verification

Local branch: `referee-flow-staging`. Implementation baseline: `473cc3f`.
No live fixture writes, rebuilds, schema changes, pushes or deployments were performed.

## Behaviour and root causes

- Initial allocation previously mixed parking pressure with hard scheduling constraints. It now searches legal times earliest-first across all eligible pitches; parking remains advisory.
- Structural parent links previously treated all sibling layouts as overlapping. Explicit immutable playing-area mappings now distinguish disjoint layouts, alternative overlapping layouts, and whole-parent occupancy. Legacy unmapped children stay conservative.
- Different build/move/recommendation paths used different timing, resource and duration rules. They now consume shared dated hard constraints and protected Annual Planner context.
- Manual updates and history used stale array positions or partial pitch/time patches. Moves now resolve exactly one stable source identity, revalidate the fresh day, preserve duration and persist a tenant/date draft before committing state.
- Drag coordinates previously lost the grab offset, reused the last move event, or clamped to a narrow visual range. Current release geometry, day-grid anchoring and explicit cancellation now determine the full legal candidate.

## Evidence

| Check | Result |
| --- | --- |
| Combined bounded regression run after final review | 41 files, 225 tests passed, exit 0 |
| TypeScript project check | Exit 0, no diagnostics |
| Vite production build | Exit 0; existing large-chunk warning remains |
| Root build assets | 16/16 referenced assets exist in `dist`; no deployment inferred |
| Whitespace check | `git diff --check` clean |
| Authenticated pitch JSON round trip | Mock REST repository preserves mappings, availability, IDs and unrelated metadata; no Supabase implementation change |
| Integrated synthetic flow | Real Settings + timeline components; twelve Home fixtures fill three areas 09:00–13:00 with 45+15 minute occupancy; twenty rebuilds preserve the source set, valid manual move, no clashes, local reload, 12 parking/officials fixtures, Away/postponed exclusion, stale and failed-save rejection |
| Browser UI | Actual Codex in-app browser opened isolated local Vite harness. Native keyboard availability editing and Save/reload; 12 fixtures; parent-overlap drag blocked; scrolled Fit-day drag moved `source:11` to P2 at 13:00; 30-minute zoom drag moved `source:0` to P3 at 12:15 concurrently with separate areas; reload/rebuild preserved the move; stale request rejected. Console warn/error query returned `[]`. |

The first browser navigation timed out, but binding the created tab showed the loaded application. Browser `fill` for a time field changed the DOM without notifying React in this connection; native arrow-key editing updated state and saved correctly. No application workaround was added for that automation limitation.

The fully packed twelve-fixture test has no free slot before 13:00. It explicitly extends only the synthetic availability window to 14:00 before exercising a legal time move. Other tests cover rejection of a fully occupied window.

Physical touch hardware was not tested. Mouse/touch pointer semantics, threshold, cancellation, fresh release and four zoom/scroll geometries are covered by real-component jsdom tests. Authenticated deployed Operations was not tested; browser proof is the isolated synthetic UI, not staging or production.

## Independent review and final fix pass

One independent whole-branch review found eight Important issues and one initially Minor wrong-fixture editing issue, upgraded to Important. All nine were addressed in one author fix pass with observed failing reproductions followed by passing targeted tests. The final affected suite, TypeScript, production build and 16/16 root asset checks were rerun after those corrections.

| Review finding / root cause | Correction and evidence |
| --- | --- |
| Nested weekend timing overrode Midweek timing in build/preview/apply | Shared `withDayTiming` overlays both timing representations; real Midweek page accepts the exact 18:10 pitch-only move |
| Typed drawer time was treated like a drag-grid candidate | Typed 10:07 is preserved; pointer dragging still uses its anchored grid |
| One date key rehydrated all days and stale drafts overwrote explicit history | Per-day hydration keys, persisted current metadata, authoritative history drafts for both effective weekend dates; real AppCore restore/reload/rebuild tests |
| Manual canonical inputs were absent from the draft | Persist and restore `manualFixtures`; real AppCore reload and rebuild retains the friendly exactly once |
| Manual form created a mutable fallback identity | Assign immutable manual source IDs at creation; safely upgrade unique old drafts and report ambiguous legacy inputs without modifying them |
| Unresolved assignments bypassed shared constraints and persistence | Remove duplicate structural/parking/duration rules and clash override path; shared exact-identity move transaction atomically transfers one unresolved record only after save; real card covers closed windows, protected bookings, disjoint sibling areas, zero buffer, double submission and save failure |
| Any metadata override pinned an automatic allocation | Only pitch/time override fields mark allocation intent; referee-only edits allow earliest-time rebuilding |
| Calendar and officials consumers had narrower inactive checks | Shared lifecycle policy excludes void/withdrawn/explicit lifecycle inactivity from calendar pitch reservations and referee demand while keeping visible calendar entries; Home/Away control cases |
| Full drawer selection used array position | Selection now follows exactly one canonical source identity across list reordering |

The final browser reconnect failed before UI reads with `failed to write kernel assets: The system cannot find the path specified. (os error 3)`, including after one session reset. The earlier browser evidence above predates the final fix pass. Final corrections were verified through actual React component/runtime and AppCore state tests, not a fresh browser session. No authenticated deployed UI claim is made.

## Remaining release gates

- Independent whole-branch review and substantive local fixes: complete; no second review pass was dispatched.
- No release authorization is implied. Explicit Save Week remains publication; local schedule drafts are not saved/approved matchweeks.
- Existing independent-pitch policies remain, but explicit `independent: false` now wins over legacy Astro defaults. Referee-aware automatic allocation remains deferred; existing manual referee checks remain.
- Configure physical units and child mappings explicitly before relying on sibling concurrency. New child layouts count toward the existing pitch entitlement.

## Rulings I made (execution order)

- Task 8: Ruling: The synthetic twelve-fixture test completely fills three areas from 09:00 to 13:00. Extend the test-only window to 14:00 before testing a legal time move — a full four-hour plan has no empty slot to move into — cost if wrong: extra-hour availability, not a swap, is exercised; packed-window rejection has separate coverage.
- Ruling: Native worktree creation reports Not a git repository for this nested mirror checkout. Work in place on the requested feature branch; do not create unmanaged phantom worktrees — native harness cannot attach this repository — cost if wrong: reduced isolation, mitigated by named-file commits and preserved unrelated changes.
- Ruling: The provided workspace/task scripts require Bash, unavailable on this host. Use a plan-local PowerShell equivalent and the same ledger/brief/result contracts — avoid installing tooling — cost if wrong: bookkeeping differences, not product behavior.
- Ruling: Run bounded affected regression suites, not the unrelated full suite — approved plan expressly scopes verification — cost if wrong: an unlisted dependent regression may escape; final review checks import boundaries.
- Task 2: Ruling: Legacy pitch-suggestion test scheduled the same team twice at the same time; use distinct teams to isolate pitch availability — the new approved team-clash constraint correctly rejects the old scenario — cost if wrong: test data no longer covers an impossible same-team pitch-only fix.
- Task 1: Ruling: Explicit independent:false wins over legacy AST defaults; unmapped child independence inherits at constraint time — required to keep resource separation independent of club concurrency exemptions — cost if wrong: explicitly non-independent Astro configurations are now counted.
- Task 3: Ruling: Preserve existing timeline occupancy now instead of waiting for Task 5 — Task 2 classification exposed a legacy recalculation discrepancy and the approved move contract preserves the valid current duration — cost if wrong: malformed existing durations remain until rebuild validates them.
- Task 3: Ruling: Integrate AppCore context loading with Task 4's async draft transaction rather than temporarily clearing schedules on context failure — that is one atomic build boundary — cost if wrong: protected rebuild integration is incomplete until Task 4.
- Task 4: Ruling: Add prepareScopedScheduleDraft as a testable async transaction adapter, not a second scheduling engine — reuse the existing allocator and reconciliation, persist before replacing UI state — cost if wrong: one additional small boundary to maintain.
- Final: Ruling: Upgrade full-drawer array-index retargeting from Minor to Important — a reordered list could edit another fixture, so it is substantive user impact — cost if wrong: one extra focused fix and regression, no polish expansion.
- Final: Ruling: Refuse ambiguous legacy manual draft identity upgrades and leave the stored draft unchanged — absent immutable IDs cannot safely prove which allocation/override belongs to two similar inputs — cost if wrong: an old draft requires review rather than automatic recovery.
- Final: Ruling: Leave live authenticated tenant, database/RLS and protected-booking integration unverified — this approved pass is local/synthetic and has no data-change authority — cost if wrong: environment-specific integration failures may remain before release.
- Final: Ruling: Cover touch semantics with component pointer events, not physical touch hardware — this Windows session has no testable touch device — cost if wrong: device-specific gesture behavior is not proven.
- Final: Ruling: Do not infer deployment readiness or release from a local build/browser — pushing, staging promotion and live Operations verification require a separate release gate — cost if wrong: local work is not available to club users until deployed.
- Final: Ruling: Report final browser reconnect as unavailable rather than invent fresh UI proof — kernel asset creation fails before browser reads, including after one reset — cost if wrong: final corrections lack a fresh real-browser check despite passing real-component runtime tests.
- Final: Ruling: Preserve the requested staging branch rather than invent a merge base or PR integration menu — the approved plan explicitly excludes integration and requests staging release direction after local verification — cost if wrong: the separate staging release still needs user approval.

## Deferred minors

None. The sole initially Minor finding was upgraded to Important and fixed.
