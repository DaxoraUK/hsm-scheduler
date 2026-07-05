# Ground Control — Funding Uploads and Local Discovery

## What changed

### Visible document upload

Document upload is now available from four places:

1. The main Funding Workspace header.
2. The Documents tab header.
3. The empty Documents state.
4. Every expandable readiness requirement that accepts evidence.

The upload dialog requires the club to select the requirement supported by the file. It also records an optional document type and review/expiry date.

Uploading a file now changes a missing requirement to **In progress**, not **Ready**. A club administrator must review the evidence before confirming that it fully satisfies the funder's requirement.

### Local funding profile

A new **Local funding** tab records:

- Club postcode
- Project/facility postcode
- Home nation
- Region
- Local authority
- Administrative county
- County FA
- Legal structure
- Affiliation
- Facility tenure
- Annual income band
- Charity, CASC or company/CIC registration numbers

The postcode lookup uses Postcodes.io data derived from the ONS Postcode Directory. No API key is required.

### Official discovery routes

The first local-discovery layer prioritises official or established sources based on the club's home nation:

- UK Government Find a Grant
- GOV.UK local council finder
- UK Community Foundations local foundation finder
- The FA County FA directory for England
- Funding Scotland and sportscotland
- Funding Wales and Sport Wales
- Northern Ireland Government Funding Database
- NICVA GrantTracker
- Community Foundation Northern Ireland
- Sport Northern Ireland

This phase directs clubs to the correct verified discovery routes. It does not claim that every local, short-lived or postcode-restricted grant has already been ingested into Ground Control.

## Database migration

Apply after the existing funding workspace migration:

```text
supabase/migrations/202607050009_funding_local_discovery.sql
```

The migration creates `public.funding_profiles` with forced row-level security. Club readers may view the profile; only club managers may create or update it.

Run a dry run first:

```powershell
npx supabase db push --dry-run
```

Then apply only when the listed migrations are expected:

```powershell
npx supabase db push
```

## Validation

- 35 test files passed
- 194 tests passed
- TypeScript passed
- Production build passed
- Lint completed with zero errors
- Initial bundle remains approximately 472 KB minified / 145 KB gzip

## Manual checks

1. Save a funding project.
2. Confirm **Upload document** appears in the workspace header.
3. Open Documents and upload a file from the header and empty state.
4. Confirm the dialog requires a linked requirement.
5. Confirm the linked requirement moves to **In progress**, not Ready.
6. Open Local funding.
7. Resolve a valid UK postcode.
8. Confirm home nation, region and local authority populate.
9. Complete County FA, legal structure, affiliation and tenure.
10. Save the profile.
11. Confirm another club cannot read or update the profile after the migration is applied.
