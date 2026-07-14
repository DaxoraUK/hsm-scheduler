# League Operations v3.7 — Registrations, Eligibility and Player Administration

## Purpose

v3.7 closes the player-administration gap in League Manager. It adds a secure registration register, controlled club submissions, eligibility rules, dispensations, transfer clearance records and matchday team-sheet validation.

The release is designed to feed the later League Analytics and Reports phase without making reporting depend on unstructured notes.

## Operator workspace

The **Registrations & eligibility** workspace contains seven focused views:

- **Command** — registration corrections, pending applications, transfers, eligibility exceptions and failed team sheets.
- **Applications** — guided player applications, approval, rejection and correction workflows.
- **Player register** — the league-wide player register and current registration position.
- **Transfers** — clearance requests and recorded decisions.
- **Rules & exceptions** — league, division and competition eligibility rules plus dispensations.
- **Team sheets** — fixture-specific selection with immediate eligibility checks.
- **Reports** — registration and eligibility-exception CSV exports.

Registration queues also appear in the main League Operations command centre.

## Club portal

Authorised club secretaries and team contacts can:

- submit a player registration;
- track open, approved and rejected applications;
- correct and resubmit an application;
- request an eligibility dispensation;
- view league decisions;
- select a published fixture and submit a team sheet;
- see eligibility failures before submission.

Club viewers remain read-only. A club receives only records connected to its own club and teams.

## Eligibility engine

The browser and database both evaluate the controls that can be determined from League Manager data:

- approved registration required;
- registration must belong to the selected team;
- effective-from and effective-to dates;
- minimum and maximum age rules;
- registration deadlines;
- active person suspensions;
- cup-tied appearances;
- transfer-clearance rules;
- approved dispensations;
- warning rules versus publication-blocking rules.

A submitted team sheet stores each player's result and a summary count of invalid and warning selections. This makes the decision auditable rather than recalculating an undocumented result later.

## Security and privacy

Player records are more restricted than normal league operational data:

- only league owners, administrators and the new **Registration secretary** role can load the league-wide register;
- club users receive only their own club's records;
- direct table access is revoked;
- row-level security is enabled and forced on all eight new tables;
- writes are performed through validated `security definer` functions;
- date-of-birth and confidential notes are not added to general fixture or results payloads;
- registration evidence links must use HTTP or HTTPS;
- every material submission and decision writes to the League Manager audit history.

The release provides the secure evidence-record API and database model. It does not pretend to be a document-storage service; uploaded-file storage and retention automation should be completed as a dedicated hardening pass before a broad production rollout involving minors.

## Data model

v3.7 adds:

- `league_players`
- `league_player_registrations`
- `league_registration_documents`
- `league_transfer_requests`
- `league_eligibility_rules`
- `league_eligibility_dispensations`
- `league_team_sheets`
- `league_team_sheet_players`

It also adds `registrations` to league membership and invitation roles.

## Reporting hooks

The structured data now supports later analytics for:

- application volume and approval rates;
- correction rates and turnaround time;
- active players by club, team, division and season;
- registration expiry and renewal demand;
- transfer activity;
- duplicate-player warnings;
- eligibility exceptions by rule;
- failed team sheets and repeat compliance issues;
- participation and appearance trends once verified team sheets accumulate.

The v3.7 workspace includes immediate CSV registers. The full interactive dashboard, scheduled reports, board packs and cross-season analysis remain the defined v3.8 Analytics and Reports phase.

## Explicit boundaries

v3.7 does not claim to replace a national governing body's canonical player-registration system. It is the league's operational control, evidence and eligibility layer. Governing-body integration, identity verification, file retention schedules, parental-consent workflows and bulk migration tools require separate acceptance and data-protection review.
