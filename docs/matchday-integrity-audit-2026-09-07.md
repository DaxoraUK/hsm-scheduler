# Matchday integrity audit and release evidence

Status: **release acceptance pending authenticated staging workflow**. Baseline: `6e2279e1d98cedda0eb193c1279281d0a0af02c7`. Changes are not yet committed or pushed. This records the audit findings reported before implementation and current verification; automated checks are not a substitute for browser acceptance.

## State ownership and precedence

| Layer | Owner / persistence | Consumer and precedence |
| --- | --- | --- |
| Provider facts | Configured Full-Time source snapshots in club configuration | Canonical provider identity survives KO/date/venue changes; refresh reconciles covered dates. The narrow fixture-evidence RPC may update snapshots, health and reconciliation evidence, not source URLs or unrelated settings. |
| Explicit intent | `matchday_scheduling_states`, keyed by club, day scope and date; intent entries keyed by canonical identity | Venue/lifecycle/exclusion/official intent applies to the canonical fixture. Locked allocation overrides generated allocation. Cloud revisions, including an empty intent map, take precedence over legacy club JSON. |
| Generated allocation | Canonical scheduling build output | Replaceable on rebuild; never converted into a manual lock by saving operational evidence. Eligibility configuration and explicit occupancy timing travel with this output. |
| Calendar draft | Ordered in-memory transaction over the base effective schedule | Pending mutations are replayed for the proposed schedule. Undo/Redo replays the same sequence; Discard removes pending intent. Final batch uses the canonical mutation/persistence path. |
| Effective allocation | `resolveEffectiveAllocation` | Provider/canonical fixture, then derived allocation, then locked intent, then pending patch. A newer text KO replaces old numeric KO and cached end time. |
| Saved operational evidence | Atomic `commit_matchday_schedule`: intents, manual fixtures, operational snapshot, History and audit | Revision check and shared day lock checked server-side. Snapshot is output evidence, not implicit user intent. Saved snapshot supports rehydration and reports. |
| Lock | Shared database matchday lock; one `useMatchdayLocks` hook | Mission Control and Operations consume the same lock. Authorised Unlock permits edit/save/relock; lock transition is audited. |
| Publication | Separate publication RPC and revision | Save does not call publication or require its approval. Publication capability is enforced independently. |
| History / reports / analytics | Latest saved operational evidence for the selected scope/date | Event-only entries do not replace saved schedules. Latest empty saved day removes older fixture evidence. Annual Planner matchday mirrors are excluded from duplicate analytics evidence. |

## Defect matrix

All live-browser proof cells below remain pending on the updated candidate unless explicitly stated.

| Defect | Root cause / code path | Repair | Automated proof | Live-browser proof |
| --- | --- | --- | --- | --- |
| Optimiser-valid pitch labelled unsuitable | `effectiveAllocation` discarded scheduler `cfg` and timing, so downstream eligibility lacked format | Preserve derived eligibility configuration and occupancy timing | `matchday-boundary-integrity`: U16 Cheetahs/P1 and U12 Rockets/P3 | Pending |
| Old 10:45 allocation despite 11:45 display | Text-only intent merged old `koMins` and `endMins` | Normalise each latest KO patch and recompute occupancy at the shared resolver | Boundary tests cover text move, stored numeric intent and stale end | Pending |
| Locked day cannot be unlocked from Operations | Mission Control used local lock state while Operations lacked a shared Unlock entry point | Shared lock hook and Operations lock/unlock controls; server enforcement retained | `matchday-lock-lifecycle` and rollback SQL save/lock/unlock contract | Pending |
| Save coupled to publishing | Mission Control `useWeekPersistence` selected publishing authority and legacy workflow | Canonical Save callback uses operating capability; Publish stays separate | `matchweek-save-routing`; database owner/scheduler save and publish with no new approval requests | Pending |
| Assigned scheduler denied server writes | Database recognised only the primary membership role | Capability helper also recognises active club-scoped FixtureOfficer/OperationsOfficer assignments | Assigned-capability SQL: grants/revocation, admin, inactive membership, foreign club | Pending |
| Provider refresh requires administrative settings authority | Refresh called generic club configuration save | Narrow authorised provider evidence RPC with expected-snapshot check and same-transaction History | `scheduling-state-persistence`; provider SQL validates settings preservation and stale/unknown source rejection | Pending |
| Unknown provider source accepted | Correlated SQL subquery's unqualified `value` resolved to the inner source, creating a self-comparison | Explicit outer/inner aliases | Failing rollback assertion reproduced, then passed after follow-up migration | Not a UI-exposed selector; RPC regression |
| History absent for scheduling work | Canonical intent writes and legacy History snapshots were separate paths | Atomic canonical commit includes operational evidence and History; refresh/lock/publication events recorded | Commit-boundary tests and staging rollback SQL history/audit assertions | Pending |
| Manual assignment false success | Persistence result alone did not establish that requested allocation became scheduled | Commit preparation checks changed locked identities against the actual final scheduled result | `matchday-commit-boundary` rejects requested fixture remaining unresolved | Pending |
| Calendar uses obsolete occupancy | Validation previously resolved stale numeric/end state instead of latest pending allocation | Replay ordered transaction and resolve final effective occupancy | Saved workflow: vacated slot, third move, Undo/Redo, Discard, exact five-minute KO, ten rebuilds | Pending |
| Print collapses many fixtures to one | Evidence key preferred common feed `sourceId` | Canonical/provider fixture identity before legacy row fallbacks | Boundary regression prints 18 unique fixtures sharing one feed | Multi-page visual printing pending |
| Reports/analytics resurrect old or excluded fixtures | Multiple saved versions and generated Annual Planner mirrors merged together | Latest saved day is authoritative, including empty output; omit generated matchday mirrors | `saved-matchday-evidence-integrity`, saved workflow exclusion/restore/report IDs | Pending |
| Inflated downtime/unused availability | Opening hours spanned morning/evening gaps; closures counted full elapsed and overlapping/out-of-hours periods | Union actual opening windows; clip and union closure intersections | Saved evidence/analytics regression tests | Pending |
| Referee source/status disagreement | Legacy display source could be confused with confirmation | Reports consume common source/status mapping, preserve canonical official intent | Saved workflow retains confirmed club appointment after ten rebuilds; existing officials regressions | Pending |

## Occupancy and analytics formulas

Game Length is playing duration. Shared pitch occupancy is **playing duration + explicit half-time + configured turnaround**. Existing team `halfTimeMins` is used where configured; its default is zero, not a newly assumed allowance. Scheduler turnaround is its format buffer (fallback 5 minutes); legacy resolver fallback remains compatibility-only. Scheduler attaches timing to its output so downstream consumers do not apply an unrelated default or count turnaround twice. Linked/full/half pitches share occupancy via the pitch registry, not an additional hidden buffer.

Domain candidate granularity is five minutes. The remaining Calendar input step of 900 seconds was changed to 300. Visual grid markers may remain fifteen minutes; they are not scheduling slots. Imported KO facts remain exact.

For the selected reporting date range and configured pitches:

- Configured availability = sum of the union of each pitch's opening windows on each date.
- Downtime = duration of the union of closures intersected with those opening windows and the reporting range.
- Usable availability = max(0, configured availability - downtime).
- Unused availability = max(0, usable availability - used facility hours).
- Utilisation = used facility hours / usable availability * 100; the legacy zero-capacity-with-usage result remains 100%.
- Facility hours account for pitch area capacity; team hours are separate evidence, not extra pitch occupancy.
- Closure category attribution is deterministic (weather, maintenance, other); overlapping closures do not double-count total downtime.

## Verification checkpoint, 7 September 2026

- Full regression suite: **210 files, 1,032 tests passed**.
- TypeScript: passed (`tsc -b`).
- Production build: passed; existing >500 kB chunk warning remains.
- Local startup: current build's public landing page rendered, no captured browser error logs.
- Local root and all 14 JS/CSS references in root HTML: HTTP 200.
- Analytics and Speed Insights remain in the application bundle; root mounting preserved.
- Three staging database rollback contracts passed. Post-check: zero test-day state rows, zero test-day History rows, no provider test marker.
- Normal staging alias has not been promoted to these uncommitted changes.
- Full authenticated staging acceptance, visual print pagination, commit, push and final alias verification: **pending**.

## Release protection

### Resumption checkpoint, 11 September 2026

- Working tree and baseline remain unchanged; no commit or push performed.
- Full suite rerun: 210 files / 1,032 tests passed. TypeScript and production build passed again (same large-chunk warning).
- Candidate `dpl_FEWQWV1Sh593aVjG5QRuW4rNdBxc`, `https://daxora-ground-control-staging-kzo38xnaq-daxora.vercel.app/`, is the uncommitted QA build from 7 September. The browser restored normal authenticated access as Andrew Manville, Club Owner; Ground Control and Operations rendered.
- On 7 September the 5 September Unlock action changed the Operations control from Unlock to Lock and enabled rebuild. Remaining live workflow was not completed.
- On resumption, Operations loaded a built **12 September** matchday: 14 visible fixtures and 1 unresolved. Read-only database check found revision 4 with 15 saved canonical identities, updated 7 September at 09:03 UTC. The 5 September state remains revision 2 without a new operational snapshot.
- Switching dates was blocked by browser safety review because it clears current in-memory schedule state. Source inspection confirms date navigation clears React state, not database records; no 12 September mutations were performed in this session. Explicit approval to switch away from this built matchday is requested before continuing 5 September QA.
- Security advisors flag the deliberately authenticated SECURITY DEFINER RPCs for review. They retain explicit capability/tenant checks, fixed search paths and anonymous-execute revocation. The five affected data tables retain RLS. This is not a claim that all pre-existing project advisor warnings are resolved. [Advisor guidance](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable).

Only `daxora-ground-control-staging` / `prj_zT47A515NfONCjTPw2hb4PjJ4dZG` on Daxora may receive candidate/release deployments. Supabase target is `gbefhieunbpxhzshxtba` (Daxora Ground Control Staging). No real production project or Supabase credentials are changed. Tool-generated changes to `.gitignore` and `supabase/.temp/cli-latest` were restored and are not part of this change. The unrelated existing planning document is excluded from the release.
