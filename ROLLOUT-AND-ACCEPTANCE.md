# v3.10.43 Rollout and Acceptance

## Automated evidence completed before packaging

- Full Vitest catalogue: 135 files and 744 tests passed.
- Focused Full-Time parser, multiple-source and proxy tests: passed.
- Oxlint: completed with baseline warnings only and no errors.
- TypeScript and Vite production build: passed.
- Catch-all Vercel API function count remains one.
- Payload hashes, PowerShell syntax, ZIP extraction and checksum are verified during packaging.
- The extracted package is installed end-to-end into a disposable Git repository, including literal verification and backup of `api/[...path].js`.

## Live pilot acceptance still required

- Add each real club Full-Time team or fixture page in Settings.
- Add club aliases that match the home-team names shown on those pages.
- Import one known date and compare every home team, opponent, date and kick-off time with Full-Time.
- Confirm overlapping sources do not create duplicate fixtures.
- Confirm one failed source is reported alongside successful sources.
- Confirm total source failure leaves the existing schedule unchanged.
- Retain manual fixtures as the fallback if Full-Time is unavailable.
