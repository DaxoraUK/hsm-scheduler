# Daxora Ground Control v3.10.13 rollout

## Before installation

- Use the staging branch.
- Ensure the project is at `C:\Development\hsm-scheduler`.
- Close any dev server holding project files.
- Confirm the Supabase CLI is linked to the staging project.

## Automated installer

Run `DOUBLE-CLICK-THIS-INSTALL-AND-DEPLOY.cmd` from the extracted release folder.

The installer:

1. verifies the payload hashes;
2. backs up every replaced file;
3. copies exact replacement files;
4. runs focused regression tests;
5. runs the full regression catalogue;
6. runs lint and the production build;
7. validates staged whitespace;
8. applies the linked Supabase migration;
9. creates a scoped Git commit;
10. pushes the staging branch.

## Staging acceptance

### Team contacts

- Open Settings -> Coach Hub -> Teams and Roles for a person with both a Coach Hub role and a Team-managed contact.
- Edit the Team-managed role.
- Remove primary status and save.
- Refresh and verify persistence.
- Unassign one team and verify every other assignment remains.
- Open Settings -> Teams and verify the matching contact slot is cleared.
- Review the audit trail.

### Analytics

- Use a period containing saved fixtures and Annual Planner bookings.
- Compare fixture, training and friendly counts with source records.
- Test site, pitch, area, team, age-group, status and usage-type filters.
- Verify two simultaneous halves equal one pitch-equivalent hour.
- Verify a Full Pitch booking equals one pitch-equivalent hour.
- Add a weather closure and confirm usable capacity and weather loss change.
- Check cost measures using an account that can view costs and one that cannot.

### Reports

- Open Unified Facility Usage.
- Use the same dates as Main Analytics.
- Compare headline and pitch totals.
- Export CSV.
- Print or save the report as PDF.
- Confirm no private notes, supplier references or contact details are exported.

## Rollback

The installer writes a timestamped backup and restore manifest under `.daxora-backups`. If validation fails before deployment, it restores only release payload files and removes files introduced by this release.
