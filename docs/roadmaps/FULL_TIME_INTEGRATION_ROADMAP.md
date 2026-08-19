# Full-Time FA Integration Roadmap

## Delivered in v3.10.43

- Saved club integration configuration is connected to live fixture imports.
- Multiple enabled league or competition sources can be configured per club.
- Legacy single-source settings remain readable and migrate into the source list when edited.
- The browser uses Daxora's same-origin `/api/full-time` route rather than a public third-party proxy.
- The server accepts only HTTPS pages on `fulltime.thefa.com`, rejects credentials/custom ports and limits response time and size.
- Fixture parsing supports the current type, combined date/time, home, VS, away and venue table shape as well as the legacy compact shape.
- Club aliases identify home fixtures without hard-coding one exact team name.
- Source provenance is retained and duplicate fixtures from overlapping pages are removed deterministically.
- Each source reports success, failure and fixture count. Partial success is explicit; total failure preserves the existing schedule.
- Manual fixture entry remains available.

## Pilot acceptance still required

- Configure every real Full-Time page used by the pilot club.
- Import a known Saturday, Sunday and midweek date where applicable.
- Compare imported home teams, opponents, dates and kick-off times with Full-Time and the club's own list.
- Confirm duplicate pages do not create duplicate fixtures.
- Confirm a deliberately unavailable source reports failure without clearing an existing schedule.

## Deferred

- Publishing or writing changes back to Full-Time.
- Automated reconciliation of later upstream changes.
- Persisted source-health history and alerting.
- Results import for the club workspace; League Manager retains its controlled CSV reconciliation workflow.
