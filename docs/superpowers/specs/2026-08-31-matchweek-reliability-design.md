# Matchweek Reliability Design

## Purpose

Make the active matchweek reliable for the pilot by repairing fixture movement and printing, adding an auditable postponement workflow, resetting ordinary logins to the relevant upcoming weekend, and enforcing inactivity sign-out.

## Scope

This change covers five connected behaviours:

1. Moving a fixture between compatible free pitches must not treat the fixture as clashing with itself.
2. Fixture-allocation printing must use every active fixture in the selected matchweek scope rather than a stale or partial subset.
3. Operators must be able to postpone and restore fixtures with a recorded reason and note.
4. A normal login must open the current or next matchweek, while an explicitly loaded saved matchweek remains available until the user leaves it.
5. Authenticated users must be signed out after 30 minutes of inactivity, with a warning after 25 minutes and cross-tab synchronisation.

## Fixture Move Validation

Move validation receives the selected fixture identity alongside the proposed pitch and kick-off. Team, pitch, shared-area and turnover checks exclude that selected fixture from the comparison set. All other fixtures remain subject to the existing validation rules. A no-change proposal is reported separately from a collision.

The regression case is a fixture moving from Pitch 2 to a compatible, unoccupied Pitch 1 at the same time. It must validate successfully when no other fixture or shared-pitch constraint blocks the move.

## Printing

The print model is built from the current matchweek state, combining the active fixtures for the selected scope. It must not depend on whether a fixture originated from an import, manual entry, a restored week or a later move. Postponed and cancelled fixtures are excluded from the operational allocation table and appear in exception reporting instead.

The print header continues to identify the selected scope and dates. The printed row count must match the active fixture count presented by Ground Control for that scope.

## Postponement Lifecycle

The fixture control drawer provides a `Postpone fixture` action to authorised operational roles. The action requires one reason from:

- Weather
- Waterlogged or unsafe pitch
- Ground unavailable
- Opposition request
- League decision
- Other

An optional operator note may be recorded. Confirming the action changes the fixture status to `postponed` and records the reason, note, timestamp, actor where available, plus the original date, kick-off and pitch allocation.

A postponed fixture remains visible in the loaded week under an exceptions/postponed view, but it no longer occupies pitch capacity, contributes to active-official requirements or appears in the operational allocation printout. Existing communications, reports and analytics consume the status and postponement metadata. The fixture can be restored to its original allocation, subject to the normal move and clash validation rules.

Saved matchweek history must preserve postponed fixtures and their metadata so weather losses and other causes remain auditable.

## Matchweek Date Behaviour

At application start and after a fresh authentication/workspace hydration, Ground Control selects the current or next Saturday/Sunday matchweek using the existing calendar utilities. A previously persisted date must not leave an ordinary login on an expired weekend.

Loading a saved historical matchweek is an explicit operator action and may temporarily select its recorded dates. Returning to the live workspace or starting a later login selects the relevant upcoming weekend again.

## Inactivity Sign-out

The session lifecycle tracks meaningful activity from keyboard, pointer, touch, focus and application navigation events. Activity is throttled so frequent pointer movement does not cause excessive work.

- At 25 minutes without activity, show a warning that sign-out will occur in five minutes.
- The warning provides `Stay signed in`, which resets the inactivity period after verifying the session.
- At 30 minutes without activity, clear and revoke the session through the existing sign-out path.
- Activity in another tab updates the shared last-activity record.
- A sign-out in any tab closes the workspace in every tab through the existing storage synchronisation.

Token refresh must not count as user activity and must not prevent inactivity sign-out.

## Permissions and Audit

Existing matchweek-edit permissions govern move, postpone and restore actions. Read-only roles may view statuses but cannot change them. Postponement metadata is retained in saved matchweek history and downstream evidence models.

## Error Handling

- A blocked move explains the actual conflicting fixture or resource and never cites the selected fixture itself.
- Postponement cannot complete without a reason.
- Restoration that would create a clash remains postponed and explains the blocker.
- Print generation shows an explicit empty-state message if the selected scope genuinely contains no active fixtures.
- Inactivity sign-out presents a clear security message and returns to sign-in without exposing workspace data.

## Verification

Regression tests will cover self-exclusion in move validation, complete active-scope printing, postponement/restoration state and analytics, upcoming-weekend selection after a fresh login, and 25/30-minute session activity behaviour. The full automated suite, type check and production build must pass before staging deployment. Staging browser verification will cover the fixture drawer, printed row count, postponement flow, analytics evidence and inactivity warning.
