# League Operations v3.5.2 — Real Rules and Schedule Assurance

## Purpose

v3.5.2 closes the gap between a demonstration scheduler and a real league competition engine. Each division can now define one, two, three or four meetings per pairing, and the schedule is checked against that exact competition contract before publication.

## Competition formats

- **One meeting:** one complete round-robin with balanced home and away allocation.
- **Two meetings:** one home and one away fixture for every pairing.
- **Three meetings:** one home-and-away pair plus an additional fixture. The extra host reverses automatically in the following season.
- **Four meetings:** two complete home-and-away pairs.

The division setting **Odd-meeting home cycle** allows an inherited or historic cycle to be inverted without changing the season. The setting is stored as `extra_home_rotation_offset` and is restricted to `0` or `1`.

## Scheduling engine changes

The engine now:

1. Builds a complete deterministic round-robin matrix.
2. Balances the first cycle using exact per-team home targets.
3. Preserves that balanced cycle as the competition contract.
4. Reverses even meetings and the next season's extra odd meeting.
5. Optimises full home-and-away pairs without changing the odd-meeting host contract.
6. Handles odd team counts without creating fake bye fixtures.

The preflight summary exposes, per division:

- active teams;
- meetings per pairing;
- expected fixtures per team;
- expected total fixtures;
- required rounds;
- available playing dates;
- reserved and closed dates;
- odd-meeting rotation state;
- whether the configured calendar can contain the programme.

## Browser-side assurance

Before a draft can be published, League Manager checks:

- every required pairing and meeting number exists;
- no pairing or meeting number is duplicated;
- no fixture exists outside the division format;
- every team has the correct fixture total;
- home and away allocations follow the season cycle;
- fixtures are placed on valid playing dates;
- teams, venues and shared grounds are not double-booked;
- blackouts and cup reservations are respected;
- unresolved fixtures remain publication blockers;
- excessive consecutive home or away runs are reported.

The Schedule workspace includes a visible **Competition-format assurance** table before the version controls.

## Server publication guard

Migration `202607140006_league_schedule_assurance_and_v352_ux.sql` adds a second, server-controlled structure validation layer. It verifies exact pairing counts, valid meeting numbers, team totals, division membership and home/away balance. The public validation and publication RPCs combine these checks with the existing date, venue, blackout, cup and capacity validation.

A browser modification or direct API call cannot bypass these checks. A draft with any blocking issue cannot be published.

## Operator UX improvements

v3.5.2 also completes the remaining operational refinements:

- league-wide search for divisions, clubs, teams, grounds, fixtures, cup ties and officials;
- persistent schedule, fixture-command and results filters;
- persistent League Structure, Availability and Fixture Records sub-pages;
- shared unsaved-change warnings for registry records and schedule edits;
- URL-aware workspace navigation and browser back/forward support;
- clearer empty search results and schedule issue explanations.

## Acceptance criteria

The release is accepted when:

1. Divisions configured for one to four meetings generate the exact expected totals.
2. Odd team counts produce the correct fixture total and no bye records.
3. The third meeting reverses host when the season rotation seed changes.
4. Removing or adding a fixture produces a blocking validation issue.
5. Server validation rejects the same malformed draft.
6. League-wide search opens the correct workspace.
7. Filters survive a refresh.
8. Leaving a dirty record or schedule prompts before discarding work.
9. Full regression tests and the production build pass.
