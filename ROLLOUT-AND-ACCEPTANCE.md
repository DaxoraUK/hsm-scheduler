# v3.10.41 Rollout and Acceptance

## Installation

Target:
`C:\Development\hsm-scheduler`

Run:
`DOUBLE-CLICK-THIS-INSTALL-AND-DEPLOY.cmd`

Do not manually edit or reset the working tree before installation.

## Acceptance

1. Access Security lists members and existing primary roles.
2. An owner/admin can add an additional functional role.
3. The member can hold multiple roles simultaneously.
4. An additional role can be revoked without changing the primary role.
5. Team/site scope is represented in the assignment data.
6. Existing Coach Hub behaviour remains intact.
7. Existing primary-role permission tests remain green.
8. Migration dry-run and linked application pass.
9. Full regression, lint and production build pass.
10. Git staging contains only v3.10.41 release files.
