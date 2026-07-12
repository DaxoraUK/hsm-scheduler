# Ground Control real-account subscription acceptance

This runbook proves the customer experience against actual staging accounts. The automated acceptance script proves only the package catalogue and shared access helpers.

## Safety rules

- Use the isolation-test club rather than the HSM pilot workspace wherever possible.
- Keep the staging email pilot redirected to the internal adult test inbox.
- Record screenshots or deployment links for every result.
- Restore the test club to its intended plan after each scenario.
- Do not mark the subscription launch gate Ready until every scenario has passed or has an explicitly accepted risk.

## Evidence location

Open **Platform Admin → Pilot & launch → Subscription launch acceptance**.

Run:

```powershell
npm run acceptance:launch
```

Use **Use as evidence** to prefill the automated package-contract result, then add real-account evidence through the structured launch-evidence form.

## Scenario 1 — Core

Assign the isolation-test club to **Core / Active** and sign in as a club owner or administrator.

Confirm:

- Mission Control, Saturday, Sunday, Midweek and Communications open.
- Day scheduling, pitch intelligence, parking, weather and officials work.
- Core Analytics and operational Reports open.
- CSV export is available.
- Operations Overview and Matchweek Timeline show a Pro upgrade state.
- Funding Analytics and advanced report types show a Pro upgrade state.
- Limits display 15 teams, 1 venue, 5 users and 15 pitches.

## Scenario 2 — Pro

Assign **Pro / Active**.

Confirm:

- Every Core workflow still works.
- Operations Overview and Matchweek Timeline open.
- Advanced Reports and Funding Analytics open.
- Multi-venue configuration allows up to 4 venues.
- Limits display 40 teams, 4 venues, 15 users and 50 pitches.
- No Elite-only promise or support claim appears.

## Scenario 3 — Elite

Assign **Elite / Active**.

Confirm:

- Every Pro route and action opens.
- Teams, venues, users, pitches and history display Unlimited.
- No Core or Pro upgrade prompt appears.
- The package wording describes scale and tailored implementation without claiming an unimplemented service level.

## Scenario 4 — Read-only club role

Use a viewer membership on a Pro workspace.

Confirm:

- The user can inspect permitted information.
- Build, save, publish, contact-edit, send and funding-edit controls are disabled or hidden.
- The interface explains the restriction before the user attempts a save.
- A manually replayed write request is rejected by Supabase.

## Scenario 5 — Suspended subscription

Set the isolation-test club to **Suspended**.

Confirm:

- The workspace clearly states that access is restricted.
- Existing data remains visible where intended.
- Schedule, contact, communication and funding writes are rejected.
- Reactivating the club restores only the assigned plan's entitlements.

## Scenario 6 — Invalid plan safety

This is normally proved through the automated test and a controlled database fixture, not by damaging a live subscription row.

Confirm from the generated evidence that:

- an unknown plan becomes **Unverified plan**;
- no customer route opens;
- no mutation or export capability is granted;
- the user receives a safe support message.

## End-to-end workflow

After the plan scenarios, complete this journey with a Pro staging account:

1. Import or enter fixtures.
2. Build the schedule.
3. Resolve pitch, parking and officials issues.
4. Save the matchweek.
5. Reload it from history.
6. Verify Operations and Matchweek Timeline agree.
7. Prepare coach messages.
8. Send one redirected staging email and confirm provider delivery.
9. Generate operational reports.
10. Create a funding project, record impact evidence and download an application evidence pack.

## Sign-off

Record:

- operator;
- date and staging release;
- account and club used;
- screenshots or deployment links;
- defects and workarounds;
- final result: Pass, Conditional or Fail.
