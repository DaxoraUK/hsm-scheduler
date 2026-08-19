# Access Architecture Future Development

## Role and scope

- Authoritative team picker for team-scoped roles.
- Authoritative site/venue picker for site-scoped roles.
- Custom club roles with controlled permission bundles.
- Role assignment history and expiry.
- Temporary delegated responsibilities.

## Package-aware access

- Map every product capability to one or more roles.
- Define Core / Pro / Elite capability ceilings.
- Generate navigation from effective role + scope + package.
- Preserve upgrade discovery without exposing unusable controls.
- Add role/package regression matrix.
- Add read-only, suspended, expired-subscription and downgrade cases to the shared effective-access model.
- Require every module roadmap to declare view, create, amend, approve, publish, communicate, export and delete capabilities.
- Use effective access to progressively disclose specialist and advanced interfaces, reducing clutter for volunteers and single-purpose users.

## Security

- Gradually migrate privileged Supabase RPCs from single primary-role checks to explicit capability checks.
- Keep RLS and security-definer RPCs as the final authority.
- Add security regression tests for cross-team and cross-site access.
- Add combined-role tests proving that permissions accumulate only inside the subscription ceiling and assigned scope.
- Add explicit sensitive-field tests for finance, safeguarding and personal contact information.
- Add auditable, restricted support-access workflows that do not infer club authority from platform-staff status alone.

## Deferred

- Custom permission authoring.
- Cross-club roles.
- League/club role unification.
- Automated role inference.
