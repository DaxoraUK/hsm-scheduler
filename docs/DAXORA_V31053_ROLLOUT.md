# Daxora Ground Control v3.10.5.3 Rollout

1. Install the exact replacement payload into `C:\Development\hsm-scheduler`.
2. Run the focused v3.10.5.3 regression test.
3. Run the complete regression suite.
4. Run lint and the TypeScript/Vite production build.
5. Apply the linked Supabase migration.
6. Commit only the v3.10.5.3 files and push `staging`.
7. After Vercel deploys, keep Annual Planner → Requests open and confirm six-second polling does not move the viewport.
8. Submit a training request for Pitch 4 Half A, then submit another valid request for Half B.
9. Confirm duplicate Half A use remains unavailable and an actionable error appears in the wizard.
