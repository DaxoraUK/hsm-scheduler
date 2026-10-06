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
| Combined bounded regression run | 32 files, 174 tests passed, exit 0 |
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

## Remaining release gates

- Independent whole-branch review and any substantive findings: pending at this checkpoint.
- No release authorization is implied. Explicit Save Week remains publication; local schedule drafts are not saved/approved matchweeks.
- Existing independent-pitch policies remain, but explicit `independent: false` now wins over legacy Astro defaults. Referee-aware automatic allocation remains deferred; existing manual referee checks remain.
- Configure physical units and child mappings explicitly before relying on sibling concurrency. New child layouts count toward the existing pitch entitlement.
