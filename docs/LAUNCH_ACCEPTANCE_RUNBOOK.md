# Ground Control launch acceptance runbook

Use this runbook after every launch-candidate deployment. Automated tests prove package rules and code integrity; they do not replace real account, browser and operational evidence.

## 1. Package and access accounts

Use separate staging accounts for Core, Pro, Elite, viewer/read-only, suspended and invalid-plan scenarios.

| Check | Core | Pro | Elite |
|---|---:|---:|---:|
| Day scheduling | Yes | Yes | Yes |
| Cross-day Operations Overview | Upgrade notice | Yes | Yes |
| Matchweek Timeline | Upgrade notice | Yes | Yes |
| Core analytics | Yes | Yes | Yes |
| Funding evidence and advanced analytics | Upgrade notice | Yes | Yes |
| Operational reports and CSV | Yes | Yes | Yes |
| Advanced and funding reports | Upgrade notice | Yes | Yes |
| Multi-venue limits | 1 | 3 | Unlimited |

Confirm that viewer and suspended accounts can read permitted data but cannot save schedules, contacts, communications, settings or funding evidence. Confirm an invalid plan fails closed and shows no customer capability.

## 2. End-to-end matchweek proof

Run one realistic matchweek from start to finish:

1. Import or enter fixtures.
2. Build Saturday, Sunday and Midweek where enabled.
3. Resolve pitch, official, parking and competition-rule warnings.
4. Save the matchweek.
5. Reload it from history.
6. Compare Operations, day pages, Matchweek Timeline and Reports.
7. Prepare coach messages.
8. Send one authorised staging email and verify provider acceptance and delivery.
9. Confirm duplicate protection does not create a second provider request.
10. Generate operational and funding evidence reports.

Record every mismatch as a defect. A schedule, timeline, report or communication that disagrees with the saved matchweek is a launch blocker.

## 3. Responsive checks

Check Mission Control, Operations, Analytics, Reports, Communications and Settings at:

- 1366 × 768 laptop;
- 1024 × 768 tablet landscape;
- 768 × 1024 tablet portrait;
- 390 × 844 mobile.

Confirm that tabs remain usable, menus are not clipped, primary actions remain visible, long club/team names wrap safely, tables can be scrolled, and sticky save controls do not cover fields.

## 4. Keyboard and accessibility checks

- Reach every interactive control using Tab and Shift+Tab.
- Confirm a visible focus state.
- Activate buttons and tabs with Enter or Space.
- Confirm dialogs trap focus and Escape closes non-destructive dialogs.
- Confirm selected tab state is exposed to assistive technology.
- Confirm error messages identify the failed field or action without relying only on colour.

## 5. Security and privacy evidence

Retain proof for:

- organisation isolation and RLS;
- role and subscription enforcement;
- coach-contact visibility;
- communications audit and provider status;
- privacy notice, lawful basis and retention settings;
- data export and deletion;
- server-only provider and Supabase secrets;
- no child contact details in coach communications.

## 6. Release evidence

Run:

```powershell
npm run acceptance:launch
npm run release:evidence
```

Store the generated `.release-evidence` artefacts against the launch gate. Mark the release ready only when automated checks pass and the manual evidence above has been completed.
