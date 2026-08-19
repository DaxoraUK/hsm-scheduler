# Full-Time FA Integration Roadmap

## Delivered in v3.10.51

- Detects provider changes to date, kick-off, venue, referee and fixture status against the retained source snapshot.
- Preserves the Ground Control version until an administrator explicitly accepts the Full-Time change.
- Supports explicit **Accept Full-Time change** and **Keep Ground Control version** decisions on each source card.
- Persists pending and rejected change fingerprints in the existing server-backed club configuration.
- Captures venue from compact official fixture feeds.
- Supports an optional public Full-Time Refs page as a supplemental assignment source, including assistant referees when supplied.
- Referee-source failure never blocks fixture imports; unmatched officials remain TBC.

## Delivered in v3.10.48

- Labels the verified BBDFL source explicitly as the Horwich St. Mary's U14 feed.
- Persists per-source last-attempt, last-success, fixture-count, retained-count and failure evidence in the existing server-backed club configuration.
- Retains current and future source fixtures across Full-Time's rolling maximum-fixture window.
- Refreshes a retained fixture when the same date, home team and opponent is republished with updated details.
- Keeps the last successful snapshot when a source fails, while the current schedule remains unchanged.
- Displays durable source health directly on each compact fixture-source summary card.

## Delivered in v3.10.44

- Uses The FA's official browser code-snippet contract instead of relying on server-side page scraping that Cloudflare rejects.
- Accepts a numeric `cs` feed ID or an official Full-Time code-snippet URL for every configured source.
- Loads each feed in an isolated hidden browser frame, reads only its rendered fixture table, then removes the frame.
- Parses the official feed's grouped named-date format and compact home/v/away rows.
- Includes a one-click Lancashire Amateur League preset with verified fixture feeds for Premier through Division Four.
- Keeps multi-league source status, club aliases, partial-failure reporting and deterministic duplicate removal.
- Retains legacy page URLs as a clearly labelled fallback rather than presenting them as reliable live sources.

## Delivered in v3.10.43

- Saved club integration configuration is connected to live fixture imports.
- Multiple enabled league or competition sources can be configured per club.
- Legacy single-source settings remain readable and migrate into the source list when edited.
- The initial same-origin `/api/full-time` page route was delivered, but Full-Time's Cloudflare protection subsequently proved to reject server-side page requests.
- The server accepts only HTTPS pages on `fulltime.thefa.com`, rejects credentials/custom ports and limits response time and size.
- Fixture parsing supports the current type, combined date/time, home, VS, away and venue table shape as well as the legacy compact shape.
- Club aliases identify home fixtures without hard-coding one exact team name.
- Source provenance is retained and duplicate fixtures from overlapping pages are removed deterministically.
- Each source reports success, failure and fixture count. Partial success is explicit; total failure preserves the existing schedule.
- Manual fixture entry remains available.

## Pilot acceptance still required

- Configure every official Full-Time feed used by the pilot club.
- Import a known Saturday, Sunday and midweek date where applicable.
- Compare imported home teams, opponents, dates and kick-off times with Full-Time and the club's own list.
- Confirm duplicate pages do not create duplicate fixtures.
- Confirm a deliberately unavailable source reports failure without clearing an existing schedule.

## Deferred

- Publishing or writing changes back to Full-Time.
- Automated reconciliation of later upstream changes.
- Longer-term source-health event history and proactive alerting beyond the latest persisted evidence.
- Results import for the club workspace; League Manager retains its controlled CSV reconciliation workflow.
