# Ground Control route performance pass

## Purpose

Reduce the production entry bundle without changing scheduling, permissions, onboarding, reporting or pilot behaviour.

## Changes

- Converted the main product pages to React lazy-loaded route modules.
- Split Saturday, Sunday, midweek, Operations Centre and Operations Timeline workspaces.
- Deferred optional onboarding, subscription-gate and print components.
- Removed unused eager imports for the obsolete page layout and day-specific print sheets.
- Added a regression test that prevents the major pages returning to eager imports.

## Production build comparison

| Measure | Before | After |
| --- | ---: | ---: |
| Main JavaScript chunk | 1,012.13 kB | 472.21 kB |
| Main JavaScript gzip | 275.50 kB | 144.84 kB |
| Oversized chunk warning | Yes | No |

The application now downloads each major workspace when it is first opened. Shared scheduling state remains in `AppCore.jsx`, so this is a delivery optimisation rather than a behavioural rewrite.

## Validation

Run:

```powershell
npm run check
npm run dev
```

Manually open Mission Control, each Operations tab, Communications, Analytics, Reports, Settings and the Daxora admin page where available. The first opening may briefly show the branded loading card while the route chunk downloads.
