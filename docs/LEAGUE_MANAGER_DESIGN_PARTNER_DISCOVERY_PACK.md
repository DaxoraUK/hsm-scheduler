# Daxora League Manager — Design Partner Discovery Pack

## Purpose

This pack is for the first structured conversation with a pilot league. The aim is to reproduce the league’s real fixture-building process before asking it to change that process.

The pilot is focused on season league-fixture scheduling, ground-sharing intelligence, blackout enforcement, exceptions, version control and publishable exports. It is not a player-registration, discipline, payment or referee appointment system.

## Information to request before the first workshop

Ask the league to provide the latest available versions of:

- Current season divisions and teams
- The parent club behind each team
- Home ground or venue for every team
- All known ground-sharing relationships
- Standard match day and normal kick-off time by division
- Season opening date and target completion date
- Cup weekends, representative fixtures and protected dates
- Christmas, Easter and other league-wide breaks
- Club, team or venue blackout dates already known
- Any alternating-home requirements between teams from the same club
- Rules for clubs with more than one team at the same ground
- Current fixture spreadsheet, Full-Time export or equivalent source file
- The final CSV or spreadsheet format used to publish fixtures
- The current postponement and rearrangement process
- Names and roles of the people who generate, review and publish fixtures

Do not ask for player personal data. League Manager’s first pilot does not need it.

## Discovery workshop questions

### League structure

1. How many divisions, parent clubs and teams are in scope?
2. Can teams move divisions after the first draft is produced?
3. Does every division play home and away, or do some teams meet only once?
4. Are there divisions with an odd number of teams?
5. Can a club operate several teams in the same division?
6. Are there teams that join or withdraw after fixtures have been issued?

### Calendar and rounds

1. What are the normal playing days and kick-off times?
2. Are rounds expected to stay together on the same weekend?
3. Which midweek dates can be used?
4. Which dates must be reserved for cups or representative matches?
5. Is there a minimum rest period between fixtures?
6. Can a team play twice in one week, and under what circumstances?
7. Is there a target number of fixtures that should be completed before winter?

### Venues and ground sharing

1. Which teams share the same physical ground?
2. How many matches can each site host at the same kick-off time?
3. Can different pitches at one site operate independently?
4. Are there alternating-home arrangements between specific teams?
5. Are any grounds unavailable for parts of the season?
6. Are neutral venues used?

### Fairness and preferences

1. What is considered an unacceptable run of home or away fixtures?
2. Should local derbies avoid particular dates?
3. Are there clubs that should not have all teams at home together?
4. Are there policing, travel, religious or community-event constraints?
5. Which constraints are mandatory and which are preferences?

### Review and publication

1. Who is allowed to change a draft?
2. Who signs it off?
3. How many review versions are normally produced?
4. What checks are completed before publication?
5. What information must be included in the export?
6. Does the league need division-by-division files, one master file, or both?
7. How are clubs informed that a new version is available?

### Postponements and rearrangements

1. Who records a postponement?
2. What evidence or approval is required?
3. Are rearrangements proposed by clubs or allocated by the league?
4. Which dates can accept rearranged fixtures?
5. Are postponed games prioritised by age, round or competition?
6. When is a fixture considered confirmed?

## Pilot acceptance scenario

The first successful demonstration should use one real division and prove that League Manager can:

1. Import the division’s parent clubs, teams, venues and ground-share groups.
2. Load all available playing dates and known restrictions.
3. Generate the complete required fixture matrix.
4. Allocate fixtures without double-booking teams.
5. Respect blackout dates and simultaneous venue limits.
6. Preserve a manually locked fixture.
7. Explain every fixture that cannot be placed.
8. Allow the fixture secretary to move and lock exceptions.
9. Compare the revised draft with the original version.
10. Pass server-side validation.
11. Publish the selected version.
12. Export a CSV matching the league’s current process.

## Proposed pilot roles

- **League owner:** senior sponsor and final approval
- **League administrator:** structure, access and configuration
- **Fixture secretary:** draft generation, manual changes and publication
- **League viewer:** review-only access
- **Daxora pilot operator:** setup support, issue triage and documented feedback

## Suggested pilot cadence

- Week 1: discovery and data collection
- Week 2: import and rule confirmation
- Week 3: first generated draft
- Week 4: league review and exception corrections
- Week 5: second version, validation and export comparison
- Week 6: pilot decision and next-phase scope

## Evidence to capture

For every pilot run, retain:

- Input data version and date received
- Generation configuration
- Number of required fixtures
- Number placed automatically
- Number and reason for unresolved fixtures
- Blackout conflicts prevented
- Ground-share conflicts prevented
- Manual changes made after generation
- Validation findings before publication
- Export accepted or changes requested
- Time taken compared with the league’s existing process

## Out of scope for the first scheduling pilot

- Player registration and eligibility
- Discipline and suspensions
- Fines and payments
- Referee appointments
- Results and public league tables
- Cup and knockout generation
- Tournament management
- Direct FA API integration

These may become later products or integrations, but they should not dilute the initial scheduling pilot.
