# Ground Control staging and controlled-pilot evidence phase

This phase turns the existing launch checklist into an evidence-controlled release process.

## Added

- Append-only structured evidence for every launch gate.
- A database rule preventing a gate being marked Ready unless its latest definitive evidence is a pass.
- Browser-visible staging diagnostics for environment, release, Supabase configuration, HTTPS context and client monitoring.
- Automated release evidence generation for lint, regression tests, production build, secret-file tracking and browser-source secret references.
- A staging HTTPS smoke-test script with evidence output.
- GitHub Actions release-gate workflow and downloadable evidence artifact.
- Vercel staging configuration with SPA fallback and baseline security headers.
- Controlled pilot sessions for historical replay, shadow live, controlled use and sign-off.
- Pilot metrics, outcomes, sign-off names and time-saving evidence.
- Pilot findings separated into defects, usability, data, training and feature requests.
- Critical/high findings automatically place pilot health into blocked/attention states.
- Staging and HSM pilot runbooks.

## Evidence boundary

The implementation creates the tooling and database controls. It does not claim that staging has been deployed, migrations have been applied, security isolation has passed or HSM has completed a pilot. Those gates remain open until real staging evidence is recorded.

## Migration

Apply `supabase/migrations/202607050011_staging_pilot_evidence.sql` to staging after reviewing the dry run.
