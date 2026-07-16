# Daxora Ground Control v3.10.3.3 rollout

1. Install and push the release to `staging`.
2. Allow the installer to apply migration `202607160007_coach_hub_pending_invitation_recovery.sql`.
3. Wait for Vercel staging deployment.
4. Sign out of the coach browser and sign back in with the invited coach email.
5. Ground Control should automatically recover the pending invitation and open Coach Hub.
6. Confirm the coach sees only their assigned teams.
7. Confirm the invitation status is **Accepted** in Settings → Coach Hub.

No new invitation is normally required while the existing invitation remains pending and unexpired.
