# Daxora Ground Control launch-gate evidence register

**Audit date:** 24 August 2026

**Production release:** `9bbbb4d`

**Production URL:** <https://app.daxora.co.uk>
**Audit rule:** a gate is Ready only where current, definitive evidence proves the full wording of the gate. A runbook, implementation or automated check does not stand in for a required rehearsal, professional review or human sign-off.

## Evidence generated for this audit

- Automated release evidence: PASS — lint, 893 regression tests across 176 test files, launch-acceptance matrix and production build.
- Production HTTPS smoke: PASS — HTTP 200, React mount point, no deployment placeholders, HSTS, framing protection, Referrer-Policy and `nosniff` confirmed.
- Pilot-hardening evidence: PASS — 22 of 22 checks, including production health READY, recovery controls, diagnostics, security headers, accessibility and runbook presence.
- Subscription/access acceptance: PASS for all automated scenarios — Core, Pro, Elite, read-only, suspended and invalid-plan fail-closed behaviour.
- Production deployment: Vercel deployment `dpl_5bNUztbyinfs4UjNcUrzakUhBfsH` reached READY and was aliased to <https://app.daxora.co.uk>.
- Production database: local and linked Supabase migration histories aligned through `202608240001` at the time of audit.

## Gate-by-gate assessment

| Gate | Recommended status | Evidence / remaining action |
|---|---|---|
| Security and tenant-isolation verification complete | In progress | Application security tests and fail-closed access scenarios pass. Keep open until the cross-club RLS staging proof is recorded against real isolated test accounts. |
| Production backup and restore test completed | Not started | Runbooks require a restore rehearsal, but no dated authenticated production restore exercise was found. Perform and record a controlled Supabase restore rehearsal. |
| Production environment and secrets configured | Ready | Production health is READY; required Supabase, communications, Resend and automation configuration names exist in Vercel; production HTTPS and deployment checks pass. |
| Error monitoring and alert ownership confirmed | In progress | Client-event capture, system health, recovery references and support diagnostics are present. Record the named alert owner and prove receipt/escalation of one test alert. |
| Incident response and escalation runbook rehearsed | In progress | `docs/INCIDENT_RESPONSE_RUNBOOK.md` exists and recovery controls pass. Record a timed tabletop rehearsal, participants, outcome and follow-up actions. |
| Commercial and privacy documents professionally reviewed | Blocked | Current legal documents explicitly remain drafts for professional review. Do not mark Ready until reviewed, completed and published at final HTTPS URLs. |
| Stripe test-mode checkout, portal and webhooks verified | Not started | Implementation/runbook exists, but the repository states that Stripe products, portal and webhook configuration remain to be completed and tested end to end. |
| Pilot support channel, response targets and case workflow confirmed | In progress | Support tooling, diagnostics and incident runbook exist. Confirm the live support channel, named owner, pilot response targets and one test case from submission to resolution. |
| Initial pilot club and accountable owner confirmed | Ready | Horwich St Mary's FC is the named controlled pilot and the club-owner workspace is active. |
| Pilot training and operational handover completed | Not started | Training/handover must be a real recorded event. Capture attendees, date, scope, fallback process and acceptance. |
| Production smoke test passed on desktop and mobile | In progress | Automated production HTTPS smoke passes. Complete and record authenticated desktop and mobile flows before Ready. |
| Launch decision recorded with outstanding risks accepted | Not started | Final decision must follow the pilot cycles and include named acceptance of outstanding risks. |
| Production-like staging environment configured and accessible | In progress | Production is healthy and production-like deployment controls exist. Record a dedicated staging URL and authenticated staging access proof rather than using production as a substitute. |
| Automated lint, test and production-build evidence recorded | Ready | Fresh evidence PASS for release `9bbbb4d`; 893 tests pass and the production build succeeds. |
| Cross-club Row Level Security isolation test passed on staging | In progress | RLS regression coverage exists. Run the supplied authenticated staging database isolation test and retain its dated output. |
| Funding document storage and signed-link isolation verified | In progress | Security implementation and repository checks exist. Complete a two-club staging test proving upload, signed-link expiry and cross-club denial. |
| Staging smoke test passed over HTTPS | In progress | The smoke runner passes against production. Re-run against the dedicated staging URL and attach that result before Ready. |
| Horwich St Mary's historical replay completed | Not started | Record an actual completed historical replay session with fixture totals, automatic/manual resolutions, warnings, defects and time saved. |
| Horwich St Mary's shadow-live cycle completed | Not started | Run alongside the existing club process and record comparison results without using Ground Control as the sole operational source. |
| Horwich St Mary's controlled-use cycle completed | Not started | Complete the live controlled-use weekend with fallback retained; record findings and resolution status. |
| Horwich St Mary's pilot decision and sign-off recorded | Not started | Requires the completed pilot sequence, named signatory and explicit pass/conditional/fail outcome. |
| Core, Pro, Elite and restricted-access acceptance completed on staging | In progress | All 12 automated package/access checks pass. The gate metadata also requires real staging-account evidence for Core, Pro, Elite, read-only, suspended and invalid-plan scenarios. |

## Safe completion order

1. Record the fresh automated evidence and production-environment evidence.
2. Establish and smoke-test the dedicated staging URL.
3. Complete real-account subscription and cross-club security tests on staging.
4. Rehearse backup restore, monitoring escalation, incident response and support case handling.
5. Run the HSM historical replay, shadow-live and controlled-use sessions in order.
6. Complete training/handover and authenticated desktop/mobile production smoke.
7. Obtain professional legal/privacy review and complete Stripe test-mode acceptance before paid launch.
8. Record the final pilot sign-off and launch decision last.

## Evidence integrity note

No gate requiring a professional opinion, destructive-recovery rehearsal, real user session or accountable-owner decision was marked Ready from code presence alone. This prevents the launch dashboard from presenting false assurance during the pilot.
