# Daxora Ground Control v3.10.43 - Full-Time FA Reliability and Multiple Sources

## Root repair

The saved Full-Time configuration is now passed into the live fixture fetcher. Previously the hook was called without configuration, so live imports always had zero configured sources.

## Changes

- Supports multiple enabled Full-Time league or competition pages per club while retaining legacy single-source settings.
- Replaces the public AllOrigins browser dependency with Daxora's same-origin `/api/full-time` handler.
- Restricts upstream requests to HTTPS `fulltime.thefa.com` pages, with redirect, timeout and response-size controls.
- Parses the current Full-Time type/date-time/home/VS/away/venue table shape and the legacy compact shape.
- Supports configurable club team aliases, source provenance, UK dates, kick-off times, cup identification and deterministic duplicate removal.
- Reports per-source success, failure and fixture counts.
- Allows explicit partial success but prevents total source failure from clearing an existing schedule.
- Adds multiple-source management to Integration Settings.
- Corrects the proven release engine's filesystem operations to use literal paths, so the existing `api/[...path].js` gateway is verified, backed up, applied and rolled back safely.
- Keeps manual fixture entry available and makes no claim of write-back to Full-Time.

## Deliberately unchanged

- No database migration.
- No Full-Time result write-back or automated upstream reconciliation.
- League Manager's controlled CSV reconciliation remains separate.
- Release-engine control flow is unchanged apart from literal-path compatibility for filenames containing square brackets.
