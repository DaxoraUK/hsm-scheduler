# Ground Control operations health calculation fix

## Problem

The Operations Health card could display `100%` while domain cards correctly showed critical officials and parking issues.

The health engine built the domain scores correctly, but passed them to `calculatePlatformHealth` using the wrong object shape. The platform calculator therefore received no domains and used its fallback score of 100.

## Fix

- Pass the calculated domains through the expected `operationsHealth.domains` property.
- Add a regression test proving that critical officials and parking domains cannot produce an overall score of 100.

## Expected result

The overall percentage is now the weighted result of Fixtures, Pitches, Officials, Parking and Communications. Critical domain issues continue to force the red `Needs action` status.

## Validation

- 29 test files passed
- 168 tests passed
- TypeScript and production build passed
- Lint: 0 errors, 79 existing warnings
